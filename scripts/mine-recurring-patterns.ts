/**
 * Recurring Pattern Mining – initialization script
 *
 * Run via:
 *   npx tsx scripts/mine-recurring-patterns.ts
 *   # or, if you prefer node directly (after building the project):
 *   node scripts/mine-recurring-patterns.js
 *
 * This script is invoked by the scheduled cron jobs:
 *   0 0 * * *   – initialize recurring pattern mining
 *   0 2 * * *   – task scheduling pattern mining
 *
 * It scans the `tasks` table for tasks whose `title` or `description`
 * contain a recurring keyword (e.g. "every Monday", "daily"), parses the
 * pattern with `parseRecurringPattern`, and writes / updates a row in the
 * `recurring_schedules` table so the rest of the system can act on it.
 */

import db from "@/lib/db/schema"
import { parseRecurringPattern, generateRecurringDates } from "@/lib/recurring"
import { listOperations } from "@/lib/db"

interface RecurringTaskRow {
  id: number
  title: string
  description: string | null
  list_id: number
  completed: boolean
  dependencies: string | null
}

async function main() {
  const tasks: RecurringTaskRow[] = db.prepare(
    "SELECT id, title, description, list_id, completed, dependencies FROM tasks"
  ).all()

  // The "mining" result set
  const mined: Array<{
    taskId: number
    title: string
    pattern: ReturnType<typeof parseRecurringPattern>
    nextDates: Date[]
  }> = []

  for (const task of tasks) {
    const text = `${task.title || ""} ${task.description || ""}`.trim()
    if (!text) continue

    const pattern = parseRecurringPattern(text)
    if (!pattern.isRecurring) continue

    // Generate the next 5 dates (if applicable)
    const dates = pattern.interval || pattern.weekdays
      ? generateRecurringDates(pattern, new Date(), 5)
      : []

    // Upsert the pattern into the recurring_schedules table
    db.prepare(
      `INSERT INTO recurring_schedules (task_id, cron_expression, interval, unit, weekdays)
       VALUES (@taskId, @cronExpression, @interval, @unit, @weekdays)
       ON CONFLICT(task_id) DO UPDATE SET
         cron_expression = @cronExpression,
         interval = @interval,
         unit = @unit,
         weekdays = @weekdays`
    ).run({
      taskId: task.id,
      cronExpression: pattern.cronExpression || "",
      interval: pattern.interval ? Number(pattern.interval) : null,
      unit: pattern.unit || null,
      weekdays: pattern.weekdays ? JSON.stringify(pattern.weekdays) : null,
    })

    mined.push({ taskId: task.id, title: task.title, pattern, nextDates: dates })
  }

  console.log(`[mine-recurring-patterns] Scanned ${tasks.length} tasks.`)
  console.log(`[mine-recurring-patterns] Detected ${mined.length} recurring patterns.`)
  for (const m of mined) {
    console.log(
      `  • Task #${m.taskId} "${m.title}" → pattern: ${JSON.stringify(m.pattern)}` +
        (m.nextDates.length ? ` | next: ${m.nextDates.map((d) => d.toISOString().split("T")[0]).join(", ")}` : "")
    )
  }

  return { scanned: tasks.length, recurring: mined.length, patterns: mined }
}

// Only execute when invoked directly (not when imported)
if (require.main === module) {
  main().catch((err) => {
    console.error("[mine-recurring-patterns] Fatal error:", err)
    process.exit(1)
  })
}

export { main as mineRecurringPatterns }
