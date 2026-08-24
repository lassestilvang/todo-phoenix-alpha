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
  RefreshCw, Zap, Timer, List, Lightbulb, ArrowUpRight
} from "lucide-react"

interface Prediction {
  id: number
  name: string
  predictedDuration: number
  completionProbability: number
  recommendedSchedule: {
    startDate: string
    startTime: string
    confidence: number
  } | null
  priority: "high" | "medium" | "low" | "none"
  deadline?: Date
  estimate_minutes?: number
}

interface ProductiveWindows {
  mostProductiveHours: number[]
  peakFocusHours: number[]
  recommendedWorkDuration: number
}

interface SchedulingSuggestion {
  task: any
  suggestion: string
  priority: "high" | "medium" | "low"
  predictedStart: string | null
}

interface PredictiveSchedulingProps {
  predictions: Prediction[]
  productiveWindows: ProductiveWindows
  schedulingSuggestions: SchedulingSuggestion[] | null
  summary: {
    totalTasks: number
    highRiskTasks: number
    mediumRiskTasks: number
    lowRiskTasks: number
  }
  onTimeframeChange?: (tf: '7d' | '30d' | '90d') => void
}

export function PredictiveScheduling({
  predictions,
  productiveWindows,
  schedulingSuggestions,
  summary
}: PredictiveSchedulingProps) {
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d'>('30d')
  const [sortBy, setSortBy] = useState<'probability' | 'duration' | 'deadline'>('probability')

  // Sort predictions based on selected criteria
  const sortedPredictions = [...predictions].sort((a, b) => {
    if (sortBy === 'probability') {
      return a.completionProbability - b.completionProbability
    } else if (sortBy === 'duration') {
      return (a.predictedDuration || 0) - (b.predictedDuration || 0)
    } else {
      // Sort by deadline (soonest first)
      const dateA = a.deadline ? new Date(a.deadline).getTime() : Infinity
      const dateB = b.deadline ? new Date(b.deadline).getTime() : Infinity
      return dateA - dateB
    }
  })

  const handleTimeframeChange = (tf: '7d' | '30d' | '90d') => {
    setTimeframe(tf)
  }

  // Format time estimate for display
  const formatEstimate = (minutes?: number) => {
    if (!minutes) return "0m"
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  }

  // Format date for display
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
    return new Date(dateString).toLocaleDateString(undefined, options)
  }

  // Format time for display
  const formatTime = (timeString: string) => {
    return new Date(`1970-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Get priority color class
  const getPriorityClass = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-left-4 border-red-500 bg-red-50'
      case 'medium': return 'border-left-4 border-yellow-500 bg-yellow-50'
      case 'low': return 'border-left-4 border-green-500 bg-green-50'
      default: return 'border-left-4 border-gray-500 bg-gray-50'
    }
  }

  // Get priority badge variant
  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive'
      case 'medium': return 'default'
      case 'low': return 'secondary'
      default: return 'secondary'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between pb-4 border-b">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">
            <Brain className="mr-2 h-5 w-5" />
            Predictive Scheduling & Time Insights
          </h2>
          <p className="text-muted-foreground">
            AI-powered task completion predictions and optimal scheduling recommendations
          </p>
        </div>
        <div className="flex flex-col lg:flex-row lg:space-x-4 mt-4 lg:mt-0">
          <div className="flex space-x-2">
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
          <div className="flex space-x-2 mt-4 lg:mt-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortBy('probability')}
              className={sortBy === 'probability' ? 'bg-primary text-primary-foreground' : ''}
            >
              Sort by Completion Probability
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortBy('duration')}
              className={sortBy === 'duration' ? 'bg-primary text-primary-foreground' : ''}
            >
              Sort by Estimated Duration
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortBy('deadline')}
              className={sortBy === 'deadline' ? 'bg-primary text-primary-foreground' : ''}
            >
              Sort by Deadline
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Pending Tasks"
          value={summary.totalTasks}
          icon={List}
          color="blue"
        />
        <MetricCard
          title="High Risk Tasks"
          value={summary.highRiskTasks}
          unit="tasks"
          icon={AlertCircle}
          color="red"
          change={`${Math.round((summary.highRiskTasks / Math.max(summary.totalTasks, 1)) * 100)}%`}
        />
        <MetricCard
          title="Medium Risk Tasks"
          value={summary.mediumRiskTasks}
          unit="tasks"
          icon={Timer}
          color="amber"
          change={`${Math.round((summary.mediumRiskTasks / Math.max(summary.totalTasks, 1)) * 100)}%`}
        />
        <MetricCard
          title="Low Risk Tasks"
          value={summary.lowRiskTasks}
          unit="tasks"
          icon={CheckCircle}
          color="green"
          change={`${Math.round((summary.lowRiskTasks / Math.max(summary.totalTasks, 1)) * 100)}%`}
        />
      </div>

      {/* Productive Windows */}
      <Card className="border">
        <CardHeader className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Optimal Work Windows
          </CardTitle>
          <CardDescription>
            Based on your historical productivity patterns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <h4 className="font-medium">Most Productive Hours</h4>
              <div className="flex flex-wrap gap-2">
                {productiveWindows.mostProductiveHours.map((hour) => (
                  <Badge key={hour} variant="secondary" className="text-xs px-3 py-1">
                    {hour}:00 - {hour + 1}:00
                  </Badge>
                ))}
              </div>
              {productiveWindows.mostProductiveHours.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Insufficient data</p>
              )}
            </div>
            <div className="space-y-3">
              <h4 className="font-medium">Peak Focus Hours</h4>
              <div className="flex flex-wrap gap-2">
                {productiveWindows.peakFocusHours.map((hour) => (
                  <Badge key={hour} variant="default" className="text-xs px-3 py-1">
                    {hour}:00 - {hour + 1}:00
                  </Badge>
                ))}
              </div>
              {productiveWindows.peakFocusHours.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Insufficient data</p>
              )}
            </div>
            <div className="space-y-3">
              <h4 className="font-medium">Recommended Session Length</h4>
              <p className="text-2xl font-bold">
                {productiveWindows.recommendedWorkDuration} minutes
              </p>
              <p className="text-xs text-muted-foreground">
                Based on your average focused work sessions
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Task Predictions */}
      <Card className="border">
        <CardHeader className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Task Completion Predictions
          </CardTitle>
          <CardDescription>
            AI predictions for pending tasks based on historical patterns
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sortedPredictions.length === 0 ? (
            <div className="text-center py-8">
              <Brain className="h-10 w-10 mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">
                No pending tasks to analyze. Add some tasks to get predictions!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedPredictions.slice(0, 8).map((prediction) => (
                <PredictionCard
                  key={prediction.id}
                  prediction={prediction}
                  formatEstimate={formatEstimate}
                  formatDate={formatDate}
                  formatTime={formatTime}
                  getPriorityClass={getPriorityClass}
                  getPriorityVariant={getPriorityVariant}
                />
              ))}
              {sortedPredictions.length > 8 && (
                <div className="text-center py-4">
                  <Button variant="outline" size="sm" className="w-full">
                    View all {sortedPredictions.length} predictions
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scheduling Suggestions */}
      {schedulingSuggestions && schedulingSuggestions.length > 0 && (
        <Card className="border">
          <CardHeader className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Scheduling Recommendations
            </CardTitle>
            <CardDescription>
              AI-generated suggestions to improve your task scheduling
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {schedulingSuggestions.slice(0, 6).map((suggestion) => (
                <SuggestionCard
                  key={suggestion.task.id}
                  suggestion={suggestion}
                  formatEstimate={formatEstimate}
                  getPriorityClass={getPriorityClass}
                  getPriorityVariant={getPriorityVariant}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Button */}
      <div className="flex justify-center">
        <Button
          onClick={() => {
            // Trigger refresh of predictions
            // This would typically call the API again
          }}
          className="flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Predictions
        </Button>
      </div>
    </div>
  )
}

// Metric Card Component
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

// Prediction Card Component
function PredictionCard({
  prediction,
  formatEstimate,
  formatDate,
  formatTime,
  getPriorityClass,
  getPriorityVariant
}: {
  prediction: Prediction
  formatEstimate: (minutes?: number) => string
  formatDate: (dateString: string) => string
  formatTime: (timeString: string) => string
  getPriorityClass: (priority: string) => string
  getPriorityVariant: (priority: string) => 'default' | 'destructive' | 'outline' | 'secondary'
}) {
  return (
    <div className={`${getPriorityClass(prediction.priority)} p-4 rounded-lg border hover:bg-opacity-75 transition-colors cursor-pointer`}>
      <div className="flex flex-col space-y-3">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h4 className="font-medium">{prediction.name}</h4>
            <p className="text-sm text-muted-foreground truncate">
              {prediction.estimate_minutes ? `Estimate: ${formatEstimate(prediction.estimate_minutes)}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={getPriorityVariant(prediction.priority)}>
              {prediction.priority.charAt(0).toUpperCase() + prediction.priority.slice(1)}
            </Badge>
            <Badge variant="secondary">
              {Math.round(prediction.completionProbability * 100)}%
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <p className="font-medium">Predicted Duration:</p>
            <p className="text-muted-foreground">{formatEstimate(prediction.predictedDuration)}</p>
          </div>
          <div>
            <p className="font-medium">Completion Probability:</p>
            <p className="text-muted-foreground">
              {Math.round(prediction.completionProbability * 100)}%
            </p>
          </div>
          {prediction.recommendedSchedule ? (
            <>
              <div>
                <p className="font-medium">Recommended Start:</p>
                <p className="text-muted-foreground">
                  {formatDate(prediction.recommendedSchedule.startDate)} at {formatTime(prediction.recommendedSchedule.startTime)}
                </p>
              </div>
              <div>
                <p className="font-medium">Confidence:</p>
                <p className="text-muted-foreground">
                  {Math.round(prediction.recommendedSchedule.confidence * 100)}%
                </p>
              </div>
            </>
          ) : (
            <div className="col-span-2">
              <p className="font-medium">No Schedule Recommendation:</p>
              <p className="text-muted-foreground">Consider setting a deadline for better predictions</p>
            </div>
          )}
        </div>

        {prediction.deadline && (
          <div className="mt-3 p-3 bg-muted/50 rounded">
            <p className="font-medium">Deadline:</p>
            <p className="text-sm font-semibold">
              {formatDate(prediction.deadline.toISOString())}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// Suggestion Card Component
function SuggestionCard({
  suggestion,
  formatEstimate,
  getPriorityClass,
  getPriorityVariant
}: {
  suggestion: SchedulingSuggestion
  formatEstimate: (minutes?: number) => string
  getPriorityClass: (priority: string) => string
  getPriorityVariant: (priority: string) => 'default' | 'secondary' | 'destructive' | 'outline'
}) {
  return (
    <div className="p-4 rounded-lg border hover:bg-muted/50 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-medium">{suggestion.task.name}</h4>
        <Badge variant={getPriorityVariant(suggestion.priority)}>
          {suggestion.priority.charAt(0).toUpperCase() + suggestion.priority.slice(1)}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground mb-3">
        {suggestion.suggestion}
      </p>
      {suggestion.predictedStart && (
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-3 w-3" />
          <span className="text-muted-foreground">
            Suggested start: {new Date(suggestion.predictedStart).toLocaleString()}
          </span>
        </div>
      )}
    </div>
  )
}