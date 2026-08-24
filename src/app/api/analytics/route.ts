import { NextResponse } from 'next/server';
import db from '@/lib/db/schema';
import { TaskParser, TaskDecomposer } from '@/lib/nlp/task-parser';
import { generateInsights, generateSmartRecommendations } from '@/lib/ai/enhancement';

// Helper functions for analytics
function calculateDays(timeframe: string): number {
  const patterns: Record<string, number> = {
    '7d': 7, '30d': 30, '90d': 90, '1y': 365,
  };
  return patterns[timeframe] || 30;
}

function calculateTaskComplexity(task: any): number {
  if (!task) return 1;
  let complexity = 1;
  if (task.estimate_minutes > 60) complexity += 1;
  if (task.estimate_minutes > 120) complexity += 1;
  if (task.dependencies) {
    try {
      const deps = JSON.parse(task.dependencies || '[]');
      complexity += deps.length;
    } catch {}
  }
  if (task.is_recurring) complexity += 0.5;
  return Math.min(5, complexity);
}

function calculateUrgencyScore(task: any, now: Date): number {
  if (!task.deadline) return 50;
  const deadline = new Date(task.deadline);
  const hoursUntil = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursUntil < 1) return 100;
  if (hoursUntil < 24) return 80;
  if (hoursUntil < 72) return 60;
  if (hoursUntil < 168) return 40;
  return 20;
}

// Get tasks for a date period
function getTasksForPeriod(startDate: Date, endDate: Date): any[] {
  const start = startDate.toISOString().split('T')[0];
  const end = endDate.toISOString().split('T')[0];
  return db.prepare(`
    SELECT * FROM tasks
    WHERE (date(created_at) >= date(?) AND date(created_at) <= date(?))
       OR (date(updated_at) >= date(?) AND date(updated_at) <= date(?))
    ORDER BY created_at DESC
  `).all(start, end, start, end);
}

// Get time entries for a date period
function getTimeEntriesForPeriod(startDate: Date, endDate: Date): any[] {
  const start = startDate.toISOString().split('T')[0];
  const end = endDate.toISOString().split('T')[0];
  return db.prepare(`
    SELECT * FROM time_entries
    WHERE date(started_at) >= date(?) AND date(started_at) <= date(?)
    ORDER BY started_at DESC
  `).all(start, end);
}

// Get all subtasks for tasks
async function getAllSubtasks(taskIds: number[]): Promise<any[]> {
  if (!taskIds.length) return [];
  const placeholders = taskIds.map(() => '?,').join('');
  return db.prepare(`
    SELECT * FROM subtasks WHERE task_id IN (${placeholders.slice(0, -1)})
  `).all(...taskIds);
}

// Cluster similar tasks
function clusterSimilarTasks(tasks: any[]): any[] {
  const clusters: Record<string, any[]> = {};

  tasks.forEach(task => {
    // Extract keywords from task name
    const words = (task.name || '').toLowerCase().split(new RegExp('\W+')).filter((w: string) => w.length > 2);
    const firstWord = words[0] || 'unknown';
    const clusterKey = `${firstWord}-${task.priority || 'none'}`;

    if (!clusters[clusterKey]) {
      clusters[clusterKey] = [];
    }
    clusters[clusterKey].push(task);
  });

  return Object.entries(clusters)
    .filter(([_, tasks]) => tasks.length >= 2)
    .map(([pattern, tasks]) => ({
      pattern,
      tasks,
      frequency: tasks.length
    }));
}

// Analyze task lifecycle
function analyzeTaskLifecycle(tasks: any[]): any {
  const lifecycles = tasks
    .filter(t => t.is_completed && t.created_at && t.updated_at)
    .map(task => {
      const created = new Date(task.created_at).getTime();
      const completed = new Date(task.updated_at).getTime();
      const duration = (completed - created) / (1000 * 60 * 60 * 24); // days
      return {
        taskId: task.id,
        lifecycleDays: duration,
        estimateVsActual: task.actual_minutes ? task.actual_minutes / (task.estimate_minutes || 1) : null
      };
    });

  const avgLifecycle = lifecycles.reduce((sum, l) => sum + l.lifecycleDays, 0) / (lifecycles.length || 1);
  const fastCompleters = lifecycles.filter(l => l.lifecycleDays < 1).length;
  const slowCompleters = lifecycles.filter(l => l.lifecycleDays > 7).length;

  return {
    avgLifecycleDays: Math.round(avgLifecycle * 10) / 10,
    fastCompleters,
    slowCompleters,
    completionRate: tasks.filter(t => t.is_completed).length / (tasks.length || 1)
  };
}

