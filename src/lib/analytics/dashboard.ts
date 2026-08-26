import type { Task, TaskWithDetails, TimeEntry } from '@/lib/types/index';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { PredictiveAnalytics } from './predictive-analytics';

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

    // New: Priority distribution insight
    const topPriority = this.getTopPriorities()[0];
    if (topPriority) {
      insights.push(`Your most common priority is ${topPriority.priority} (${topPriority.count} tasks).`);
    }

    // New: Time tracking insight
    const totalHours = Math.round(metrics.averageTimePerTask * metrics.totalTasks / 60);
    insights.push(`You've tracked approximately ${totalHours} hours of task work this period.`);

    return insights;
  }

  /**
   * Get detailed weekly pattern analysis
   */
  getWeeklyPattern(): { dayOfWeek: string; tasksCreated: number; tasksCompleted: number }[] {
    const now = new Date();
    const patterns = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return patterns.map(day => {
      const dayTasks = this.tasks.filter((t) => {
        const taskDate = new Date(t.created_at);
        return taskDate.toLocaleDateString('en-US', { weekday: 'long' }) === day;
      });
      return {
        dayOfWeek: day,
        tasksCreated: dayTasks.length,
        tasksCompleted: dayTasks.filter((t) => t.is_completed > 0).length,
      };
    });
  }

  /**
   * Get monthly trend data
   */
  getMonthlyTrends(): { month: string; tasksCreated: number; tasksCompleted: number; timeSpent: number }[] {
    const now = new Date();
    const months = [];

    for (let i = 5; i >= 0; i--) {
      const date = subDays(now, i * 30);
      const monthName = format(date, 'MMM yyyy');

      const monthTasks = this.tasks.filter((t) => {
        const taskDate = new Date(t.created_at);
        return format(taskDate, 'MMM yyyy') === format(date, 'MMM yyyy');
      });

      const monthEntries = this.timeEntries.filter((e) => {
        const entryDate = new Date(e.started_at);
        return format(entryDate, 'MMM yyyy') === format(date, 'MMM yyyy');
      });

      const timeSpent = monthEntries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);

      months.push({
        month: monthName,
        tasksCreated: monthTasks.length,
        tasksCompleted: monthTasks.filter((t) => t.is_completed > 0).length,
        timeSpent,
      });
    }

    return months;
  }

  /**
   * Get efficiency score (0-100)
   */
  getEfficiencyScore(): number {
    const metrics = this.calculateProductivityMetrics();
    let score = 0;

    // Completion rate contributes 40%
    score += metrics.taskCompletionRate * 0.4;

    // Deadline accuracy contributes 30%
    score += metrics.deadlineAccuracy * 0.3;

    // Low overdue rate contributes 20% (inverted)
    const overdueRate = metrics.totalTasks > 0 ? metrics.overdueTasks / metrics.totalTasks : 0;
    score += (1 - overdueRate) * 0.2;

    // Productivity contributes 10% (normalized)
    score += Math.min(metrics.averageTimePerTask / 120, 1) * 100 * 0.1;

    return Math.round(score);
  }

  /**
   * Get predictive analytics for task completion timing
   */
  async getPredictiveInsights(): Promise<{
    predictions: { taskId: number; name: string; predictedMinutes: number; confidence: number; predictedCompletion: string | null }[];
    bottlenecks: { listName?: string; labelName?: string; count: number; estimatedImpact: number }[];
    recommendations: string[];
  }> {
    const predictiveEngine = new PredictiveAnalytics();

    // Get predictions for high-priority incomplete tasks
    const highPriorityTasks = this.tasks.filter(
      (t) => t.is_completed === 0 && (t.priority === 'high' || (t.deadline && new Date(t.deadline) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)))
    );

    const predictions = await Promise.all(
      highPriorityTasks.map(async (task) => {
        try {
          const prediction = await predictiveEngine.getDurationPrediction(task.id);
          return {
            taskId: task.id,
            name: task.name,
            predictedMinutes: prediction.predictedMinutes,
            confidence: prediction.confidence,
            predictedCompletion: prediction.predictedCompletionDate
          };
        } catch {
          return {
            taskId: task.id,
            name: task.name,
            predictedMinutes: task.estimate_minutes || 0,
            confidence: 0,
            predictedCompletion: task.deadline || null
          };
        }
      })
    );

    // Identify bottlenecks (lists/labels with high overdue rates)
    const bottlenecks = this.identifyBottlenecks();

    // Generate recommendations based on predictions
    const recommendations = this.generatePredictiveRecommendations(predictions, bottlenecks);

    return { predictions, bottlenecks, recommendations };
  }

  /**
   * Identify bottleneck lists and labels
   */
  private identifyBottlenecks(): { listName?: string; labelName?: string; count: number; estimatedImpact: number }[] {
    const bottlenecks: { listName?: string; labelName?: string; count: number; estimatedImpact: number }[] = [];

    // Check lists for high overdue rates
    this.lists.forEach((list) => {
      const listTasks = this.tasks.filter((t) => t.list_id === list.id);
      const overdueTasks = listTasks.filter(
        (t) => !t.deadline || (t.is_completed === 0 && new Date(t.deadline) < new Date())
      );

      if (overdueTasks.length > 2) {
        const estimatedImpact = overdueTasks.reduce(
          (sum, t) => sum + (t.estimate_minutes || 0),
          0
        );

        bottlenecks.push({
          listName: list.name,
          count: overdueTasks.length,
          estimatedImpact
        });
      }
    });

    // Check labels for high overdue rates
    this.labels.forEach((label) => {
      const labelTasks = this.tasks.filter(
        (t) => t.labels && t.labels.some((l: any) => l.id === label.id)
      );
      const overdueTasks = labelTasks.filter(
        (t) => t.is_completed === 0 && t.deadline && new Date(t.deadline) < new Date()
      );

      if (overdueTasks.length > 2) {
        const estimatedImpact = overdueTasks.reduce(
          (sum, t) => sum + (t.estimate_minutes || 0),
          0
        );

        bottlenecks.push({
          labelName: label.name,
          count: overdueTasks.length,
          estimatedImpact
        });
      }
    });

    return bottlenecks.sort((a, b) => b.estimatedImpact - a.estimatedImpact);
  }

  /**
   * Generate recommendations from predictive data
   */
  private generatePredictiveRecommendations(
    predictions: { taskId: number; name: string; predictedMinutes: number; confidence: number; predictedCompletion: string | null }[],
    bottlenecks: { listName?: string; labelName?: string; count: number; estimatedImpact: number }[]
  ): string[] {
    const recommendations: string[] = [];

    // Low confidence predictions
    const lowConfidence = predictions.filter((p) => p.confidence < 0.5);
    if (lowConfidence.length > 0) {
      recommendations.push(
        `${lowConfidence.length} tasks lack sufficient historical data for accurate predictions. Consider tracking actual durations.`
      );
    }

    // Tasks predicted to exceed deadlines
    const overduePredicted = predictions.filter(
      (p) => p.predictedCompletion === null && p.confidence > 0.5
    );
    if (overduePredicted.length > 0) {
      recommendations.push(
        `${overduePredicted.length} tasks are predicted to be overdue. Consider rescheduling or delegating these tasks.`
      );
    }

    // Bottleneck recommendations
    if (bottlenecks.length > 0) {
      const topBottleneck = bottlenecks[0];
      const bottleneckName = topBottleneck.listName || topBottleneck.labelName || 'unknown';
      recommendations.push(
        `Bottleneck detected in "${bottleneckName}" with ${topBottleneck.count} overdue tasks (${Math.round(topBottleneck.estimatedImpact / 60)}h estimated impact). Consider redistributing these tasks.`
      );
    }

    // High-priority low-confidence tasks
    const urgentLowConfidence = predictions.filter(
      (p) => p.confidence < 0.3 && p.predictedCompletion && new Date(p.predictedCompletion) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    );
    if (urgentLowConfidence.length > 0) {
      recommendations.push(
        `${urgentLowConfidence.length} urgent tasks have low prediction confidence. Review these manually for accurate scheduling.`
      );
    }

    return recommendations;
  }

  /**
   * Export analytics data
   */
  exportData(): string {
    const data = this.getDashboardData();
    return JSON.stringify(data, null, 2);
  }
}