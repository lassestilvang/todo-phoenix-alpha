import { NextResponse } from 'next/server';
import { usePriorityAgent } from '@/lib/priority-agent';
import { useEnvironmentAgent } from '@/lib/environment-agent';
import { getOrchestrator } from '@/lib/orchestrator';
import { getScheduler } from '@/lib/scheduler';
import db from '@/lib/db/schema';
import { generateTaskSuggestions } from '@/lib/ai/enhancement';

interface PlannerRequest {
  userId: string;
  date?: string; // ISO date string, defaults to today
  availableHours?: { start: number; end: number };
  energyLevel?: number; // 0-100
  preferences?: {
    focusFirst?: boolean;
    balanceLoad?: boolean;
    respectDeadlines?: boolean;
    timeBlocking?: boolean;
  };
}

interface ScheduledTask {
  taskId: number;
  title: string;
  priority: number;
  estimatedDuration: number;
  scheduledStart: string;
  scheduledEnd: string;
  eisenhowerQuadrant: number;
  confidence: number;
}

interface PlannerResponse {
  success: boolean;
  date: string;
  schedule: ScheduledTask[];
  energyRecommendation: string;
  aiAdvice: string[];
  confidence: number;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as PlannerRequest;
    const { userId = 'default', date, availableHours, energyLevel, preferences = {} } = body;

    const targetDate = date ? new Date(date) : new Date();
    const today = targetDate.toISOString().split('T')[0];
    const now = Date.now();

    // Get environment context
    const environment = useEnvironmentAgent.getState();
    const envContext = environment.getCurrentContext();

    // Determine available hours (9am-5pm default, or user preference)
    const workStart = availableHours?.start ?? 9;
    const workEnd = availableHours?.end ?? 17;
    const dailyMinutes = (workEnd - workStart) * 60;

    // Get all tasks for the date range
    const tasksDb = db.prepare(`
      SELECT id, name, description, deadline, priority, estimate_minutes,
             dependencies, is_completed, list_id, date
      FROM tasks
      WHERE (date = ? OR (date > ? AND date <= date(?, '+7 days')))
        AND is_completed = 0
      ORDER BY priority DESC, deadline ASC, created_at ASC
    `).all(today, today, today) as any[];

    // Get time entries for context
    const timeEntries = db.prepare(`
      SELECT task_id, started_at, duration_minutes
      FROM time_entries
      WHERE date(started_at) = ?
      ORDER BY started_at DESC
    `).all(today);

    // Get recurring task runs
    const recurringRuns = db.prepare(`
      SELECT task_id, scheduled_date, status
      FROM task_runs
      WHERE date(scheduled_date) = ? AND status = 'pending'
    `).all(today);

    // Build task context for PriorityAgent
    const taskContexts = tasksDb.map(task => ({
      taskId: String(task.id),
      description: task.name,
      deadline: task.deadline ? new Date(task.deadline) : undefined,
      dependencies: task.dependencies ? JSON.parse(task.dependencies || '[]') : [],
      tags: [],
      context_type: 'work' as const,
      user_focus_areas: ['deep_work'],
      estimated_energy: task.estimate_minutes ? Math.min(100, task.estimate_minutes / 10) : 50,
      user_energy_level: energyLevel,
      user_focus_state: envContext.context as any,
      last_updated: new Date(task.created_at || now).getTime(),
    }));

    // Calculate priority scores for each task
    const scoredTasks = taskContexts.map(context => {
      // @ts-expect-error - updateScore is a method on the Zustand store, not part of the state type
      const score = usePriorityAgent.updateScore(context);
      return {
        ...context,
        priorityScore: score.overall,
        eisenhowerQuadrant: (() => {
          const isUrgent = context.deadline ?
            (context.deadline.getTime() - now) < 4 * 60 * 60 * 1000 : false;
          const isImportant = score.components.importance > 50;
          if (isUrgent && isImportant) return 1;
          if (!isUrgent && isImportant) return 2;
          if (isUrgent && !isImportant) return 3;
          return 4;
        })(),
        aiSuggestions: null as any,
      };
    });

    // Get AI-powered suggestions for high-priority tasks
    const aiSuggestions = await Promise.all(
      scoredTasks.slice(0, 3).map(async (task) => {
        try {
          const suggestions = await generateTaskSuggestions({
            priority: (task as any).priority || 'none',
            estimate_minutes: task.estimated_energy ? task.estimated_energy * 10 : 0,
            date: task.deadline
          });
          return { taskId: task.taskId, suggestions };
        } catch {
          return { taskId: task.taskId, suggestions: null };
        }
      })
    );