// Analyze daily patterns
async function analyzeDailyPatterns(timeEntries: any[]): Promise<any> {
  const hourlyDistribution: Record<number, { count: number; totalMinutes: number }> = {};

  timeEntries.forEach(entry => {
    const hour = new Date(entry.started_at).getHours();
    if (!hourlyDistribution[hour]) {
      hourlyDistribution[hour] = { count: 0, totalMinutes: 0 };
    }
    hourlyDistribution[hour].count += 1;
    hourlyDistribution[hour].totalMinutes += entry.duration_minutes || 0;
  });

  const peakHours = Object.entries(hourlyDistribution)
    .map(([hour, data]) => ({
      hour: parseInt(hour),
      taskCount: data.count,
      totalMinutes: data.totalMinutes,
      efficiency: data.count > 0 ? data.totalMinutes / data.count : 0
    }))
    .sort((a, b) => b.totalMinutes - a.totalMinutes)
    .slice(0, 3);

  return {
    hourlyDistribution,
    peakHours: peakHours.map(p => p.hour),
    mostProductiveHour: peakHours[0]?.hour || 9,
    peakEfficiency: peakHours[0]?.efficiency || 0
  };
}

// Identify procrastination triggers
async function identifyProcrastinationTriggers(tasks: any[]): Promise<any[]> {
  const triggers: any[] = [];

  // Tasks with long delays between creation and completion
  const delayedTasks = tasks.filter(t =>
    t.is_completed && t.created_at && t.updated_at &&
    (new Date(t.updated_at).getTime() - new Date(t.created_at).getTime()) > 3 * 24 * 60 * 60 * 1000
  );

  if (delayedTasks.length > 3) {
    triggers.push({
      trigger: 'complex_task_overload',
      description: `${delayedTasks.length} tasks took 3+ days to complete`,
      severity: delayedTasks.length > 5 ? 'high' : 'medium',
      recommendation: 'Break complex tasks into smaller sub-tasks'
    });
  }

  // Low priority tasks taking long
  const lowPriorityDelays = tasks.filter(t =>
    t.is_completed && t.priority === 'low' &&
    (new Date(t.updated_at).getTime() - new Date(t.created_at).getTime()) > 7 * 24 * 60 * 60 * 1000
  );

  if (lowPriorityDelays.length > 0) {
    triggers.push({
      trigger: 'low_priority_distraction',
      description: `${lowPriorityDelays.length} low-priority tasks took 1+ week`,
      severity: 'medium',
      recommendation: 'Use batch processing for low-priority tasks'
    });
  }

  return triggers;
}

// Calculate productivity metrics
async function calculateProductivityMetrics(tasks: any[], timeEntries: any[]): Promise<any> {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.is_completed).length;
  const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  const totalPlannedMinutes = tasks.reduce((sum, t) => sum + (t.estimate_minutes || 0), 0);
  const totalActualMinutes = tasks.reduce((sum, t) => sum + (t.actual_minutes || 0), 0);
  const estimateAccuracy = totalPlannedMinutes > 0
    ? ((totalActualMinutes / totalPlannedMinutes) * 100)
    : 100;

  const totalTrackedMinutes = timeEntries.reduce((sum, te) => sum + (te.duration_minutes || 0), 0);
  const billableHours = totalTrackedMinutes / 60;

  const avgTaskTime = completedTasks > 0
    ? totalActualMinutes / completedTasks
    : 0;

  return {
    totalTasks,
    completedTasks,
    completionRate: Math.round(completionRate),
    estimateAccuracy: Math.round(estimateAccuracy),
    totalPlannedMinutes,
    totalActualMinutes,
    totalTrackedMinutes,
    billableHours: Math.round(billableHours * 10) / 10,
    avgTaskTime: Math.round(avgTaskTime),
    dailyProductivity: Math.round((totalActualMinutes / (calculateDays('30d') * 8 * 60)) * 100)
  };
}

