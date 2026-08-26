import { db } from '@/lib/db/schema';
import { User, Task, TaskWithDetails } from '@/lib/types';
import { taskOperations } from '@/lib/db/tasks';
import { listOperations } from '@/lib/db/lists';
import { labelOperations } from '@/lib/db/labels';
import { timeEntryOperations } from '@/lib/db/time-entries';

/**
 * Context Engine - Builds comprehensive user context for AI orchestration
 * Aggregates data from multiple sources to create rich user profiles
 */
export class ContextEngine {
  /**
   * Build comprehensive user context from all available data sources
   */
  async buildUserContext(userId: string): Promise<UserContext> {
    try {
      // Gather all data in parallel for performance
      const [
      userData,
      recentTasks,
      allTasks,
      timeEntries,
      lists,
      labels,
      activityMetrics
    ] = await Promise.all([
      this.getUserData(userId),
      this.getRecentTasks(userId, 30),
      this.getAllTasks(userId),
      this.getTimeEntries(userId, 30),
      this.getLists(userId),
      this.getLabels(userId),
      this.getActivityMetrics(userId)
    ]);

      return this.constructUserContext(
        userData,
        recentTasks,
        allTasks,
        timeEntries,
        lists,
        labels,
        activityMetrics
      );
    } catch (error) {
      console.error('Failed to build user context:', error);
      // Return minimal safe context
      return this.getMinimalContext(userId);
    }
  }

  /**
   * Get user basic data from system
   */
  private async getUserData(userId: string): Promise<User> {
    // In production, this would fetch from auth system
    // For now, return default user data
    return {
      id: userId,
      name: 'User',
      email: '',
      role: 'user',
      createdAt: new Date(),
      preferences: {},
      settings: {}
    };
  }

  /**
   * Get recent tasks for context building
   */
  private async getRecentTasks(userId: string, limit: number): Promise<TaskWithDetails[]> {
    // Combine active and completed tasks
    const activeTasks = await taskOperations.getAll(false) as TaskWithDetails[];
    const completedTasks = await taskOperations.getAll(true) as TaskWithDetails[];

    // Get most recent tasks (by creation date)
    const allTasks = [...activeTasks, ...completedTasks]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return allTasks.slice(0, limit);
  }

  /**
   * Get all tasks for a user
   */
  private async getAllTasks(userId: string): Promise<TaskWithDetails[]> {
    const activeTasks = await taskOperations.getAll(false) as TaskWithDetails[];
    const completedTasks = await taskOperations.getAll(true) as TaskWithDetails[];

    // Mark completion status and merge
    const markedActive = activeTasks.map(task => ({
      ...task,
      isCompleted: task.is_completed === 1
    }));

    const markedCompleted = completedTasks.map(task => ({
      ...task,
      isCompleted: task.is_completed === 1
    }));

    return [...markedActive, ...markedCompleted];
  }

  /**
   * Get time tracking data for context
   */
  private async getTimeEntries(userId: string, limit: number): Promise<any[]> {
    // Get all time entries and filter by user
    // In production, would filter by user_id
    const allEntries = await timeEntryOperations.getAll();

    // Return most recent entries
    return allEntries
      .sort((a, b) => new Date(b.started_at || '').getTime() - new Date(a.started_at || '').getTime())
      .slice(0, limit);
  }

  /**
   * Get user's lists for context
   */
  private async getLists(userId: string): Promise<any[]> {
    const allLists = await listOperations.getAll();
    return allLists;
  }

  /**
   * Get user's labels for context
   */
  private async getLabels(userId: string): Promise<any[]> {
    const allLabels = await labelOperations.getAll();
    return allLabels;
  }

  /**
   * Get activity metrics for context
   */
  private async getActivityMetrics(userId: string): Promise<{
    completionRate: number;
    mostProductiveHours: number[];
    currentStreak: number;
    workload: number;
    meetingEffectiveness: number;
    overdueTasks: number;
    productiveHours: number[];
  }> {
    // Calculate metrics from available data
    const allTasks = await this.getAllTasks(userId);

    // Completion rate
    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter(t => t.isCompleted).length;
    const completionRate = totalTasks > 0 ? completedTasks / totalTasks : 0;

    // Most productive hours from time entries
    const productiveHours = this.calculateProductiveHours(allTasks);

    // Current streak calculation
    const currentStreak = this.calculateCurrentStreak(allTasks);

    // Workload estimation
    const workload = this.estimateWorkload(allTasks);

    // Meeting effectiveness (simplified - would use actual meeting data)
    const meetingEffectiveness = 0.75; // Placeholder

    // Overdue tasks
    const overdueTasks = this.countOverdueTasks(allTasks);

    return {
      completionRate,
      mostProductiveHours: productiveHours,
      currentStreak,
      workload,
      meetingEffectiveness,
      overdueTasks,
      productiveHours
    };
  }

  /**
   * Calculate productive hours from task completion patterns
   */
  private calculateProductiveHours(tasks: TaskWithDetails[]): number[] {
    const hourlyCounts = new Array(24).fill(0);

    // Analyze task completion times
    tasks.forEach(task => {
      if (task.created_at) {
        const date = new Date(task.created_at);
        const hour = date.getHours();
        hourlyCounts[hour]++;
      }
    });

    // Also consider time entries if available
    // Would integrate with timeEntryOperations in production

    // Find top productive hours
    const countsWithHours = hourlyCounts.map((count, hour) => ({ hour, count }));
    countsWithHours.sort((a, b) => b.count - a.count);

    // Return top 4 productive hours
    return countsWithHours
      .slice(0, 4)
      .map(({ hour }) => hour);
  }

