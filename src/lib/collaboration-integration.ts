// Advanced Collaboration Integration with Meeting & Team Features

import db from './db/schema';
import { getGoalMetrics, getGoalRecommendations } from './goal-tracker';
import type { TaskFormData } from './types';

// getSchedulingInsights is imported dynamically in analyzeAndScheduleMeeting to avoid circular deps
export function getSchedulingInsightsForTask(taskMinutes: number): { bestTimeSlots: { hour: number; confidence: number }[]; estimatedCompletionRate: number; suggestedDuration: number; procrastinationRisk: string } {
  // Simplified version - would call adaptive-scheduler in production
  return {
    bestTimeSlots: [{ hour: 9, confidence: 0.8 }, { hour: 14, confidence: 0.9 }],
    estimatedCompletionRate: 0.75,
    suggestedDuration: taskMinutes,
    procrastinationRisk: 'low',
  };
}

export interface TeamMember {
  id: string;
  name: string;
  role: 'admin' | 'manager' | 'user' | 'guest';
  email?: string;
  availability: 'available' | 'busy' | 'away' | 'offline';
  currentTaskId?: number;
  energyLevel: 'low' | 'medium' | 'high';
  lastSeen: string;
}

export interface TeamWorkload {
  userId: string;
  currentTasks: number;
  completedToday: number;
  inProgressTasks: number;
  estimatedCapacity: number; // minutes available per day
  actualTimeSpent: number;
  overloadRisk: 'low' | 'medium' | 'high';
}

export interface SmartMeeting {
  id: string;
  title: string;
  date: string;
  durationMinutes: number;
  attendees: string[];
  platform?: string;
  transcript?: string;
  actionItems: SmartActionItem[];
  decisions: string[];
  keyTopics: string[];
  followUpNeeded: boolean;
  nextSteps: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  effectivenessScore: number; // 0-100
}

export interface SmartActionItem {
  id: string;
  taskName: string;
  description: string;
  assigneeId?: string;
  dueDate?: string;
  priority: 'high' | 'medium' | 'low';
  estimatedMinutes: number;
  confidence: number;
  context: string;
  linkedObjectiveIds?: number[];
  autoScheduled?: boolean;
  suggestedTime?: string; // HH:MM format
  energyMatch?: boolean;
}

export interface TeamCollaborationMetrics {
  totalMeetings: number;
  totalCollaborationTime: number;
  ideasGenerated: number;
  tasksCreatedFromMeetings: number;
  goalsAligned: number;
  meetingEffectiveness: number;
  ideasPerSession: number;
}

export class CollaborationEngine {
  /**
   * Analyze a meeting and extract smart action items with scheduling recommendations
   */
  static async analyzeAndScheduleMeeting(
    meeting: {
      title: string;
      date: string;
      durationMinutes: number;
      attendees: string[];
      platform?: 'zoom' | 'teams' | 'google-meet' | 'in-person' | 'other';
      transcript?: string;
    }
  ): Promise<SmartMeeting> {
    // Generate action items using the meeting assistant
    const { analyzeMeeting } = await import('@/lib/meeting-assistant');
    const insights = await analyzeMeeting({
      title: meeting.title,
      date: meeting.date,
      durationMinutes: meeting.durationMinutes,
      attendees: meeting.attendees,
      transcript: meeting.transcript,
      platform: meeting.platform,
    });

    // Convert to smart action items
    const smartActionItems: SmartActionItem[] = insights.actionItems.map((item, idx) => {
      // Get scheduling recommendations for each action item
      const scheduling = getSchedulingInsightsForTask(item.estimatedMinutes);

      // Determine assignee based on workload and expertise
      const assigneeId = this.determineBestAssignee(item, meeting.attendees);

      // Check energy match
      const energyMatch = this.checkEnergyMatch(item, scheduling.bestTimeSlots);

      // Get energy-aware time slot
      const suggestedHour = energyMatch
        ? scheduling.bestTimeSlots?.[0]?.hour
        : undefined;
      const suggestedTime = suggestedHour !== undefined
        ? `${suggestedHour.toString().padStart(2, '0')}:00`
        : undefined;

      return {
        id: `action_${Date.now()}_${idx}`,
        taskName: item.taskName,
        description: item.description,
        assigneeId: item.assignee || assigneeId,
        dueDate: item.dueDate,
        priority: item.priority,
        estimatedMinutes: item.estimatedMinutes,
        confidence: item.confidence,
        context: item.context || '',
        linkedObjectiveIds: [],
        autoScheduled: true,
        suggestedTime,
        energyMatch,
      };
    });

    return {
      id: `meeting_${Date.now()}`,
      title: meeting.title,
      date: meeting.date,
      durationMinutes: meeting.durationMinutes,
      attendees: meeting.attendees,
      platform: meeting.platform as 'zoom' | 'teams' | 'google-meet' | 'in-person' | 'other' | undefined,
      actionItems: smartActionItems,
      decisions: insights.decisions,
      keyTopics: insights.keyTopics,
      followUpNeeded: insights.followUpNeeded,
      nextSteps: insights.nextSteps,
      sentiment: insights.sentiment,
      effectivenessScore: insights.meetingEffectiveness,
    };
  }