// Make predictions about future performance
async function makePredictions(userId: string, tasks: any[], timeEntries: any[]): Promise<any> {
  // Based on historical data, predict completion rates
  const historicalCompletionRate = tasks.filter(t => t.is_completed).length / (tasks.length || 1);
  const predictedTasks = tasks.filter(t => !t.is_completed).length;
  const predictedCompletions = Math.round(predictedTasks * historicalCompletionRate);

  // Predict next week's workload
  const avgDailyCompleted = tasks
    .filter(t => t.is_completed && t.updated_at)
    .reduce((sum, t) => {
      const day = new Date(t.updated_at).getDay();
      return sum;
    }, 0) / 7;

  return {
    predictedCompletionRate: historicalCompletionRate,
    predictedCompletionsNextWeek: predictedCompletions,
    estimatedTimeToClearBacklog: Math.round((predictedTasks * 3) / avgDailyCompleted || 10), // Days
    confidence: historicalCompletionRate > 0.5 ? 'medium' : 'low',
    recommendations: [
      {
        action: 'clear_backlog',
        priority: 'high',
        description: `You have ${predictedTasks} open tasks. Focus on completing the oldest ones first.`
      },
      {
        action: 'time_estimation',
        priority: 'medium',
        description: 'Your time estimates are ' + (historicalCompletionRate > 0.7 ? 'accurate' : 'underestimated') + '. Use historical data to improve.'
      }
    ]
  };
}

// Create overview summary
function createOverview(insights: any, recommendations: any) {
  return {
    mostProductiveTimeOfDay: insights.mostProductiveTimeOfDay || 9,
    commonTaskDuration: insights.commonTaskDuration || 45,
    taskCompletionRate: insights.taskCompletionRate || 85,
    peakFocusHours: insights.peakFocusHours || [9, 10, 14, 15],
    automationOpportunities: recommendations.automationOpportunities,
    suggestedTasks: recommendations.suggestedTasks
  };
}

// Identify optimizations
function findMultiPhaseOptimizations(multiPhaseProjects: any[]) {
  if (!multiPhaseProjects.length) return [];
  return multiPhaseProjects.map(task => ({
    taskId: task.id,
    title: task.name,
    suggestion: 'Break into smaller phases with explicit deadlines',
    potentialTimeSave: (task.estimate_minutes || 0) * 0.3
  }));
}

function getOverdueTasks(tasks: any[]) {
  return tasks.filter(t =>
    (new Date().getTime() - new Date(t.created_at).getTime()) > 7 * 24 * 60 * 60 * 1000 &&
    !t.is_completed
  ).map(task => ({
    taskId: task.id,
    title: task.name,
    daysOverdue: Math.floor((new Date().getTime() - new Date(task.created_at).getTime()) / (1000 * 60 * 60 * 24)),
    suggestion: 'Consider breaking this task into smaller steps or delegating it'
  }));
}

function analyzeEstimationAccuracy(tasks: any[]) {
  const overestimates = tasks.filter(t => t.is_completed && t.estimate_minutes > (t.actual_minutes || 0)).length;
  const underestimates = tasks.filter(t => t.is_completed && t.estimate_minutes < (t.actual_minutes || 0)).length;

  return {
    overestimateRate: overestimates / (tasks.length || 1),
    underestimateRate: underestimates / (tasks.length || 1),
    averageVariance: tasks.reduce((sum, t) => sum + Math.abs((t.estimate_minutes || 0) - (t.actual_minutes || 0)), 0) / (tasks.length || 1)
  };
}

