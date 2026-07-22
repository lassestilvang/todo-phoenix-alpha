import db from "@/lib/db/schema"
import { addDays, addWeeks, addMonths, addYears } from "date-fns"

export interface RecurringSchedule {
  taskId: number
  pattern: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom_n_days' | 'custom_n_weeks' | 'custom_days_of_month'
  interval: number
  intervalUnit: 'day' | 'week' | 'month' | 'year'
  startDate: Date
  endDate: Date | null
  excludeDates: string[]
}

export interface TaskRun {
  id: number
  recurrentScheduleId: number
  taskId: number
  scheduledDate: Date
  actualDate: Date | null
  status: 'pending' | 'completed' | 'skipped' | 'deleted'
}

/**
 * Calculate the next occurrence date based on pattern
 */
export function calculateNextOccurrence(
  pattern: string,
  interval: number,
  startDate: Date
): Date {
  switch (pattern) {
    case 'daily':
      return addDays(startDate, interval)
    case 'weekly':
      return addWeeks(startDate, interval)
    case 'monthly':
      return addMonths(startDate, interval)
    case 'yearly':
      return addYears(startDate, interval)
    case 'custom_n_days':
      return addDays(startDate, interval)
    case 'custom_n_weeks':
      return addWeeks(startDate, interval)
    case 'custom_days_of_month':
      // For simplicity, treat as monthly with interval
      return addMonths(startDate, interval)
    default:
      return addDays(startDate, interval)
  }
}

/**
 * Generate task runs for a recurring schedule
 */
export function generateTaskRuns(
  recurringSchedule: RecurringSchedule,
  count: number = 10
): Date[] {
  const dates: Date[] = []
  let currentDate = recurringSchedule.startDate

  for (let i = 0; i < count; i++) {
    currentDate = calculateNextOccurrence(
      recurringSchedule.pattern,
      recurringSchedule.interval,
      currentDate
    )

    // Check if end date is reached
    if (recurringSchedule.endDate && currentDate > recurringSchedule.endDate) {
      break
    }

    // Skip excluded dates
    const dateStr = currentDate.toISOString().split('T')[0]
    if (recurringSchedule.excludeDates.includes(dateStr)) {
      // Try again with same interval but skip this one
      i-- // Don't increment to try next occurrence
      currentDate = calculateNextOccurrence(
        recurringSchedule.pattern,
        recurringSchedule.interval,
        currentDate
      )
      continue
    }

    dates.push(currentDate)
  }

  return dates
}

/**
 * Create a recurring schedule in the database
 */
export function createRecurringSchedule(schedule: RecurringSchedule): number {
  const stmt = db.prepare(`
    INSERT INTO recurring_schedules
    (pattern, interval, interval_unit, start_date, end_date, exclude_dates, next_run)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  return stmt.run(
    schedule.pattern,
    schedule.interval,
    schedule.intervalUnit,
    schedule.startDate.toISOString(),
    schedule.endDate?.toISOString(),
    JSON.stringify(schedule.excludeDates),
    new Date().toISOString()
  ).lastInsertRowid as number
}

/**
 * Get next run time for a recurring schedule
 */
export function getNextRun(taskId: number): Date | null {
  const result = db.prepare(`
    SELECT next_run FROM recurring_schedules WHERE task_id = ?
  `).get(taskId)

  return result ? new Date(result.next_run) : null
}

/**
 * Advance the next run time for a recurring task
 */
export function advanceNextRun(taskId: number, pattern: string, interval: number): Date {
  const stmt = db.prepare(`
    UPDATE recurring_schedules
    SET next_run = ?
    WHERE task_id = ?
  `)

  const now = new Date()
  const nextRun = calculateNextOccurrence(pattern, interval, now)

  stmt.run(nextRun.toISOString(), taskId)
  return nextRun
}