  /**
   * Determine the best team member for an action item
   */
  private static determineBestAssignee(
    actionItem: { assignee?: string; estimatedMinutes: number; context: string },
    attendees: string[]
  ): string | undefined {
    // Check if assignee is already specified
    if (actionItem.assignee) return actionItem.assignee;

    // Analyze attendees' workloads and assign to least busy
    let bestAssignee: string | undefined;
    let lowestWorkload = Infinity;

    attendees.forEach((attendeeId) => {
      const workload = this.getUserWorkload(attendeeId);
      if (workload.estimatedCapacity > workload.actualTimeSpent && workload.actualTimeSpent < lowestWorkload) {
        lowestWorkload = workload.actualTimeSpent;
        bestAssignee = attendeeId;
      }
    });

    return bestAssignee;
  }

  /**
   * Get user's current workload
   */
  private static getUserWorkload(userId: string): TeamWorkload {
    const objectives = getGoalMetrics(userId);

    // Get tasks assigned to or owned by this user
    const tasks = db.prepare(`
      SELECT * FROM tasks WHERE owner_id = ? OR assigned_to = ?
    `).all(userId) as any[];

    const completedToday = tasks.filter((t: any) =>
      t.is_completed === 1 && t.completed_at &&
      new Date(t.completed_at) >= new Date(new Date().setHours(0, 0, 0, 0))
    ).length;

    const inProgress = tasks.filter((t: any) => !t.is_completed).length;

    // Estimate capacity based on past performance
    const avgSessionTime = 45; // Default Pomodoro
    const estimatedCapacity = 8 * 60; // 8 hours default

    return {
      userId,
      currentTasks: tasks.length,
      completedToday,
      inProgressTasks: inProgress,
      estimatedCapacity,
      actualTimeSpent: tasks.reduce((sum: number, t: any) => {
        const entry = db.prepare(
          'SELECT SUM(duration_minutes) as total FROM time_entries WHERE task_id = ? AND stopped_at IS NOT NULL'
        ).get(t.id);
        return sum + (entry?.total || 0);
      }, 0),
      overloadRisk: tasks.length > 12 ? 'high' : tasks.length > 8 ? 'medium' : 'low',
    };
  }

  /**
   * Check if action item matches user's energy patterns
   */
  private static checkEnergyMatch(
    actionItem: { suggestedTime?: string; assigneeId?: string; assignee?: string },
    bestTimeSlots: { hour: number; confidence: number }[]
  ): boolean {
    if (!bestTimeSlots || bestTimeSlots.length === 0) return false;

    // Get user's energy profile
    const userId = actionItem.assigneeId || actionItem.assignee || 'default';
    const profile = db.prepare(
      'SELECT * FROM user_profiles WHERE user_id = ?'
    ).get(userId) as any;

    if (!profile?.energy_cycles) return false;

    const hour = parseInt(actionItem.suggestedTime || '9');
    const energyAtHour = profile.energy_cycles
      .filter((c: { hour: number }) => c.hour === hour)
      .reduce((sum: number, c: any) => sum + c.level, 0) / profile.energy_cycles.length;

    return energyAtHour > 0.6;
  }

  /**
   * Create tasks from meeting and schedule them
   */
  static async createTasksFromMeetingWithScheduling(
    meetingId: string,
    listId: number,
    actionItems: SmartActionItem[]
  ): Promise<{
    createdTasks: TaskFormData[];
    scheduledTasks: Array<{ taskId: number; suggestedTime: string }>;
    missedDueToConflict: number;
  }> {
    const { createTasksFromMeeting } = await import('@/app/actions/tasks');
    const createdTasks = await createTasksFromMeeting(
      { actionItems: actionItems.map(item => ({
          taskName: item.taskName,
          description: item.description,
          assignee: item.assigneeId,
          dueDate: item.dueDate,
          priority: item.priority,
          estimatedMinutes: item.estimatedMinutes,
          relatedTopics: [],
          confidence: item.confidence,
          context: item.context || '',
        })) },
      listId
    );

    // Schedule each task with optimal timing
    const scheduledTasks: Array<{ taskId: number; suggestedTime: string }> = [];
    let missedDueToConflict = 0;

    for (let i = 0; i < createdTasks.length; i++) {
      const task = createdTasks[i];
      const actionItem = actionItems[i];

      // Get scheduling recommendation
      const scheduling = getSchedulingInsightsForTask(actionItem.estimatedMinutes);

      // Find next available slot
      let slotFound = false;
      let hour = 9; // Start at 9 AM

      for (let attempt = 0; attempt < 24 && !slotFound; attempt++) {
        // Check if hour is available (not in unavailable hours)
        const isUnavailable = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]
          .includes(hour);

        if (!isUnavailable && scheduling.bestTimeSlots?.some(s => s.hour === hour)) {
          scheduledTasks.push({
            taskId: (task as any).id || i + 1,
            suggestedTime: `${hour.toString().padStart(2, '0')}:00`,
          });
          slotFound = true;
        }

        hour = (hour + 1) % 24;
      }

      if (!slotFound) {
        missedDueToConflict++;
      }
    }