// API endpoint
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') || '30d';
    const userId = searchParams.get('userId') || 'default';
    const analysisType = searchParams.get('type') || 'overview';

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - calculateDays(timeframe) * 24 * 60 * 60 * 1000);

    // Get comprehensive data
    const tasks = getTasksForPeriod(startDate, endDate);
    const timeEntries = getTimeEntriesForPeriod(startDate, endDate);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Build task contexts for AI analysis
    const userData = {
      tasks: tasks,
      completedTasks: tasks.filter(t => t.is_completed).length,
      overdueTasks: tasks.filter(t => !t.is_completed && t.deadline && new Date(t.deadline) < new Date()).length,
      timeEntries: timeEntries,
    };

    // Get AI-powered insights
    let aiInsights = {
      mostProductiveTimeOfDay: 9,
      commonTaskDuration: 45,
      preferredPriorityDistribution: { high: 30, medium: 40, low: 20, none: 10 },
      taskCompletionRate: 85,
      peakFocusHours: [9, 10, 14, 15]
    };

    try {
      aiInsights = await generateInsights(userData);
    } catch (error) {
      console.warn('AI insights generation failed, using defaults:', error);
    }

    // Get AI-powered recommendations
    let recommendations = {
      suggestedTasks: [] as any[],
      optimalScheduleBlocks: [] as any[],
      automationOpportunities: [
        'Consider automating recurring tasks',
        'Batch similar tasks together',
        'Use templates for repetitive tasks'
      ]
    };

    try {
      recommendations = await generateSmartRecommendations({
        tasks: tasks,
        timeEntries: timeEntries
      });
    } catch (error) {
      console.warn('Smart recommendations generation failed, using defaults:', error);
    }

    switch (analysisType) {
      case 'overview':
        return NextResponse.json({
          success: true,
          timeframe,
          summary: createOverview(aiInsights, recommendations),
          productivityMetrics: await calculateProductivityMetrics(tasks, timeEntries),
          predictions: await makePredictions(userId, tasks, timeEntries),
          recommendations: recommendations.suggestedTasks,
          automation: recommendations.automationOpportunities
        });

      case 'performance':
        return NextResponse.json({
          success: true,
          productivityMetrics: await calculateProductivityMetrics(tasks, timeEntries),
          timeTrackingInsights: await analyzeDailyPatterns(timeEntries),
          energyInsights: tasks.map(t => ({ id: t.id, priority: t.priority, estimate: t.estimate_minutes }))
        });

      case 'workflow':
        const subtasks = await getAllSubtasks(tasks.map(t => t.id));
        return NextResponse.json({
          success: true,
          taskDecomposition: await analyzeTaskDecomposition(tasks),
          bottlenecks: await identifyBottlenecks(tasks, timeEntries),
          optimizationOpportunities: await findOptimizationOpportunities(tasks, timeEntries)
        });

      case 'patterns':
        return NextResponse.json({
          success: true,
          dailyPatterns: await analyzeDailyPatterns(timeEntries),
          procrastinationTriggers: await identifyProcrastinationTriggers(tasks),
          lifecycleAnalysis: analyzeTaskLifecycle(tasks),
          taskClusters: clusterSimilarTasks(tasks)
        });

      case 'insights':
        return NextResponse.json({
          success: true,
          aiGeneratedInsights: aiInsights,
          recommendations,
          rawDataSummary: {
            totalTasks: tasks.length,
            totalTimeEntries: timeEntries.length,
            dateRange: { start: startDate.toISOString(), end: endDate.toISOString() }
          }
        });

      default:
        return NextResponse.json({
          success: true,
          timeframe,
          summary: createOverview(aiInsights, recommendations),
          productivityMetrics: await calculateProductivityMetrics(tasks, timeEntries)
        });
    }
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate analytics' },
      { status: 500 }
    );
  }
}

