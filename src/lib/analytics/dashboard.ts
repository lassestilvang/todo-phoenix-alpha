import type { Task, TaskWithDetails, TimeEntry } from '@/lib/types';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

export interface ProductivityMetrics {
  taskCompletionRate: number;
  averageTimePerTask: number;
  mostProductiveHours: number[];
  deadlineAccuracy: number;
  recurringTaskUsage: number;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
}

export interface TrendData {
  date: string;
  tasksCreated: number;
  tasksCompleted: number;
  timeSpent: number;
}

export interface AnalyticsDashboardData {
  metrics: ProductivityMetrics;
  trends: TrendData[];
  productivityByList: { listName: string; completionRate: number }[];
  productivityByLabel: { labelName: string; usageCount: number }[];
  topPriorities: { priority: string; count: number }[];
  timeTrackingStats: {
    totalTrackedTime: number;
    averageSessionDuration: number;
    longestSession: number;
  };
}

export class AnalyticsDashboard {
  private tasks: any[];
  private timeEntries: any[];
  private lists: any[];
  private labels: any[];

  constructor(tasks: any[] = [], timeEntries: any[] = [], lists: any[] = [], labels: any[] = []) {
    this.tasks = tasks;
    this.timeEntries = timeEntries;
    this.lists = lists;
    this.labels = labels;
  }

  /**
   * Get comprehensive dashboard data
   */
  getDashboardData(): AnalyticsDashboardData {
    return {
      metrics: this.calculateProductivityMetrics(),
      trends: this.calculateTrends(),
      productivityByList: this.getProductivityByList(),
      productivityByLabel: this.getProductivityByLabel(),
      topPriorities: this.getTopPriorities(),
      timeTrackingStats: this.getTimeTrackingStats(),
    };
  }

  /**
   * Calculate key productivity metrics
   */
  calculateProductivityMetrics(): ProductivityMetrics {
    const now = new Date();
    const totalTasks = this.tasks.length;
    const completedTasks = this.tasks.filter((t) => t.is_completed > 0).length;
    const overdueTasks = this.tasks.filter((t) => {
      if (!t.deadline || t.is_completed > 0) return false;
      return new Date(t.deadline) < now;
    }).length;

    return {
      taskCompletionRate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
      averageTimePerTask: this.tasks.reduce((sum, t) => sum + (t.estimate_minutes || 0), 0) / (totalTasks || 1),
      mostProductiveHours: this.calculateMostProductiveHours(),
      deadlineAccuracy: this.calculateDeadlineAccuracy(),
      recurringTaskUsage: this.tasks.filter((t) => t.is_recurring > 0).length,
      totalTasks,
      completedTasks,
      overdueTasks,
    };
  }

