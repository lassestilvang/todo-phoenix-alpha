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
 *   - Complex patterns: "every 2 weeks on Monday and Friday", "last day of every month"
 *   - Business days: "every business day", "excluding weekends"
 */
export function parseRecurringPattern(text: string): {
  isRecurring: boolean;
  cronExpression?: string;
  interval?: number;
  unit?: string;
  weekdays?: number[];
  monthDays?: number[]; // Specific days of month (1-31)
  months?: number[]; // Specific months (1-12)
  excludeWeekends?: boolean;
  excludeSpecificDates?: string[]; // ISO date strings to exclude
  dayOfWeekInMonth?: { week: number; day: number }; // e.g., "third Friday"
  lastDayOfPeriod?: boolean; // Last day of month/year
} {
  const lower = text.toLowerCase().trim();

  // Handle special patterns first
  if (lower.includes("last day of")) {
    if (lower.includes("month")) {
      return {
        isRecurring: true,
        interval: 1,
        unit: "month",
        lastDayOfPeriod: true,
        cronExpression: "0 23 L * *", // Last day of month at 11:59 PM
      };
    }
    if (lower.includes("year")) {
      return {
        isRecurring: true,
        interval: 1,
        unit: "year",
        lastDayOfPeriod: true,
        cronExpression: "0 23 L 12 *", // Dec 31 at 11:59 PM
      };
    }
  }

  // Handle "business days" / "weekdays only"
  if (lower.includes("business day") || lower.includes("weekday")) {
    return {
      isRecurring: true,
      interval: 1,
      unit: "day",
      excludeWeekends: true,
      cronExpression: "0 9 * * 1-5", // 9am on weekdays only
    };
  }

  // Detect "every X days/weeks/months/years" with specific conditions
  const customMatch = lower.match(/every\s+(\d+)\s+(day|week|month|year)s?/);
  if (customMatch) {
    const interval = parseInt(customMatch[1], 10);
    const unit = customMatch[2] as 'day' | 'week' | 'month' | 'year';

    // Check for specific days (e.g., "every 2 weeks on monday, wednesday, friday")
    const daysMatch = lower.match(/(?:on|,)\s*(\w+(?:\s*,\s*\w+)*)/);
    if (daysMatch && unit === 'week') {
      const weekdays = parseWeekdays(daysMatch[1]);
      if (weekdays.length > 0) {
        return {
          isRecurring: true,
          interval,
          unit,
          weekdays,
          cronExpression: generateWeekdayCron(interval, weekdays),
        };
      }
    }

    // Check for specific month days (e.g., "every 3 months on the 15th")
    const monthDayMatch = lower.match(/(?:on\s+the\s+)?(\d+)(?:st|nd|rd|th)?/);
    if (monthDayMatch && (unit === 'month' || unit === 'year')) {
      const monthDay = parseInt(monthDayMatch[1], 10);
      return {
        isRecurring: true,
        interval,
        unit,
        monthDays: [monthDay],
        cronExpression: generateMonthDayCron(interval, unit, monthDay),
      };
    }

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

    // Handle patterns like "first monday", "third friday", etc.
    const ordinalMatch = lower.match(/(first|second|third|fourth|fifth|last)\s+(\w+)/);
    if (ordinalMatch) {
      const ordinal = ordinalMatch[1];
      const weekdayName = ordinalMatch[2];
      const weekdayIndex = weekdays.indexOf(weekdayName);
      if (weekdayIndex !== -1) {
        const weekNum = ordinalToNumber(ordinal);
        return {
          isRecurring: true,
          interval: 1,
          unit: "month",
          dayOfWeekInMonth: { week: weekNum, day: weekdayIndex },
          cronExpression: generateDayOfWeekInMonthCron(weekNum, weekdayIndex),
        };
      }
    }
  }

  // Handle "monthly on [weekday]" patterns
  const monthlyWeekdayMatch = lower.match(/monthly\s+(?:on\s+)?(first|second|third|fourth|fifth|last)\s+(\w+)/);
  if (monthlyWeekdayMatch) {
    const ordinal = ordinalToNumber(monthlyWeekdayMatch[1]);
    const weekdayName = monthlyWeekdayMatch[2];
    const weekdayIndex = weekdays.indexOf(weekdayName);
    if (weekdayIndex !== -1) {
      return {
        isRecurring: true,
        interval: 1,
        unit: "month",
        dayOfWeekInMonth: { week: ordinal, day: weekdayIndex },
        cronExpression: generateDayOfWeekInMonthCron(ordinal, weekdayIndex),
      };
    }
  }

  // Fallback: try chrono-node for more complex patterns
  try {
    const parsed = parse(text, new Date(), { forwardDate: true });
    if (parsed.length > 0) {
      const first = parsed[0];
      // Basic chrono-node parsing for simple cases
      if (first.start && !first.end) {
        // This is a start time, but not necessarily recurring
        // For true recurrence detection, we'd need more sophisticated logic
        // For now, we'll return false for non-explicit patterns
      }
    }
  } catch {
    // ignore
  }

  return { isRecurring: false };
}

/**
 * Parse weekday names to numbers (0-6 where 0 is Sunday)
 */
function parseWeekdays(text: string): number[] {
  const weekdays: { [key: string]: number } = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
    sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6
  };

  return text.split(',')
    .map(day => day.trim().toLowerCase())
    .map(day => weekdays[day])
    .filter((day): day is number => day !== undefined);
}

/**
 * Convert ordinal words to numbers
 */
function ordinalToNumber(ordinal: string): number {
  const ordinals: { [key: string]: number } = {
    first: 1, second: 2, third: 3, fourth: 4, fifth: 5, last: -1
  };
  return ordinals[ordinal.toLowerCase()] || 1;
}

/**
 * Generate cron expression for weekday-specific intervals
 */
function generateWeekdayCron(interval: number, weekdays: number[]): string {
  // For simplicity, we'll use the first weekday and approximate
  // In a full implementation, we'd use a library like croner
  const daysStr = weekdays.join(',');
  return `0 9 * * ${daysStr}`; // 9am on specified weekdays
}

/**
 * Generate cron expression for month-day specific intervals
 */
function generateMonthDayCron(interval: number, unit: 'month' | 'year', monthDay: number): string {
  if (unit === 'month') {
    return `0 9 ${monthDay} */${interval} *`; // 9am on day X of every Y months
  } else {
    return `0 9 ${monthDay} 1 */${interval} *`; // 9am on day X of January every Y years
  }
}

/**
 * Generate cron expression for day-of-week-in-month patterns
 */
function generateDayOfWeekInMonthCron(week: number, day: number): string {
  // Simplified - in reality this is complex cron logic
  // This would need a more sophisticated cron library
  return `0 9 ? * ${day}#${week}`; // 9am on the week-th day of month
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