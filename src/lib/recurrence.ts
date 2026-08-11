import db from '@/lib/db/schema';
import { RecurrencePattern } from './types';

export interface RecurringTask {
  id: number;
  taskId: number;
  pattern: keyof typeof RecurrencePattern;
  interval: number;
  intervalUnit: 'day' | 'week' | 'month' | 'year';
  nextRun: Date;
  endDate?: Date;
  createdAt: string;
  updatedAt: string;
}

export class RecurrenceEngine {
  private patterns = new Map<string, (date: Date) => Date | null>();

  constructor() {
    // Daily - every day
    this.patterns.set('every_day', (date: Date) => new Date(date));

    // Weekly - every week
    this.patterns.set('every_week', (date: Date) => {
      const next = new Date(date);
      next.setDate(date.getDate() + 7);
      return next;
    });

    // Monthly - on same day of month
    this.patterns.set('monthly', (date: Date) => {
      const next = new Date(date);
      // If end of month, go to next month's first day
      if (date.getDate() > new Date(date.getFullYear(), date.getMonth() + 1, 1).getDate()) {
        next.setMonth(date.getMonth() + 2);
        next.setDate(1);
      } else {
        next.setMonth(date.getMonth() + 1);
      }
      return next;
    });

    // Yearly - same day next year
    this.patterns.set('yearly', (date: Date) => new Date(date.getFullYear() + 1, date.getMonth(), date.getDate()));
  }

  /**
   * Generate next occurrence for a given pattern
   */
  getNextOccurrence(pattern: string, lastRun?: Date, interval?: number, unit?: 'day' | 'week' | 'month' | 'year'): Date | null {
    if (!this.patterns.has(pattern)) return null;
    return this.patterns.get(pattern)(lastRun ?? new Date());
  }

  /**
   * Validate recurrence pattern definition
   */
  validatePattern(pat: string): { valid: boolean; error?: string } {
    const allowed = ['every_day', 'every_week', 'monthly', 'yearly'];
    if (!allowed.includes(pat)) {
      return { valid: false, error: `Invalid pattern "${pat}". Allowed values: ${allowed.join(', ')}` };
    }
    return { valid: true };
  }
}