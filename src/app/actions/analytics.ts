"use server";

import { revalidatePath } from "next/cache";
import { taskOperations, timeEntryOperations, listOperations, labelOperations } from "@/lib/db";
import type { Task, TimeEntry, List, Label } from "@/lib/types";
import { format, subDays, startOfDay, endOfDay } from "date-fns";

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

export async function getAnalyticsData(): Promise<AnalyticsDashboardData> {
  try {
    // Fetch all required data
    const [tasksData, timeEntriesData, listsData, labelsData] = await Promise.all([
      taskOperations.getAll(false), // Only active tasks for most metrics
      timeEntryOperations.getAll(), // All time entries
      listOperations.getAll(),
      labelOperations.getAll()
    ]);

    // Create temporary analytics instance to calculate metrics
    const dashboard = new AnalyticsDashboard(
      tasksData,
      Array.isArray(timeEntriesData) ? timeEntriesData : [],
      listsData,
      labelsData
    );

    return dashboard.getDashboardData();
  } catch (error) {
    console.error("Failed to fetch analytics data:", error);
    // Return empty data structure
    return {
      metrics: {
        taskCompletionRate: 0,
        averageTimePerTask: 0,
        mostProductiveHours: [],
        deadlineAccuracy: 0,
        recurringTaskUsage: 0,
        totalTasks: 0,
        completedTasks: 0,
        overdueTasks: 0,
      },
      trends: [],
      productivityByList: [],
      productivityByLabel: [],
      topPriorities: [],
      timeTrackingStats: {
        totalTrackedTime: 0,
        averageSessionDuration: 0,
        longestSession: 0,
      },
    };
  }
}

// Analytics dashboard class (same as before but exported for use in server actions)
class AnalyticsDashboard {
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

    return hourlyCounts
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4)
      .map(({ hour }) => hour);
  }

  private calculateDeadlineAccuracy(): number {
    const completedTasks = this.tasks.filter((t) => t.is_completed > 0 && t.deadline);

    if (completedTasks.length === 0) return 0;

    const onTime = completedTasks.filter((t) => {
      return new Date(t.deadline) <= new Date(t.updated_at);
    }).length;

    return (onTime / completedTasks.length) * 100;
  }

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

  getProductivityByList() {
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

  getProductivityByLabel() {
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

  getTopPriorities() {
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

  getTimeTrackingStats() {
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
}