  /**
   * Calculate current completion streak
   */
  private calculateCurrentStreak(tasks: TaskWithDetails[]): number {
    // Get completed tasks sorted by completion date
    const completed = tasks
      .filter(t => t.isCompleted)
      .sort((a, b) => new Date(b.completed_at || b.updated_at).getTime() - new Date(a.completed_at || a.updated_at).getTime());

    if (completed.length === 0) return 0;

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check consecutive days of task completion
    for (let i = completed.length - 1; i >= 0; i--) {
      const completedDate = new Date(completed[i].completed_at || completed[i].updated_at);
      completedDate.setHours(0, 0, 0, 0);

      const diffDays = Math.floor(
        (today.getTime() - completedDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // If the task was completed within the last diffDays days and days are consecutive
      if (diffDays <= streak + 1) {
        streak++;
        today.setTime(today.getTime() - 24 * 60 * 60 * 1000); // Move to previous day
      } else {
        break;
      }
    }

    return streak;
  }

  /**
   * Estimate user workload based on task volume and complexity
   */
  private estimateWorkload(tasks: TaskWithDetails[]): number {
    if (tasks.length === 0) return 0.1; // Minimal baseline

    // Calculate total estimated minutes
    const totalEstimatedMinutes = tasks.reduce(
      (sum, task) => sum + (task.estimate_minutes || 0),
      0
    );

    // Normalize: assume max realistic weekly workload is 480 minutes/day * 5 days = 2400 minutes
    const weeklyEstimate = totalEstimatedMinutes;
    const maxWeekly = 2400;
    const normalized = Math.min(weeklyEstimate / maxWeekly, 1);

    // Adjust for task priority distribution
    const highPriorityCount = tasks.filter(t => t.priority === 'high').length;
    const priorityAdjustment = highPriorityCount / tasks.length;
    const adjustedWorkload = Math.min(normalized + (priorityAdjustment * 0.2), 1);

    return adjustedWorkload;
  }

  /**
   * Count overdue tasks
   */
  private countOverdueTasks(tasks: TaskWithDetails[]): number {
    const now = new Date();
    let overdueCount = 0;

    tasks.forEach(task => {
      if (task.deadline && !task.isCompleted) {
        const deadline = new Date(task.deadline);
        if (deadline < now) {
          overdueCount++;
        }
      }
    });

    return overdueCount;
  }

  /**
   * Get minimal context when full context building fails
   */
  private getMinimalContext(userId: string): UserContext {
    return {
      userId,
      completionRate: 0,
      overdueTasks: 0,
      mostProductiveHours: [],
      currentStreak: 0,
      workload: 0.5,
      meetingEffectiveness: 0.5,
      activeProjects: [],
      productiveHours: [],
      timeOfDay: 'unknown',
      dayOfWeek: new Date().getDay()
    };
  }

  /**
   * Construct the full UserContext object from all data sources
   */
  private constructUserContext(
    userData: User,
    recentTasks: TaskWithDetails[],
    allTasks: TaskWithDetails[],
    timeEntries: any[],
    lists: any[],
    labels: any[],
    activityMetrics: {
      completionRate: number;
      mostProductiveHours: number[];
      currentStreak: number;
      workload: number;
      meetingEffectiveness: number;
      overdueTasks: number;
      productiveHours: number[];
    }
  ): UserContext {
    return {
      userId: userData.id,
      completionRate: activityMetrics.completionRate,
      overdueTasks: activityMetrics.overdueTasks,
      mostProductiveHours: activityMetrics.mostProductiveHours,
      currentStreak: activityMetrics.currentStreak,
      workload: activityMetrics.workload,
      meetingEffectiveness: activityMetrics.meetingEffectiveness,
      activeProjects: this.extractProjectIds(allTasks),
      productiveHours: activityMetrics.productiveHours,
      timeOfDay: this.getTimeOfDay(),
      dayOfWeek: new Date().getDay()
    };
  }

  /**
   * Extract project IDs from tasks
   */
  private extractProjectIds(tasks: TaskWithDetails[]): string[] {
    const projectIds = new Set<string>();

    tasks.forEach(task => {
      if (task.projectIds && Array.isArray(task.projectIds)) {
        task.projectIds.forEach((id: string) => projectIds.add(id));
      }
      // Also check list_id as a project indicator
      if (task.list_id) {
        projectIds.add(`list-${task.list_id}`);
      }
    });

    return Array.from(projectIds);
  }

  /**
   * Determine current time of day
   */
  private getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
    const hour = new Date().getHours();

    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  }
}

/**
 * User context interface
 */
export interface UserContext {
  userId: string;
  completionRate: number;
  overdueTasks: number;
  mostProductiveHours: number[];
  currentStreak: number;
  workload: number; // 0-1 scale
  meetingEffectiveness: number; // 0-1 scale
  activeProjects: string[];
  productiveHours: number[]; // Hours when user is most productive
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
}