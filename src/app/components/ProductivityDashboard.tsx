"use client"

import { useState, useEffect } from "react"
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  Target, Clock, CheckCircle, TrendingUp, Brain, Lightbulb,
  Star, Zap, Award, Activity, Calendar
} from "lucide-react"
import {
  getEnhancedAnalyticsDashboard,
  getPersonalizedInsights,
  ProductivityMetrics,
  TaskEfficiency,
  WeeklyReport
} from "@/lib/analytics/enhanced-analytics"

interface ProductivityDashboardProps {
  userId?: string
}

export function ProductivityDashboard({ userId = 'default' }: ProductivityDashboardProps) {
  const [analytics, setAnalytics] = useState<any>(null)
  const [insights, setInsights] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [userId])

  const loadDashboard = async () => {
    setIsLoading(true)
    try {
      const [dashboardData, personalInsights] = await Promise.all([
        getEnhancedAnalyticsDashboard(),
        getPersonalizedInsights(userId)
      ])
      setAnalytics(dashboardData)
      setInsights(personalInsights)
    } catch (error) {
      console.error('Failed to load productivity dashboard:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!analytics) {
    return null
  }

  const { taskStats, productivityMetrics, taskEfficiency, weeklyReports, achievements } = analytics

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between pb-4 border-b">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">
            <Brain className="mr-2 h-5 w-5" />
            Productivity Dashboard
          </h2>
          <p className="text-muted-foreground">
            Your personalized productivity insights and performance metrics
          </p>
        </div>
      </div>

      {/* Personalized Insights */}
      {insights.length > 0 && (
        <Card className="border bg-amber-50 border-amber-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <Lightbulb className="h-5 w-5" />
              Personalized Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {insights.map((insight, index) => (
                <div key={index} className="text-sm text-amber-800 flex items-start">
                  <span className="mr-2">💡</span>
                  <p>{insight}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Core Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Daily Productivity"
          value={`${productivityMetrics.dailyProductivity}%`}
          description="Today's task completion"
          icon={Target}
          color="green"
        />
        <MetricCard
          title="Weekly Productivity"
          value={`${productivityMetrics.weeklyProductivity}%`}
          description="Last 7 days"
          icon={Calendar}
          color="blue"
        />
        <MetricCard
          title="Estimation Accuracy"
          value={`${100 - Math.abs(productivityMetrics.estimatedVsActual.variance)}%`}
          description="Estimate vs actual"
          icon={CheckCircle}
          color="amber"
        />
        <MetricCard
          title="Completion Rate"
          value={`${productivityMetrics.completionRate}%`}
          description="All time"
          icon={Zap}
          color="purple"
        />
      </div>

      {/* Task Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Task Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <StatRow label="Total Tasks" value={taskStats.total} />
              <StatRow label="Completed" value={taskStats.completed} color="text-green-600" />
              <StatRow label="In Progress" value={taskStats.inProgress} color="text-blue-600" />
              <StatRow label="Pending" value={taskStats.pending} color="text-amber-600" />
              <StatRow label="Overdue" value={taskStats.overdue} color="text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Time Tracking</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-600">
                  {formatDuration(taskStats.totalTimeTracked)}
                </p>
                <p className="text-sm text-muted-foreground">Total time tracked</p>
              </div>
              <div className="border-t pt-3">
                <StatRow label="Attachments" value={taskStats.totalAttachments} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Estimation Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Estimated vs Actual</p>
                <Progress
                  value={Math.min(100, productivityMetrics.estimatedVsActual.variance + 50)}
                  className="h-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Est. {formatDuration(productivityMetrics.estimatedVsActual.estimated)}</span>
                  <span>Actual {formatDuration(productivityMetrics.estimatedVsActual.actual)}</span>
                </div>
              </div>
              <div className="border-t pt-3">
                <StatRow
                  label="Variance"
                  value={`${productivityMetrics.estimatedVsActual.variance > 0 ? '+' : ''}${productivityMetrics.estimatedVsActual.variance}%`}
                  color={productivityMetrics.estimatedVsActual.variance > 10 ? 'text-red-600' : 'text-green-600'}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Task Efficiency */}
      {taskEfficiency.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Task Efficiency (Last 20 Completed)</CardTitle>
            <CardDescription>How accurate your time estimates are</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
              {taskEfficiency.slice(0, 10).map((task: TaskEfficiency) => (
                <div key={task.taskId} className="flex items-center justify-between p-3 bg-muted/30 rounded">
                  <div className="flex-1">
                    <p className="font-medium truncate">{task.taskName}</p>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <span>Est. {task.estimatedMinutes}m</span>
                      <span>Actual {task.actualMinutes}m</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={task.accuracy > 80 ? 'secondary' : 'destructive'}>
                      {task.accuracy}%
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      Score: {task.efficiencyScore}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Weekly Progress */}
      {weeklyReports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Recent Weeks</CardTitle>
            <CardDescription>Your weekly productivity trends</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {weeklyReports.slice(-4).map((week: WeeklyReport, index: number) => (
                <div key={index} className="p-3 bg-muted/30 rounded border">
                  <p className="text-xs text-muted-foreground mb-2">
                    Week {index + 1} of {weeklyReports.length}
                  </p>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm">Created</span>
                    <span className="text-sm font-semibold">{week.tasksCreated}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm">Completed</span>
                    <span className="text-sm font-semibold">{week.tasksCompleted}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Productivity</span>
                    <span className="text-sm font-semibold">{week.productivityScore}%</span>
                  </div>
                  {week.insights.length > 0 && (
                    <div className="mt-3 pt-2 border-t text-xs text-muted-foreground">
                      {week.insights[0]}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Achievements */}
      {achievements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <Award className="h-5 w-5" />
              Recent Achievements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {achievements.map((achievement: any, index: number) => (
                <div key={index} className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 border rounded">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">{achievement.icon}</span>
                    <div>
                      <p className="font-medium text-sm">{achievement.name}</p>
                      <Badge variant="secondary" className="text-xs">
                        {achievement.rarity}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Earned: {new Date(achievement.earned_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Metric Card Component
function MetricCard({
  title, value, description, icon: Icon, color
}: {
  title: string
  value: string
  description: string
  icon: any
  color: 'green' | 'blue' | 'amber' | 'purple'
}) {
  const colorClasses = {
    green: 'text-green-600',
    blue: 'text-blue-600',
    amber: 'text-amber-600',
    purple: 'text-purple-600'
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
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

// Stat Row Component
function StatRow({ label, value, color = 'text-muted-foreground' }: {
  label: string
  value: any
  color?: string
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`font-semibold ${color}`}>{value}</span>
    </div>
  )
}

// Helper function to format duration
function formatDuration(minutes: number | null | undefined): string {
  if (!minutes || minutes === 0) return "0m"

  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours > 0 && mins > 0) {
    return `${hours}h ${mins}m`
  } else if (hours > 0) {
    return `${hours}h`
  } else {
    return `${mins}m`
  }
}