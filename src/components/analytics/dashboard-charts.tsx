"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Calendar,
  BarChart,
} from "lucide-react";
import {
  AnalyticsDashboard,
  type AnalyticsDashboardData,
  type ProductivityMetrics,
} from "@/lib/analytics/dashboard";
import { useAnalyticsData } from "@/lib/analytics/hooks";

const priorityLabels: Record<string, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "None",
};

const priorityColors: Record<string, string> = {
  high: "bg-red-500/10 text-red-500",
  medium: "bg-yellow-500/10 text-yellow-500",
  low: "bg-green-500/10 text-green-500",
  none: "bg-gray-500/10 text-gray-500",
};

/**
 * Main Analytics Dashboard component
 */
export function AnalyticsDashboardView() {
  const { data, loading, error } = useAnalyticsData();

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Card className="p-6">
          <CardContent>
            <p className="text-red-500">
              {error || "No analytics data available"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
        <Badge variant="outline">
          Last updated: {new Date().toLocaleTimeString()}
        </Badge>
      </div>

      {/* Productivity Metrics Grid */}
      <ProductivityMetricsCard metrics={data.metrics} />

      {/* Trends Chart */}
      <TrendsChart trends={data.trends} />

      {/* Productivity Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProductivityByListChart data={data.productivityByList} />
        <TimeTrackingStatsCard stats={data.timeTrackingStats} />
      </div>

      {/* Priority Distribution */}
      <PriorityDistributionCard priorities={data.topPriorities} />

      {/* Insights */}
      <InsightsPanel dashboard={new AnalyticsDashboard(
        [], [], [], []
      )} />
    </div>
  );
}

/**
 * Productivity Metrics Card
 */