// Identify bottlenecks
async function identifyBottlenecks(tasks: any[], timeEntries: any[]): Promise<any[]> {
  const bottlenecks = [];

  // Time-related bottlenecks
  const timeBottlenecks = tasks.filter(task => {
    const taskTimeEntries = timeEntries.filter(te => te.task_id === task.id);
    return taskTimeEntries.some(te => te.duration_minutes > (task.estimate_minutes || 0) * 2);
  });

  if (timeBottlenecks.length > 0) {
    bottlenecks.push({
      type: 'time-management',
      tasks: timeBottlenecks,
      impact: `${timeBottlenecks.length} tasks overestimated duration`,
      recommendation: 'Implement time tracking rules and duration validation',
      priority: 'high'
    });
  }

  // Priority-based bottlenecks
  const priorityBottlenecks = tasks.filter(task =>
    task.priority === 'high' &&
    !task.is_completed &&
    (task.estimate_minutes || 0) > 240
  );

  if (priorityBottlenecks.length > 0) {
    bottlenecks.push({
      type: 'priority-load',
      tasks: priorityBottlenecks,
      impact: `${priorityBottlenecks.length} high-priority tasks exceed 4-hour estimates`,
      recommendation: 'Consider splitting into smaller, more manageable tasks',
      priority: 'medium'
    });
  }

  return bottlenecks;
}

// Find optimization opportunities
async function findOptimizationOpportunities(tasks: any[], timeEntries: any[]): Promise<any[]> {
  const opportunities: any[] = [];

  // Batch similar tasks
  const clusters = clusterSimilarTasks(tasks);
  const batchable = clusters.filter(c => c.tasks.length > 2);
  if (batchable.length > 0) {
    opportunities.push({
      type: 'batch-processing',
      title: 'Batch Similar Tasks',
      description: `Found ${batchable.length} groups of similar tasks that can be batched`,
      potential_time_save: batchable.length * 15, // minutes per batch
      priority: 'medium',
      action: 'batch'
    });
  }

  // Automation opportunities
  const recurring = tasks.filter(t => t.is_recurring && t.recurring_pattern);
  if (recurring.length > 2) {
    opportunities.push({
      type: 'automation',
      title: 'Automate Recurring Tasks',
      description: `${recurring.length} recurring tasks could be automated`,
      potential_time_save: recurring.length * 30,
      priority: 'high',
      action: 'automate'
    });
  }

  // Estimation review
  const overEstimated = tasks.filter(t =>
    t.is_completed && t.estimate_minutes > (t.actual_minutes || 0) * 1.5
  );
  if (overEstimated.length > 3) {
    opportunities.push({
      type: 'estimation',
      title: 'Improve Time Estimates',
      description: `${overEstimated.length} tasks were overestimated by 50%+`,
      potential_time_save: overEstimated.reduce((sum, t) => sum + ((t.estimate_minutes || 0) - (t.actual_minutes || 0)), 0),
      priority: 'low',
      action: 'review_estimates'
    });
  }

  return opportunities;
}

// Analyze task decomposition
async function analyzeTaskDecomposition(tasks: any[]): Promise<any> {
  const patterns = {
    quickWins: tasks.filter(t => (t.estimate_minutes || 0) < 15 && t.actual_minutes && t.actual_minutes > (t.estimate_minutes || 0) * 1.5),
    procrastinationTasks: tasks.filter(t => t.is_completed && t.created_at && t.updated_at &&
      (new Date(t.updated_at).getTime() - new Date(t.created_at).getTime()) > 7 * 24 * 60 * 60 * 1000),
    stuckTasks: tasks.filter(t => t.is_completed && t.actual_minutes && t.actual_minutes > (t.estimate_minutes || 0) * 2.5),
    multiPhaseProjects: tasks.filter(t => t.dependencies && JSON.parse(t.dependencies || '[]').length > 2),
    deadlineProximity: tasks.filter(t => t.deadline && new Date(t.deadline).getTime() < Date.now() + 48 * 60 * 60 * 1000)
  };

  // Find recurring patterns in task data
  const taskClusters = clusterSimilarTasks(tasks);
  const lifecycleInsights = analyzeTaskLifecycle(tasks);

  return {
    patterns,
    clusters: taskClusters,
    lifecycle: lifecycleInsights,
    recommendations: {
      streamlineMultiPhase: findMultiPhaseOptimizations(patterns.multiPhaseProjects),
      preventProcrastination: getOverdueTasks(patterns.procrastinationTasks),
      improveEstimates: analyzeEstimationAccuracy(tasks)
    }
  };
}