  /**
   * Calculate the most productive hours based on task completion times
   */
  private calculateMostProductiveHours(): number[] {
    const hourlyCounts = new Array(24).fill(0);
    const now = new Date();
    const sevenDaysAgo = subDays(now, 7);

    this.timeEntries.forEach((entry) => {
      if (entry.stopped_at) {
        const hour = new Date(entry.started_at).getHours();
        hourlyCounts[hour]++;
      }
    });

    // Return top 4 hours with most activity
    return hourlyCounts
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4)
      .map(({ hour }) => hour);
  }

  /**
   * Calculate deadline accuracy (tasks meeting deadlines)
   */
  private calculateDeadlineAccuracy(): number {
    const completedTasks = this.tasks.filter((t) => t.is_completed > 0 && t.deadline);

    if (completedTasks.length === 0) return 0;

    const onTime = completedTasks.filter((t) => {
      return new Date(t.deadline) <= new Date(t.updated_at);
    }).length;

    return (onTime / completedTasks.length) * 100;
  }

  /**
   * Calculate trends over time (last 30 days)
   */
  calculateTrends(): TrendData[] {
    const trends: TrendData[] = [];
    const now = new Date();

    for (let i = 29; i >= 0; i--) {
      const date = subDays(now, i);
      const dateStr = format(date, 'yyyy-MM-dd');

      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);

      const tasksCreated = this.tasks.filter(
        (t) => new Date(t.created_at) >= dayStart && new Date(t.created_at) <= dayEnd
      ).length;

      const tasksCompleted = this.tasks.filter(
        (t) => t.is_completed > 0 &&
        new Date(t.updated_at) >= dayStart && new Date(t.updated_at) <= dayEnd
      ).length;

      const timeSpent = this.timeEntries
        .filter((e) => {
          const entryDate = new Date(e.started_at);
          return entryDate >= dayStart && entryDate <= dayEnd && e.duration_minutes;
        })
        .reduce((sum, e) => sum + (e.duration_minutes || 0), 0);

      trends.push({
        date: dateStr,
        tasksCreated,
        tasksCompleted,
        timeSpent,
      });
    }

    return trends;
  }

  /**
   * Get productivity breakdown by list
   */
  private getProductivityByList() {
    const listStats = this.lists.map((list) => {
      const listTasks = this.tasks.filter((t) => t.list_id === list.id);
      const completed = listTasks.filter((t) => t.is_completed > 0).length;
      return {
        listName: list.name,
        completionRate: listTasks.length > 0 ? (completed / listTasks.length) * 100 : 0,
      };
    });

    return listStats.sort((a, b) => b.completionRate - a.completionRate);
  }

  /**
   * Get productivity breakdown by label
   */
  private getProductivityByLabel() {
    const labelStats = this.labels.map((label) => {
      const labelTasks = this.tasks.filter(
        (t) => t.labels && t.labels.some((l: any) => l.id === label.id)
      );
      return {
        labelName: label.name,
        usageCount: labelTasks.length,
      };
    });

    return labelStats.sort((a, b) => b.usageCount - a.usageCount);
  }

  /**
   * Get top priorities
   */
  private getTopPriorities() {
    const priorityCounts = { high: 0, medium: 0, low: 0, none: 0 };

    this.tasks.forEach((task) => {
      if (task.priority && priorityCounts.hasOwnProperty(task.priority)) {
        priorityCounts[task.priority as keyof typeof priorityCounts]++;
      }
    });

    return Object.entries(priorityCounts)
      .map(([priority, count]) => ({ priority, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get time tracking statistics
   */
  private getTimeTrackingStats() {
    const completedEntries = this.timeEntries.filter((e) => e.duration_minutes > 0);
    const totalTrackedTime = completedEntries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
    const averageSessionDuration = completedEntries.length > 0
      ? totalTrackedTime / completedEntries.length
      : 0;
    const longestSession = completedEntries.reduce(
      (max, e) => Math.max(max, e.duration_minutes || 0),
      0
    );

    return {
      totalTrackedTime,
      averageSessionDuration,
      longestSession,
    };
  }

  /**
   * Generate personalized insights based on user data
   */
  generateInsights(): string[] {
    const metrics = this.calculateProductivityMetrics();
    const insights: string[] = [];

    if (metrics.taskCompletionRate > 80) {
      insights.push('You have an excellent task completion rate! Keep up the great work.');
    } else if (metrics.taskCompletionRate < 50) {
      insights.push('Your task completion rate is below 50%. Consider breaking large tasks into smaller ones.');
    }

    if (metrics.overdueTasks > 0) {
      insights.push(`You have ${metrics.overdueTasks} overdue tasks. Try setting realistic deadlines.`);
    }

    const topHour = metrics.mostProductiveHours[0];
    if (topHour !== undefined) {
      insights.push(`Your most productive hour is ${topHour}:00. Schedule important tasks during this time.`);
    }

    if (metrics.deadlineAccuracy > 75) {
      insights.push('You consistently meet deadlines. Great job with time management!');
    }

    const recurringTasks = metrics.recurringTaskUsage;
    if (recurringTasks > 5) {
      insights.push(`You use recurring tasks frequently (${recurringTasks} tasks). This helps build consistent habits.`);
    }

    return insights;
  }

  /**
   * Export analytics data
   */
  exportData(): string {
    const data = this.getDashboardData();
    return JSON.stringify(data, null, 2);
  }
}