function ProductivityMetricsCard({ metrics }: { metrics: ProductivityMetrics }) {
  const completionColor = metrics.taskCompletionRate > 75
    ? "text-green-600"
    : metrics.taskCompletionRate > 50
    ? "text-yellow-600"
    : "text-red-600";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Productivity Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricItem
            icon={<TrendingUp className={`h-4 w-4 ${completionColor}`} />}
            label="Completion Rate"
            value={`${metrics.taskCompletionRate.toFixed(0)}%`}
            subtitle={`${metrics.completedTasks}/${metrics.totalTasks} tasks`}
          />

          <MetricItem
            icon={<Clock className="h-4 w-4 text-blue-500" />}
            label="Avg Time/Task"
            value={`${metrics.averageTimePerTask.toFixed(0)}m`}
            subtitle="Estimated duration"
          />

          <MetricItem
            icon={<AlertCircle className="h-4 w-4 text-red-500" />}
            label="Overdue Tasks"
            value={metrics.overdueTasks.toString()}
            subtitle={
              metrics.totalTasks > 0
                ? `${((metrics.overdueTasks / metrics.totalTasks) * 100).toFixed(0)}%`
                : "No tasks"
            }
          />

          <MetricItem
            icon={<Calendar className="h-4 w-4 text-purple-500" />}
            label="Recurring Tasks"
            value={metrics.recurringTaskUsage.toString()}
            subtitle="Building habits"
          />
        </div>

        <div className="mt-6 space-y-2">
          <h4 className="font-medium">Deadline Accuracy</h4>
          <Progress value={metrics.deadlineAccuracy} className="h-2" />
          <p className={`text-sm ${completionColor}`}>
            {metrics.deadlineAccuracy.toFixed(1)}% of tasks completed on time
          </p>
        </div>

        {metrics.mostProductiveHours.length > 0 && (
          <div className="mt-4">
            <h4 className="font-medium mb-2">Most Productive Hours</h4>
            <div className="flex flex-wrap gap-2">
              {metrics.mostProductiveHours.map((hour, i) => (
                <Badge key={i} className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {hour.toString().padStart(2, "0")}:00
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Metric item helper
 */
function MetricItem({
  icon,
  label,
  value,
  subtitle,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="flex flex-col items-center p-3 bg-muted/50 rounded-lg">
      <div className="flex items-center gap-1 mb-1">{icon}</div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
    </div>
  );
}

/**
 * Trends Chart
 */
function TrendsChart({ trends }: { trends: any[] }) {
  const maxTasks = Math.max(...trends.map((t) => Math.max(t.tasksCreated, t.tasksCompleted)), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart className="h-5 w-5" />
          Productivity Trends (Last 30 Days)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <div className="h-full flex items-end justify-between gap-1">
            {trends.map((day, i) => {
              const tasksCreatedHeight = (day.tasksCreated / maxTasks) * 100;
              const tasksCompletedHeight = (day.tasksCompleted / maxTasks) * 100;

              return (
                <div key={day.date} className="flex-1 flex items-end justify-end gap-0.5 h-full">
                  <div
                    className="w-full bg-blue-500/50 rounded-t-sm hover:bg-blue-500/70 transition-colors"
                    style={{ height: `${tasksCreatedHeight}%` }}
                    title={`${day.date}: ${day.tasksCreated} created`}
                  />
                  <div
                    className="w-full bg-green-500/50 rounded-t-sm hover:bg-green-500/70 transition-colors"
                    style={{ height: `${tasksCompletedHeight}%` }}
                    title={`${day.date}: ${day.tasksCompleted} completed`}
                  />
                </div>
              );
            })}
          </div>

          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>{new Date(trends[0]?.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
            <span>{new Date(trends[14]?.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
            <span>{new Date(trends[29]?.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <h4 className="font-medium">Time Tracking Summary</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {trends.map((day, i) => {
              if (i % 7 !== 0) return null;
              const weekStart = new Date(day.date);
              const weekEnd = new Date(weekStart);
              weekEnd.setDate(weekEnd.getDate() + 6);

              const weeklyTime = trends
                .slice(i, i + 7)
                .reduce((sum, d) => sum + d.timeSpent, 0);

              return (
                <div key={day.date} className="text-xs">
                  <p className="text-muted-foreground">
                    {weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </p>
                  <p className="font-medium">
                    {Math.round(weeklyTime / 60)}h
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Productivity by List Chart
 */
function ProductivityByListChart({ data: listData }: { data: any[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          Productivity by List
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {listData.map((list) => (
            <div key={list.listName} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{list.listName}</span>
                <Badge variant="secondary">
                  {list.completionRate.toFixed(0)}%
                </Badge>
              </div>
              <Progress value={list.completionRate} className="h-2" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Time Tracking Stats Card
 */
function TimeTrackingStatsCard({ stats }: { stats: any }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Time Tracking Statistics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Total Tracked Time</p>
            <p className="text-2xl font-bold">
              {Math.round(stats.totalTrackedTime / 60)}h {stats.totalTrackedTime % 60}m
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Average Session</p>
            <p className="text-2xl font-bold">
              {stats.averageSessionDuration.toFixed(0)}m
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Longest Session</p>
            <p className="text-2xl font-bold">
              {Math.round(stats.longestSession / 60)}h {stats.longestSession % 60}m
            </p>
          </div>

          <div className="pt-4">
            <Progress value={stats.averageSessionDuration / 8} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              Compared to 8h workday average
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Priority Distribution Card
 */
function PriorityDistributionCard({ priorities }: { priorities: any[] }) {
  const total = priorities.reduce((sum, p) => sum + p.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Task Priority Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {priorities.map((priority) => {
            const percentage = total > 0 ? (priority.count / total) * 100 : 0;
            return (
              <div key={priority.priority} className="flex items-center gap-3">
                <Badge
                  variant="outline"
                  className={priorityColors[priority.priority] || ""}
                >
                  {priorityLabels[priority.priority] || priority.priority}
                </Badge>
                <div className="flex-1">
                  <Progress value={percentage} className="h-4" />
                </div>
                <span className="text-sm font-medium w-12 text-right">
                  {percentage.toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Insights Panel
 */
function InsightsPanel({ dashboard }: { dashboard: AnalyticsDashboard }) {
  const insights = dashboard.generateInsights();

  if (insights.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personalized Insights</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {insights.map((insight, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
            >
              <div className="mt-0.5">
                <CheckCircle className="h-4 w-4 text-green-600" />
              </div>
              <p className="text-sm">{insight}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}