    // Build schedule using time-blocking approach
    let currentMinute = workStart * 60;
    const schedule: ScheduledTask[] = [];
    const aiAdvice: string[] = [];

    // Sort tasks by priority score
    const sortedTasks = [...scoredTasks].sort((a, b) => b.priorityScore - a.priorityScore);

    // Calculate total estimated time
    const totalEstimatedMinutes = sortedTasks.reduce(
      (sum, t) => sum + (t.estimated_energy ? t.estimated_energy * 10 : 30),
      0
    );

    // Energy-based scheduling
    let energyRecommendation = '';
    const currentHour = new Date().getHours();

    if (currentHour < 12) {
      energyRecommendation = 'Morning energy detected - schedule deep work tasks first';
      // Prioritize quadrant 1 and 2 tasks (urgent/important) in the morning
    } else if (currentHour >= 13 && currentHour < 16) {
      energyRecommendation = 'Peak afternoon focus window - good for complex problem-solving';
    } else {
      energyRecommendation = 'Later in the day - good for review and organization tasks';
    }

    // Schedule tasks based on priority and energy
    let scheduledMinutes = 0;
    for (const task of sortedTasks) {
      if (scheduledMinutes >= dailyMinutes) {
        aiAdvice.push(`Task "${task.description}" was not scheduled - exceeds available time`);
        continue;
      }

      const duration = task.estimated_energy ? task.estimated_energy * 10 : 30;
      const scheduledDuration = Math.min(duration, dailyMinutes - scheduledMinutes);

      if (scheduledDuration <= 0) break;

      const startTime = new Date(targetDate);
      startTime.setHours(0, 0, 0, 0);
      startTime.setMinutes(currentMinute);

      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + scheduledDuration);

      const aiSuggestion = aiSuggestions.find(s => s.taskId === task.taskId);

      schedule.push({
        taskId: parseInt(task.taskId),
        title: task.description,
        priority: task.priorityScore,
        estimatedDuration: scheduledDuration,
        scheduledStart: startTime.toISOString(),
        scheduledEnd: endTime.toISOString(),
        eisenhowerQuadrant: task.eisenhowerQuadrant,
        confidence: aiSuggestion?.suggestions?.confidence || 50,
      });

      // Add break between tasks (10 min for tasks > 30 min)
      const breakTime = scheduledDuration > 30 ? 10 : 5;
      currentMinute += scheduledDuration + breakTime;
      scheduledMinutes += scheduledDuration + breakTime;
    }

    // Generate AI advice based on schedule
    if (schedule.length > 0) {
      const totalScheduleMinutes = schedule.reduce((sum, t) => sum + t.estimatedDuration, 0);
      const utilization = (totalScheduleMinutes / dailyMinutes) * 100;

      if (utilization < 50) {
        aiAdvice.push(`Only ${utilization.toFixed(0)}% of work time is scheduled - consider adding more tasks or taking breaks`);
      } else if (utilization > 90) {
        aiAdvice.push(`Schedule is nearly full (${utilization.toFixed(0)}%) - consider delegating or deferring lower priority tasks`);
      }

      // Deadline warnings
      const nearDeadlineTasks = schedule.filter(t => t.confidence < 60);
      if (nearDeadlineTasks.length > 0) {
        aiAdvice.push(`${nearDeadlineTasks.length} task(s) have low confidence - review estimates`);
      }

      // Eisenhower matrix insights
      const quadrant1 = schedule.filter(t => t.eisenhowerQuadrant === 1).length;
      const quadrant2 = schedule.filter(t => t.eisenhowerQuadrant === 2).length;
      if (quadrant2 === 0 && quadrant1 > 0) {
        aiAdvice.push('All tasks are urgent - consider time-blocking for prevention');
      }
    }

    // Calculate overall confidence
    const avgConfidence = schedule.length > 0
      ? schedule.reduce((sum, t) => sum + t.confidence, 0) / schedule.length
      : 0;

    return NextResponse.json({
      success: true,
      date: today,
      schedule,
      energyRecommendation,
      aiAdvice,
      confidence: Math.round(avgConfidence),
      utilization: schedule.length > 0
        ? `${((schedule.reduce((sum, t) => sum + t.estimatedDuration, 0) / dailyMinutes) * 100).toFixed(1)}%`
        : '0%',
    } as PlannerResponse & { utilization: string });

  } catch (error) {
    console.error('AI Planner error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate AI schedule',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  const userId = searchParams.get('userId') || 'default';

  // Reuse POST with same parameters
  const body: PlannerRequest = {
    userId,
    date: date || undefined,
  };

  const requestClone = new Request(request.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return POST(requestClone);
}