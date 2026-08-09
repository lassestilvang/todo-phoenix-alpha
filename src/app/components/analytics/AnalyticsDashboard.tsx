'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  Clock,
  Target,
  BarChart3,
  PieChart,
  Activity,
  Users,
  CheckCircle,
  AlertCircle,
  Calendar,
  Star,
  Brain,
} from 'lucide-react';

interface Task {
  id: number;
  name: string;
  priority: 'high' | 'medium' | 'low' | 'none';
  is_completed: number;
  estimate_minutes?: number;
  actual_minutes?: number;
  deadline?: Date;
  created_at: Date;
}

interface AnalyticsDashboardProps {
  tasks: Task[];
  labels?: { id: number; name: string; color: string }[];
  projects?: { id: number; name: string }[];
}

export function AnalyticsDashboard({ tasks, labels, projects }: AnalyticsDashboardProps) {
  const [timeframe, setTimeframe] = useState<'day' | 'week' | 'month'>('week');
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const computedStats = computeAnalytics(tasks, labels, projects, timeframe);
    setStats(computedStats);
  }, [tasks, labels, projects, timeframe]);

  return (
    <div className="analytics-dashboard space-y-6">
      {/* Header with Timeframe Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Analytics Dashboard</h2>
          <p className="text-muted-foreground mt-1">
            Get insights into your productivity patterns and task performance
          </p>
        </div>

        <div className="flex gap-2">
          {(['day', 'week', 'month'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeframe === tf
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {tf.charAt(0).toUpperCase() + tf.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Completion Rate"
          value={stats?.completionRate ?? 0}
          unit="%"
          icon={CheckCircle}
          color="green"
          change={stats?.completionChange}
        />

        <MetricCard
          title="Active Tasks"
          value={stats?.activeTasks ?? 0}
          icon={Activity}
          color="blue"
        />

        <MetricCard
          title="Avg. Time/Task"
          value={stats?.avgTimePerTask?.toFixed(0) ?? 0}
          unit="min"
          icon={Clock}
          color="amber"
        />

        <MetricCard
          title="Overdue Tasks"
          value={stats?.overdueTasks ?? 0}
          icon={AlertCircle}
          color="red"
          change={stats?.overdueChange}
        />
      </div>

      {/* Priority Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500" />
              Priority Distribution
            </CardTitle>
            <CardDescription>
              How your tasks are distributed by priority
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(['high', 'medium', 'low', 'none'] as const).map((priority) => {
                const count = stats?.priorityDistribution?.[priority] || 0;
                const total = stats?.totalTasks || 1;
                const percentage = (count / total) * 100;

                return (
                  <div key={priority} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="capitalize flex items-center gap-1">
                        {priority === 'high' && '⚡'}
                        {priority === 'medium' && '🔶'}
                        {priority === 'low' && '🟢'}
                        {priority === 'none' && '⚪'}
                        {priority}
                      </span>
                      <span>{count} ({percentage.toFixed(1)}%)</span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Label Trend Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-500" />
              AI Insights
            </CardTitle>
            <CardDescription>
              Smart suggestions based on your task patterns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats?.insights?.map((insight: any, index: number) => (
                <div key={index} className="p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="p-1 bg-primary/10 rounded-full">
                      <TrendingUp className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">{insight.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {insight.description}
                      </p>
                      {insight.suggestedAction && (
                        <div className="mt-2 p-2 bg-primary/5 rounded border-l-2 border-primary">
                          <p className="text-xs font-medium text-primary">
                            💡 {insight.suggestedAction}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {!stats?.insights && (
                <div className="text-center py-8 text-muted-foreground">
                  <Brain className="h-8 w-8 mx-auto mb-2" />
                  <p>No insights available yet</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Timeline Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Task Completion Timeline
          </CardTitle>
          <CardDescription>
            Tasks completed over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            {stats?.timeline ? (
              <div className="relative h-full">
                <div className="absolute inset-0 flex items-end justify-between gap-2">
                  {stats.timeline.map((point: any, index: number) => (
                    <div key={index} className="flex-1 flex flex-col items-center">
                      <div className="bg-primary rounded-t transition-all duration-300 hover:scale-115">
                        <div className="h-20 w-8 bg-primary rounded-t" style={{ height: `${point.count * 20}px` }} />
                      </div>
                      <span className="text-xs text-muted-foreground mt-2">
                        {point.date}
                      </span>
                      <span className="text-xs font-medium mt-1">
                        {point.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>No data available for this timeframe</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: number | string;
  unit?: string;
  icon: any;
  color: 'green' | 'blue' | 'amber' | 'red';
  change?: number | string;
}

function MetricCard({ title, value, unit, icon: Icon, color, change }: MetricCardProps) {
  const colorClasses = {
    green: 'text-green-600',
    blue: 'text-blue-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
  };

  const bgColor = {
    green: 'bg-green-50',
    blue: 'bg-blue-50',
    amber: 'bg-amber-50',
    red: 'bg-red-50',
  };

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`p-2 rounded-full ${bgColor[color]}`}>
          <Icon className={`h-4 w-4 ${colorClasses[color]}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">
          {typeof value === 'number' ? value.toLocaleString() : value}
          {unit && (
            <span className="text-sm font-normal text-muted-foreground">
              {unit}
            </span>
          )}
        </div>
        {change !== undefined && (
          <div className="text-xs text-muted-foreground mt-1">
            <TrendingUp className="inline h-3 w-3 mr-1" />
            {change}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Compute analytics from tasks
function computeAnalytics(
  tasks: Task[],
  labels?: { id: number; name: string; color: string }[],
  projects?: { id: number; name: string }[],
  timeframe: string = 'week'
) {
  const now = new Date();
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.is_completed).length;
  const activeTasks = totalTasks - completedTasks;

  // Completion rate
  const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  // Overdue tasks
  const overdueTasks = tasks.filter(t =>
    t.deadline && new Date(t.deadline) < now && !t.is_completed
  ).length;

  // Task duration analysis
  const tasksWithDuration = tasks.filter(t => t.estimate_minutes && t.actual_minutes);
  const avgTimePerTask = tasksWithDuration.length > 0
    ? tasksWithDuration.reduce((sum, t) => sum + (t.actual_minutes || 0), 0) / tasksWithDuration.length
    : 0;

  // Priority distribution
  const priorityDistribution = {
    high: tasks.filter(t => t.priority === 'high').length,
    medium: tasks.filter(t => t.priority === 'medium').length,
    low: tasks.filter(t => t.priority === 'low').length,
    none: tasks.filter(t => t.priority === 'none').length,
  };

  // Timeline data
  const timeline = generateTimeline(tasks, timeframe);

  // AI Insights (simplified)
  const insights = generateInsights(tasks, labels, projects);

  // Change metrics
  const previousPeriodTasks = tasks.filter(t => {
    const created = new Date(t.created_at);
    const daysAgo = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
    const periodThreshold = timeframe === 'day' ? 7 : timeframe === 'week' ? 30 : 90;
    return daysAgo <= periodThreshold;
  });

  const completionChange = previousPeriodTasks.length > 0
    ? ((previousPeriodTasks.filter(t => t.is_completed).length / previousPeriodTasks.length) - completionRate / 100) * 100
    : 0;

  return {
    totalTasks,
    completedTasks,
    activeTasks,
    completionRate,
    overdueTasks,
    avgTimePerTask,
    priorityDistribution,
    timeline,
    insights,
    completionChange,
    overdueChange: overdueTasks > 0 ? `+${overdueTasks} overdue` : 'No overdue tasks',
  };
}

function generateTimeline(tasks: Task[], timeframe: string) {
  const now = new Date();
  const days = timeframe === 'day' ? 7 : timeframe === 'week' ? 30 : 90;
  const timeline = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    const completedOnDay = tasks.filter(t => {
      if (!t.is_completed) return false;
      const completedDate = new Date(t.created_at);
      const taskDay = completedDate.toISOString().split('T')[0];
      return taskDay === dateStr;
    }).length;

    timeline.push({
      date: date.toLocaleDateString('en', { weekday: 'short' }),
      count: completedOnDay,
    });
  }

  return timeline;
}

function generateInsights(tasks: Task[], labels?: any[], projects?: any[]): any[] {
  const insights = [];

  // Pattern: Tasks often created together
  const labelPatterns: Record<string, number> = {};
  tasks.forEach(task => {
    // This would be enhanced with actual label data
  });

  // Pattern: Time estimation accuracy
  const accurateEstimates = tasks.filter(t =>
    t.estimate_minutes && t.actual_minutes &&
    Math.abs((t.actual_minutes || 0) - (t.estimate_minutes || 0)) < (t.estimate_minutes || 1) * 0.2
  ).length;

  if (tasks.length > 0) {
    const accuracy = (accurateEstimates / tasks.length) * 100;
    if (accuracy > 80) {
      insights.push({
        title: 'Excellent Estimation Accuracy',
        description: `You estimated time accurately ${accuracy.toFixed(0)}% of the time`,
        suggestedAction: 'Keep using your current estimation technique',
        confidence: accuracy / 100,
      });
    } else if (accuracy < 50) {
      insights.push({
        title: 'Estimation Improvement Needed',
        description: 'Your time estimates are often inaccurate',
        suggestedAction: 'Break down larger tasks and track time more carefully',
        confidence: 0.8,
      });
    }
  }

  // Bottlenecks: Tasks blocking many others
  const dependencyMap: Record<number, number> = {};
  tasks.forEach(task => {
    // Would check actual dependencies
  });

  return insights;
}

export default AnalyticsDashboard;