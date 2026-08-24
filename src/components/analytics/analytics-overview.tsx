"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  TrendingUp, Clock, Target, CheckCircle, AlertCircle,
  Calendar, Star, Brain, BarChart2, PieChart, Activity,
  RefreshCw, Zap, Timer, List
} from "lucide-react"

interface Task {
  id: number
  name: string
  priority: "high" | "medium" | "low" | "none"
  is_completed: number
  estimate_minutes?: number
  actual_minutes?: number
  deadline?: Date
  created_at: Date
}

interface TimeEntry {
  id: number
  task_id: number
  started_at: string
  stopped_at?: string
  duration_minutes: number
}

interface AnalyticsOverviewProps {
  tasks: Task[]
  timeEntries: TimeEntry[]
  selectedTimeframe: '7d' | '30d' | '90d'
  onTimeframeChange: (tf: '7d' | '30d' | '90d') => void
}

export function AnalyticsOverview({
  tasks,
  timeEntries,
  selectedTimeframe,
  onTimeframeChange,
}: AnalyticsOverviewProps) {
  const [timeframe, setTimeframe] = useState(selectedTimeframe)
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    setTimeframe(selectedTimeframe)
  }, [selectedTimeframe])

  useEffect(() => {
    const computedStats = computeAnalytics(tasks, timeEntries, timeframe)
    setStats(computedStats)
  }, [tasks, timeEntries, timeframe])

  const handleTimeframeChange = (tf: '7d' | '30d' | '90d') => {
    onTimeframeChange(tf)
  }

  return (
    <div className="space-y-6">
      {/* Timeframe Selector */}
      <div className="flex gap-2">
        {(['7d', '30d', '90d'] as const).map((tf) => (
          <Button
            key={tf}
            variant={timeframe === tf ? "default" : "outline"}
            size="sm"
            onClick={() => handleTimeframeChange(tf)}
          >
            {tf === '7d' ? 'Last 7 Days' : tf === '30d' ? 'Last 30 Days' : 'Last 90 Days'}
          </Button>
        ))}
      </div>

      {/* Key Metrics */}
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
          title="Prod Hours"
          value={stats?.productiveHours?.toFixed(1) ?? 0}
          unit="hrs"
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

      {/* Productivity Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Productivity Insights
            </CardTitle>
            <CardDescription>
              Your work patterns and efficiency metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <InsightItem
                icon={Calendar}
                title="Peak Productivity Time"
                description={`You're most focused between ${stats?.peakHours?.join(' - ') || '9 AM - 11 AM'} AM`}
              />

              <InsightItem
                icon={Timer}
                title="Focus Session Length"
                description={`Average: ${stats?.avgSessionLength || 25} minutes per session`}
              />

              <InsightItem
                icon={Target}
                title="On-Time Completion"
                description={`${stats?.onTimeCompletion || 85}% of tasks completed on schedule`}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-500" />
              AI Recommendations
            </CardTitle>
            <CardDescription>
              Smart suggestions based on your patterns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(stats?.recommendations || []).slice(0, 3).map((rec: any, i: number) => (
                <RecommendationItem key={i} {...rec} />
              ))}

              {(!stats?.recommendations || stats.recommendations.length === 0) && (
                <div className="text-center py-4 text-muted-foreground">
                  <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No recommendations yet</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Task Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart2 className="h-5 w-5" />
            Task Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Priority Distribution */}
            <div>
              <h4 className="text-sm font-medium mb-2">By Priority</h4>
              <div className="space-y-1">
                {PriorityDistribution(stats?.priorityBreakdown || { high: 0, medium: 0, low: 0, none: 0 }, tasks)}
              </div>
            </div>

            {/* Completion Rate by List */}
            <div>
              <h4 className="text-sm font-medium mb-2">By Time Tracking</h4>
              <div className="text-center py-4">
                <p className="text-muted-foreground">
                  {timeEntries.length > 0
                    ? `Total tracked time: ${Math.round(timeEntries.reduce((s, e) => s + (e.duration_minutes || 0), 0) / 60)} hours`
                    : 'No time tracking data'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overdue & Upcoming */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Overdue Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.overdueDetails?.length > 0 ? (
              <div className="space-y-2">
                {stats.overdueDetails.slice(0, 5).map((task: any) => (
                  <div key={task.id} className="p-3 bg-destructive/5 rounded">
                    <div className="font-medium text-sm">{task.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Overdue by {Math.floor(task.daysOverdue)} days
                    </div>
                  </div>
                ))}
                {stats.overdueDetails.length > 5 && (
                  <Button variant="ghost" size="sm" className="w-full">
                    View all {stats.overdueDetails.length} overdue tasks
                  </Button>
                )}
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No overdue tasks! 🎉</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Upcoming Deadlines
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(stats?.upcomingTasks || []).slice(0, 5).map((task: any) => (
                <div key={task.id} className="p-3 bg-muted/30 rounded">
                  <div className="font-medium text-sm">{task.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Due {formatDeadline(task.deadline)}
                  </div>
                </div>
              ))}

              {(stats?.upcomingTasks || []).length === 0 && (
                <div className="text-center py-4 text-muted-foreground">
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No upcoming deadlines</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Helper components
function MetricCard({
  title, value, unit, icon: Icon, color, change
}: {
  title: string
  value: number
  unit?: string
  icon: any
  color: 'green' | 'blue' | 'amber' | 'red'
  change?: string | number
}) {
  const colorClasses = {
    green: 'text-green-600',
    blue: 'text-blue-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="p-2 rounded-full bg-muted">
          <Icon className={`h-4 w-4 ${colorClasses[color]}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {typeof value === 'number' ? value.toLocaleString() : value}
          {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
        </div>
        {change !== undefined && (
          <div className="text-xs text-muted-foreground mt-1">
            {change}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function InsightItem({
  icon: Icon, title, description
}: {
  icon: any
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3 p-3 bg-muted/30 rounded">
      <div className="p-2 bg-primary/10 rounded-full">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <h5 className="text-sm font-medium">{title}</h5>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function RecommendationItem({
  title, description, action, confidence
}: {
  title: string
  description: string
  action?: string
  confidence?: number
}) {
  return (
    <div className="p-3 bg-muted/30 rounded">
      <div className="flex items-start gap-3">
        <Lightbulb className="h-4 w-4 text-yellow-500 flex-shrink-0" />
        <div className="flex-1">
          <h4 className="text-sm font-medium">{title}</h4>
          <p className="text-xs text-muted-foreground">{description}</p>
          {action && confidence && (
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                💡 {action}
              </span>
              <span className="text-xs text-muted-foreground">
                {Math.round(confidence * 100)}% confidence
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Lightbulb({ className }: { className?: string }) {
  return (
    <svg
      className={cn(className, "h-4 w-4")}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M11.25 6c-.83-.39-1.75-.25-2.67.33A6.05 6.05 0 0 0 5 10.5a6 6 0 0 0 12 0 6.05 6.05 0 0 0-1.98-4.17A6.05 6.05 0 0 0 11.25 6z" />
    </svg>
  )
}

function PriorityDistribution(data: { high: number, medium: number, low: number, none: number }, tasks: Task[]) {
  const total = tasks.length

  return (
    <div className="space-y-2">
      {(['high', 'medium', 'low', 'none'] as const).map((priority) => {
        const count = data[priority]
        const percentage = total > 0 ? (count / total) * 100 : 0

        const colors = {
          high: 'bg-red-500',
          medium: 'bg-yellow-500',
          low: 'bg-green-500',
          none: 'bg-gray-400',
        }

        const labels = {
          high: 'High',
          medium: 'Medium',
          low: 'Low',
          none: 'None',
        }

        return (
          <div key={priority} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gray-300" />
            <span className="flex-1 text-sm">{labels[priority]}</span>
            <div className="w-20 bg-gray-200 h-2 rounded">
              <div
                className={`h-2 rounded ${colors[priority]}`}
                style={{ width: `${percentage}%` }}
              />
            </div>
            <span className="text-sm w-8 text-right">{count}</span>
          </div>
        )
      })}
    </div>
  )
}

function formatDeadline(date: Date | undefined): string {
  if (!date) return 'No deadline'
  const d = new Date(date)
  const now = new Date()
  const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return 'Overdue'
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  return `${diffDays} days`
}

function computeAnalytics(tasks: Task[], timeEntries: TimeEntry[], timeframe: '7d' | '30d' | '90d') {
  const now = new Date()
  const startDate = new Date(now.getTime() - { '7d': 7, '30d': 30, '90d': 90 }[timeframe] * 24 * 60 * 60 * 1000)

  const totalTasks = tasks.length
  const completedTasks = tasks.filter(t => t.is_completed).length
  const activeTasks = totalTasks - completedTasks

  // Completion rate
  const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0

  // Overdue tasks
  const overdueTasks = tasks.filter(t =>
    t.deadline && new Date(t.deadline) < now && !t.is_completed
  ).length

  // Productive hours
  const totalTrackedMinutes = timeEntries.reduce((sum, te) => sum + (te.duration_minutes || 0), 0)
  const productiveHours = totalTrackedMinutes / 60

  // Peak hours analysis
  const hourlyData: Record<number, number> = {}
  timeEntries.forEach(entry => {
    const hour = new Date(entry.started_at).getHours()
    hourlyData[hour] = (hourlyData[hour] || 0) + 1
  })
  const peakHours = Object.entries(hourlyData)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 2)
    .map(([h]) => parseInt(h, 10))

  // Recommendations based on patterns
  const recommendations = generateRecommendations(tasks, timeEntries)

  // Priority breakdown
  const priorityBreakdown = {
    high: tasks.filter(t => t.priority === 'high').length,
    medium: tasks.filter(t => t.priority === 'medium').length,
    low: tasks.filter(t => t.priority === 'low').length,
    none: tasks.filter(t => t.priority === 'none').length,
  }

  // Overdue details
  const overdueDetails = tasks
    .filter(t => t.deadline && new Date(t.deadline) < now && !t.is_completed)
    .map(t => ({
      id: t.id,
      name: t.name,
      daysOverdue: (now.getTime() - new Date(t.deadline!).getTime()) / (1000 * 60 * 60 * 24),
    }))
    .sort((a, b) => (b.daysOverdue as number) - (a.daysOverdue as number))

  // Upcoming tasks
  const upcomingTasks = tasks
    .filter(t => t.deadline && new Date(t.deadline) > now && !t.is_completed)
    .map(t => ({
      id: t.id,
      name: t.name,
      deadline: t.deadline!,
    }))
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())

  // Average session length (simple estimate)
  const avgSessionLength = timeEntries.length > 0
    ? totalTrackedMinutes / timeEntries.length
    : 25

  // On-time completion rate
  const onTimeCompletion = tasks.filter(t => {
    if (!t.deadline || t.is_completed) return true
    return new Date(t.deadline) > new Date()
  }).length / totalTasks * 100

  return {
    totalTasks,
    completedTasks,
    activeTasks,
    completionRate,
    overdueTasks,
    productiveHours,
    peakHours,
    recommendations,
    priorityBreakdown,
    overdueDetails,
    upcomingTasks,
    avgSessionLength,
    onTimeCompletion,
    completionChange: completionRate - 50,
    overdueChange: overdueTasks.toString(),
  }
}

function generateRecommendations(tasks: Task[], timeEntries: TimeEntry[]): any[] {
  const recommendations = []

  // Check for overdue tasks
  const overdue = tasks.filter(t => t.deadline && new Date(t.deadline) < new Date() && !t.is_completed)
  if (overdue.length > 0) {
    recommendations.push({
      title: 'Address Overdue Tasks',
      description: `${overdue.length} tasks are past their deadline`,
      action: 'Review and reschedule',
      confidence: 0.9,
    })
  }

  // Check for high priority tasks without deadlines
  const highPriorityNoDeadline = tasks.filter(t => t.priority === 'high' && !t.deadline && !t.is_completed)
  if (highPriorityNoDeadline.length > 0) {
    recommendations.push({
      title: 'Add Deadlines',
      description: `${highPriorityNoDeadline.length} high-priority tasks lack deadlines`,
      action: 'Set deadlines',
      confidence: 0.8,
    })
  }

  // Check for tasks with low time estimates
  const shortTasks = tasks.filter(t => t.estimate_minutes && t.estimate_minutes < 15 && !t.is_completed)
  if (shortTasks.length > 3) {
    recommendations.push({
      title: 'Batch Small Tasks',
      description: `${shortTasks.length} small tasks waiting`,
      action: 'Create a batch session',
      confidence: 0.7,
    })
  }

  // Check for no time tracking
  if (timeEntries.length === 0) {
    recommendations.push({
      title: 'Start Time Tracking',
      description: 'You\'re not tracking time yet',
      action: 'Try the Pomodoro timer',
      confidence: 0.95,
    })
  }

  return recommendations
}