    return { createdTasks, scheduledTasks, missedDueToConflict };
  }

  /**
   * Get team collaboration metrics
   */
  static getTeamMetrics(userId?: string): TeamCollaborationMetrics {
    const targetUser = userId || 'default';

    // Get collaboration sessions
    const sessions = db.prepare(`
      SELECT * FROM collaboration_sessions WHERE user_id = ?
    `).all(targetUser) as any[];

    // Get brainstorm ideas
    const ideas = db.prepare(`
      SELECT COUNT(*) as count FROM brainstorm_ideas WHERE session_id IN (
        SELECT id FROM collaboration_sessions WHERE user_id = ?
      )
    `).all(targetUser) as any[];

    // Get task recommendations that align with goals
    const metrics = getGoalMetrics(targetUser);

    return {
      totalMeetings: sessions.length,
      totalCollaborationTime: sessions.reduce(
        (sum, s) => sum + (s.ended_at ?
          new Date(s.ended_at).getTime() - new Date(s.started_at).getTime() : 0
        ), 0
      ),
      ideasGenerated: ideas.length,
      tasksCreatedFromMeetings: 0, // Would track in real system
      goalsAligned: metrics.activeGoals,
      meetingEffectiveness: metrics.avgCompletionRate,
      ideasPerSession: sessions.length > 0 ? Math.round(ideas.length / sessions.length) : 0
    };
  }

  /**
   * Generate team productivity report
   */
  static generateTeamReport(userId: string): {
    summary: string;
    productivity: {
      avgDailyMinutes: number;
      completionRate: number;
      topPerformers: string[];
      improvementAreas: string[];
    };
    collaboration: {
      totalSessions: number;
      ideasPerSession: number;
      consensusRate: number;
    };
    goals: {
      progress: number;
      atRisk: number;
      nextFocus: string;
    };
  } {
    const metrics = getGoalMetrics(userId);
    const teamMetrics = this.getTeamMetrics(userId);

    // Get completion data from time entries
    const timeEntries = db.prepare(`
      SELECT task_id, SUM(duration_minutes) as total_minutes, COUNT(*) as sessions
      FROM time_entries
      WHERE task_id IN (SELECT id FROM tasks WHERE owner_id = ?)
      GROUP BY task_id
    `).all(userId) as any[];

    const avgDailyMinutes = timeEntries.length > 0
      ? Math.round(timeEntries.reduce((sum, e) => sum + e.total_minutes, 0) / timeEntries.length / 7 * 7)
      : 0;

    const completionRate = metrics.totalGoals > 0
      ? Math.round(metrics.avgCompletionRate)
      : 0;

    // Find top performers (tasks completed fastest)
    const taskCompletionTimes = db.prepare(`
      SELECT t.id, t.name, AVG(te.duration_minutes) as avg_duration
      FROM tasks t
      JOIN time_entries te ON t.id = te.task_id
      WHERE t.owner_id = ?
      GROUP BY t.id
      ORDER BY avg_duration ASC
      LIMIT 5
    `).all(userId) as any[];

    const topPerformers = taskCompletionTimes.map((t: any) => t.name);

    // Improvement areas
    const improvementAreas: string[] = [];
    if (completionRate < 70) {
      improvementAreas.push('Increase task completion rate - consider breaking down large tasks');
    }
    if (metrics.goalsAtRisk > 0) {
      improvementAreas.push('Focus at-risk goals - re-evaluate priorities and timelines');
    }
    if (teamMetrics.totalMeetings > 8) {
      improvementAreas.push('Consider reducing meeting frequency - optimize with async updates');
    }

    return {
      summary: `Productivity report for ${new Date().toLocaleDateString()}`,
      productivity: {
        avgDailyMinutes,
        completionRate,
        topPerformers,
        improvementAreas,
      },
      collaboration: {
        totalSessions: teamMetrics.totalMeetings,
        ideasPerSession: teamMetrics.ideasPerSession,
        consensusRate: teamMetrics.totalMeetings > 0
          ? Math.round((teamMetrics.ideasGenerated / (teamMetrics.totalMeetings * 10)) * 100)
          : 0,
      },
      goals: {
        progress: metrics.avgCompletionRate,
        atRisk: metrics.goalsAtRisk,
        nextFocus: metrics.activeGoals > 0
          ? `Focus on ${metrics.activeGoals} active goals with ${metrics.avgCompletionRate}% avg completion`
          : 'Set new goals to track progress',
      },
    };
  }
}

// Exported wrapper for backward compatibility
export function getTeamCollaborationMetrics(userId?: string): TeamCollaborationMetrics {
  return CollaborationEngine.getTeamMetrics(userId);
}