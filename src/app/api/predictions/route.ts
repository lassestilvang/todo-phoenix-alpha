import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db/schema'
import { TaskParser } from '@/lib/nlp/task-parser'

// Get all tasks with details
async function getTasksWithDetails() {
  return db.prepare(`
    SELECT t.*, l.name as list_name, l.color as list_color
    FROM tasks t
    LEFT JOIN lists l ON t.list_id = l.id
    ORDER BY t.created_at DESC
  `).all() as any[]
}

// Get all time entries
function getAllTimeEntries() {
  return db.prepare(`
    SELECT * FROM time_entries
    ORDER BY started_at DESC
  `).all() as any[]
}

// Get all labels for a task
function getTaskLabels(taskId: number) {
  return db.prepare(`
    SELECT l.* FROM labels l
    JOIN task_labels tl ON l.id = tl.label_id
    WHERE tl.task_id = ?
  `).all(taskId) as any[]
}

// Predict task completion based on historical patterns
function predictTaskCompletion(task: any, historicalTasks: any[], timeEntries: any[]): {
  predictedDuration: number
  completionProbability: number
  recommendedSchedule: {
    startDate: string
    startTime: string
    confidence: number
  } | null
} {
  // Calculate average completion time ratio
  const completedWithTime = historicalTasks.filter(t =>
    t.is_completed && t.estimate_minutes && t.actual_minutes
  )

  let durationRatio = 1
  if (completedWithTime.length > 0) {
    const avgRatio = completedWithTime.reduce((sum, t) => {
      const ratio = t.estimate_minutes && t.estimate_minutes > 0
        ? t.actual_minutes / t.estimate_minutes
        : 1
      return sum + ratio
    }, 0) / completedWithTime.length
    durationRatio = avgRatio || 1
  }

  const estimatedMinutes = (task.estimate_minutes || 30) * durationRatio

  // Calculate completion probability based on priority, deadline proximity, and historical data
  const totalCompleted = historicalTasks.filter(t => t.is_completed).length
  const totalTasks = historicalTasks.length
  const historicalCompletionRate = totalTasks > 0 ? totalCompleted / totalTasks : 0.7

  // Adjust for task priority
  const priorityMultiplier: Record<string, number> = {
    high: 0.9,
    medium: 0.75,
    low: 0.6,
    none: 0.7,
  }

  const priorityScore = priorityMultiplier[task.priority] || 0.7

  // Adjust for deadline proximity
  let deadlineScore = 1
  if (task.deadline) {
    const hoursUntil = (new Date(task.deadline).getTime() - Date.now()) / (1000 * 60 * 60)
    if (hoursUntil < 24) deadlineScore = 0.9
    else if (hoursUntil < 72) deadlineScore = 0.8
    else if (hoursUntil > 168) deadlineScore = 0.6
  }

  // Adjust for dependencies
  const hasDependencies = task.dependencies && task.dependencies !== '[]'
  const dependencyScore = hasDependencies ? 0.85 : 1

  // Adjust for subtasks
  const hasSubtasks = task.subtasks && task.subtasks.length > 0
  const subtaskScore = hasSubtasks ? 0.75 : 1

  const completionProbability = Math.min(1,
    historicalCompletionRate * priorityScore * deadlineScore * dependencyScore * subtaskScore
  )

  // Predict optimal schedule time based on historical productive hours
  let predictedStartTime: string | null = null
  let timeConfidence = 0.5

  if (timeEntries.length > 0) {
    // Find the most productive hours from completed tasks
    const hourlyCompletion: Record<number, { completed: number; total: number }> = {}

    timeEntries.forEach(entry => {
      const hour = new Date(entry.started_at).getHours()
      if (!hourlyCompletion[hour]) {
        hourlyCompletion[hour] = { completed: 0, total: 0 }
      }
      hourlyCompletion[hour].total += 1
      if (entry.duration_minutes && entry.duration_minutes > 0) {
        hourlyCompletion[hour].completed += 1
      }
    })

    // Find the best hour
    let bestHour = 9
    let bestScore = 0

    for (const [hour, data] of Object.entries(hourlyCompletion)) {
      const score = data.total > 0 ? data.completed / data.total : 0
      if (score > bestScore) {
        bestScore = score
        bestHour = parseInt(hour, 10)
      }
    }

    // Calculate recommended start date
    const now = new Date()
    const startDate = new Date(now)
    startDate.setHours(bestHour, 0, 0, 0)

    // If the optimal time has passed today, schedule for tomorrow
    if (startDate < now) {
      startDate.setDate(startDate.getDate() + 1)
    }

    predictedStartTime = startDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })

    // Calculate confidence based on data quality
    const totalEntries = Object.values(hourlyCompletion).reduce((sum, h) => sum + h.total, 0)
    timeConfidence = Math.min(1, totalEntries / 50)

    return {
      predictedDuration: Math.round(estimatedMinutes),
      completionProbability: Number(completionProbability.toFixed(2)),
      recommendedSchedule: {
        startDate: startDate.toISOString(),
        startTime: predictedStartTime,
        confidence: Number(timeConfidence.toFixed(2)),
      },
    }
  }

  // Fallback without time entry data
  return {
    predictedDuration: Math.round(estimatedMinutes),
    completionProbability: Number(completionProbability.toFixed(2)),
    recommendedSchedule: task.deadline ? {
      startDate: new Date().toISOString(),
      startTime: '09:00 AM',
      confidence: 0.5
    } : null,
  }
}

