/**
 * Recurring Pattern Mining
 * Detects recurring patterns from natural language input and generates
 * scheduled task runs.
 */

import { parse } from "chrono-node";
import type { TaskFormData } from "@/lib/types";

/**
 * Parse a recurring pattern from text and return a structured object.
 * Supports patterns like:
 *   - "every 2 days"
 *   - "every week"
 *   - "every 3 weeks"
 *   - "every month"
 *   - "every year"
 *   - "daily", "weekly", "monthly", "yearly"
 *   - "every Monday", "every Tuesday", etc.
 */
export function parseRecurringPattern(text: string): {
  isRecurring: boolean;
  cronExpression?: string;
  interval?: number;
  unit?: string;
  weekdays?: number[];
  // Optional: specific days of month, months, etc.
} {
  const lower = text.toLowerCase();

  // Detect "every X days/weeks/months/years"
  const customMatch = lower.match(/every\s+(\d+)\s+(day|week|month|year)s?/);
  if (customMatch) {
    const interval = parseInt(customMatch[1], 10);
    const unit = customMatch[2];
    return {
      isRecurring: true,
      interval,
      unit,
      cronExpression: intervalToCron(interval, unit),
    };
  }

  // Detect "every weekday" / "weekdays"
  if (lower.includes("every weekday") || lower.includes("weekdays")) {
    return {
      isRecurring: true,
      weekdays: [1, 2, 3, 4, 5], // Mon-Fri
      cronExpression: "0 9 * * 1-5", // 9am on weekdays
    };
  }

  // Detect "every day" / "daily"
  if (lower.includes("every day") || lower.includes("daily")) {
    return {
      isRecurring: true,
      interval: 1,
      unit: "day",
      cronExpression: "0 9 * * *", // 9am daily
    };
  }

  // Detect "every week" / "weekly"
  if (lower.includes("every week") || lower.includes("weekly")) {
    return {
      isRecurring: true,
      interval: 1,
      unit: "week",
      cronExpression: "0 9 * * 1", // 9am every Monday
    };
  }

  // Detect "every month" / "monthly"
  if (lower.includes("every month") || lower.includes("monthly")) {
    return {
      isRecurring: true,
      interval: 1,
      unit: "month",
      cronExpression: "0 9 1 * *", // 9am on 1st of each month
    };
  }

  // Detect "every year" / "yearly" / "annually"
  if (lower.includes("every year") || lower.includes("yearly") || lower.includes("annually")) {
    return {
      isRecurring: true,
      interval: 1,
      unit: "year",
      cronExpression: "0 9 1 1 *", // 9am on Jan 1st
    };
  }

  // Detect specific weekdays: "every Monday", "every Tuesday", etc.
  const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  for (let i = 0; i < weekdays.length; i++) {
    if (lower.includes(`every ${weekdays[i]}`) || lower.includes(`every ${weekdays[i]}s`)) {
      return {
        isRecurring: true,
        weekdays: [i],
        cronExpression: `0 9 * * ${i}`,
      };
    }
  }

  // Fallback: try chrono-node for more complex patterns
  try {
    const parsed = parse(text, new Date(), { forwardDate: true });
    if (parsed.length > 0) {
      const first = parsed[0];
      // If chrono-node found a recurring pattern (it doesn't natively, but we can check)
      // For now, we just return false
    }
  } catch {
    // ignore
  }

  return { isRecurring: false };
}

/**
 * Convert interval + unit to a cron expression (simplified).
 * For production, you may want to use a library like `croner` or `node-cron`
 * that can handle "every N days" etc.
 */
function intervalToCron(interval: number, unit: string): string {
  // This is a simplified mapping; real cron can't express "every N days" directly.
  // We approximate by scheduling at a specific time each day/week/month.
  switch (unit) {
    case "day":
      return `0 9 */${interval} * *`; // runs at 9am every `interval` days (not perfect)
    case "week":
      return `0 9 * * 1`; // every Monday at 9am (weekly)
    case "month":
      return `0 9 1 */${interval} *`; // 1st of month every `interval` months
    case "year":
      return `0 9 1 1 */${interval}`; // Jan 1 every `interval` years
    default:
      return "0 9 * * *";
  }
}

/**
 * Generate future scheduled dates for a recurring task.
 * Returns an array of ISO date strings for the next `count` occurrences.
 */
export function generateRecurringDates(
  pattern: ReturnType<typeof parseRecurringPattern>,
  startDate: Date = new Date(),
  count: number = 10
): Date[] {
  if (!pattern.isRecurring) return [];

  const dates: Date[] = [];
  let current = new Date(startDate);

  // Simple generator based on unit
  const unit = pattern.unit || "day";
  const interval = pattern.interval || 1;

  for (let i = 0; i < count; i++) {
    dates.push(new Date(current));
    // Advance based on unit
    const next = new Date(current);
    switch (unit) {
      case "day":
        next.setDate(next.getDate() + interval);
        break;
      case "week":
        next.setDate(next.getDate() + interval * 7);
        break;
      case "month":
        next.setMonth(next.getMonth() + interval);
        break;
      case "year":
        next.setFullYear(next.getFullYear() + interval);
        break;
      default:
        next.setDate(next.getDate() + 1);
    }
    current = next;
  }

  return dates;
}

/**
 * Server action to create recurring task runs from a pattern.
 * This would be called when a user creates a task with a recurring pattern.
 */
export async function createRecurringTaskRuns(
  taskId: number,
  patternText: string,
  startDate: Date = new Date(),
  maxOccurrences: number = 10
): Promise<{ created: number; dates: Date[] }> {
  const pattern = parseRecurringPattern(patternText);
  if (!pattern.isRecurring) {
    return { created: 0, dates: [] };
  }

  const futureDates = generateRecurringDates(pattern, startDate, maxOccurrences);

  // In a real implementation, you would insert these into the `task_runs` table
  // using your database layer. For now, we just return the dates.
  // Example:
  // for (const date of futureDates) {
  //   await db.prepare('INSERT INTO task_runs ...').run(taskId, date.toISOString().split('T')[0]);
  // }

  return { created: futureDates.length, dates: futureDates };
}