// Identify productive time windows
function identifyProductiveWindows(tasks: any[], timeEntries: any[]): {
  mostProductiveHours: number[]
  peakFocusHours: number[]
  recommendedWorkDuration: number
} {
  const hourlyData: Record<number, { count: number; totalMinutes: number }> = {}

  timeEntries.forEach(entry => {
    const hour = new Date(entry.started_at).getHours()
    if (!hourlyData[hour]) {
      hourlyData[hour] = { count: 0, totalMinutes: 0 }
    }
    hourlyData[hour].count += 1
    hourlyData[hour].totalMinutes += entry.duration_minutes || 0
  })

  // Sort by total minutes to find most productive hours
  const sortedHours = Object.entries(hourlyData)
    .sort((a, b) => b[1].totalMinutes - a[1].totalMinutes)
    .map(([hour]) => parseInt(hour, 10))

  const mostProductiveHours = sortedHours.slice(0, 3)
  const peakFocusHours = sortedHours.slice(0, 2)

  // Calculate recommended work duration based on average session length
  const avgSessionLength = timeEntries.length > 0
    ? timeEntries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0) / timeEntries.length
    : 25

  return {
    mostProductiveHours,
    peakFocusHours,
    recommendedWorkDuration: Math.round(avgSessionLength) || 25,
  }
}

// Generate task scheduling suggestions
function generateSchedulingSuggestions(tasks: any[], predictions: any[]): {
  task: any
  suggestion: string
  priority: 'high' | 'medium' | 'low'
  predictedStart: string | null
}[] {
  const suggestions: { task: any; suggestion: string; priority: 'high' | 'medium' | 'low'; predictedStart: string | null }[] = []

  // Sort by completion probability (lowest first) and deadline urgency
  const sortedTasks = [...tasks]
    .filter(t => !t.is_completed)
    .sort((a, b) => {
      const probA = predictions.find(p => p.id === a.id)?.completionProbability || 1
      const probB = predictions.find(p => p.id === b.id)?.completionProbability || 1
      return probA - probB
    })

  sortedTasks.forEach((task, i) => {
    const prediction = predictions.find(p => p.id === task.id)

    let priority: 'high' | 'medium' | 'low' = 'medium'
    let suggestion = ''
    let predictedStart = null

    // High priority for tasks with low completion probability
    if (prediction && prediction.completionProbability < 0.4) {
      priority = 'high'
      suggestion = `This task has only a ${Math.round(prediction.completionProbability * 100)}% predicted completion rate. Consider breaking it into smaller steps.`
      predictedStart = prediction.recommendedSchedule?.startDate || null
    } else if (prediction && prediction.completionProbability >= 0.4 && prediction.completionProbability < 0.7) {
      priority = 'medium'
      suggestion = `This task has a ${Math.round(prediction.completionProbability * 100)}% predicted completion rate. Schedule it during your peak productivity hours.`
      predictedStart = prediction.recommendedSchedule?.startDate || null
    } else {
      priority = 'low'
      suggestion = `This task is likely to be completed on time. Focus on higher priority items.`
    }

    suggestions.push({
      task,
      suggestion,
      priority,
      predictedStart,
    })
  })

  return suggestions
}

// API endpoint
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeSuggestions = searchParams.get('suggestions') === 'true'

    const tasks = await getTasksWithDetails()
    const timeEntries = getAllTimeEntries()

    // Filter out completed tasks for prediction
    const pendingTasks = tasks.filter(t => !t.is_completed)

    // Generate predictions for pending tasks
    const predictions = pendingTasks.map(task => {
      const prediction = predictTaskCompletion(task, tasks, timeEntries)
      return {
        id: task.id,
        name: task.name,
        predictedDuration: prediction.predictedDuration,
        completionProbability: prediction.completionProbability,
        recommendedSchedule: prediction.recommendedSchedule,
        priority: task.priority,
        deadline: task.deadline,
        estimate_minutes: task.estimate_minutes,
      }
    })

    // Get productive windows
    const productiveWindows = identifyProductiveWindows(tasks, timeEntries)

    // Generate scheduling suggestions
    const schedulingSuggestions = includeSuggestions
      ? generateSchedulingSuggestions(pendingTasks, predictions)
      : null

    return NextResponse.json({
      success: true,
      predictions: predictions.slice(0, 10), // Return top 10 predictions
      productiveWindows,
      schedulingSuggestions,
      summary: {
        totalTasks: pendingTasks.length,
        highRiskTasks: predictions.filter(p => p.completionProbability < 0.5).length,
        mediumRiskTasks: predictions.filter(p => p.completionProbability >= 0.5 && p.completionProbability < 0.75).length,
        lowRiskTasks: predictions.filter(p => p.completionProbability >= 0.75).length,
      },
    })
  } catch (error) {
    console.error('Predictions error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate predictions' },
      { status: 500 }
    )
  }
}
