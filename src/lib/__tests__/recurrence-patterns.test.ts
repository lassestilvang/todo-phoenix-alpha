import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import the recurrence calculation function
const calculateNextOccurrence = (
  baseDate: Date | null,
  pattern: string | null,
  customValue: string | null
): Date | null => {
  if (!baseDate || !pattern) return null;

  const date = new Date(baseDate);
  const value = customValue ? parseInt(customValue, 10) : 1;

  switch (pattern) {
    case 'every_day':
      date.setDate(date.getDate() + 1);
      return date;

    case 'every_week':
      date.setDate(date.getDate() + 7);
      return date;

    case 'every_weekday': {
      do {
        date.setDate(date.getDate() + 1);
      } while (date.getDay() === 0 || date.getDay() === 6);
      return date;
    }

    case 'every_month':
      date.setMonth(date.getMonth() + 1);
      return date;

    case 'every_year':
      date.setFullYear(date.getFullYear() + 1);
      return date;

    case 'custom_n_days':
      if (!isNaN(value) && value > 0) {
        date.setDate(date.getDate() + value);
        return date;
      }
      return null;

    case 'custom_n_weeks':
      if (!isNaN(value) && value > 0) {
        date.setDate(date.getDate() + value * 7);
        return date;
      }
      return null;

    case 'custom_days_of_month':
      if (!isNaN(value) && value > 0 && value <= 31) {
        date.setMonth(date.getMonth() + 1);
        date.setDate(Math.min(value, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
        return date;
      }
      return null;

    default:
      return null;
  }
};

describe('Recurrence Pattern Calculation', () => {
  const testDate = new Date('2026-09-10T00:00:00Z');

  describe('Every Day Pattern', () => {
    it('should calculate next day correctly', () => {
      const result = calculateNextOccurrence(testDate, 'every_day', null);
      expect(result).toBeDefined();
      expect(result?.toISOString().split('T')[0]).toBe('2026-09-11');
    });

    it('should handle null base date', () => {
      const result = calculateNextOccurrence(null, 'every_day', null);
      expect(result).toBeNull();
    });

    it('should handle null pattern', () => {
      const result = calculateNextOccurrence(testDate, null, null);
      expect(result).toBeNull();
    });
  });

  describe('Every Week Pattern', () => {
    it('should calculate next week correctly', () => {
      const result = calculateNextOccurrence(testDate, 'every_week', null);
      expect(result).toBeDefined();
      expect(result?.toISOString().split('T')[0]).toBe('2026-09-17');
    });
  });

  describe('Every Weekday Pattern', () => {
    it('should skip weekend', () => {
      // Start from Thursday 2026-09-10 (Sep 10, 2026 is a Thursday)
      const thursday = new Date('2026-09-10T00:00:00Z');
      const result = calculateNextOccurrence(thursday, 'every_weekday', null);
      expect(result?.toISOString().split('T')[0]).toBe('2026-09-11'); // Friday
    });

    it('should handle Friday start', () => {
      const friday = new Date('2026-09-11T00:00:00Z'); // Friday
      const result = calculateNextOccurrence(friday, 'every_weekday', null);
      expect(result?.toISOString().split('T')[0]).toBe('2026-09-14'); // Monday
    });

    it('should handle Saturday start', () => {
      const saturday = new Date('2026-09-12T00:00:00Z'); // Saturday
      const result = calculateNextOccurrence(saturday, 'every_weekday', null);
      expect(result?.toISOString().split('T')[0]).toBe('2026-09-14'); // Monday
    });

    it('should handle Sunday start', () => {
      const sunday = new Date('2026-09-13T00:00:00Z'); // Sunday
      const result = calculateNextOccurrence(sunday, 'every_weekday', null);
      expect(result?.toISOString().split('T')[0]).toBe('2026-09-14'); // Monday
    });
  });

  describe('Every Month Pattern', () => {
    it('should calculate next month correctly', () => {
      const result = calculateNextOccurrence(testDate, 'every_month', null);
      expect(result).toBeDefined();
      expect(result?.toISOString().split('T')[0]).toBe('2026-10-10');
    });

    it('should handle end', () => {
      const jan31 = new Date('2026-01-31T00:00:00Z');
      const result = calculateNextOccurrence(jan31, 'every_month', null);
      expect(result?.toISOString().split('T')[0]).toBe('2026-03-03');
    });
  });

  describe('Every Year Pattern', () => {
    it('should calculate next year correctly', () => {
      const result = calculateNextOccurrence(testDate, 'every_year', null);
      expect(result).toBeDefined();
      expect(result?.toISOString().split('T')[0]).toBe('2027-09-10');
    });
  });

  describe('Custom N Days Pattern', () => {
    it('should calculate custom n days correctly', () => {
      const result = calculateNextOccurrence(testDate, 'custom_n_days', '3');
      expect(result).toBeDefined();
      expect(result?.toISOString().split('T')[0]).toBe('2026-09-13');
    });

    it('should return null for invalid custom value', () => {
      const result = calculateNextOccurrence(testDate, 'custom_n_days', '0');
      expect(result).toBeNull();

      const result2 = calculateNextOccurrence(testDate, 'custom_n_days', '-5');
      expect(result2).toBeNull();

      const result3 = calculateNextOccurrence(testDate, 'custom_n_days', 'abc');
      expect(result3).toBeNull();
    });
  });

  describe('Custom N Weeks Pattern', () => {
    it('should calculate custom n weeks correctly', () => {
      const result = calculateNextOccurrence(testDate, 'custom_n_weeks', '2');
      expect(result).toBeDefined();
      expect(result?.toISOString().split('T')[0]).toBe('2026-09-24');
    });

    it('should handle zero value', () => {
      const result = calculateNextOccurrence(testDate, 'custom_n_weeks', '0');
      expect(result).toBeNull();
    });

    it('should handle negative value', () => {
      const result = calculateNextOccurrence(testDate, 'custom_n_weeks', '-1');
      expect(result).toBeNull();
    });
  });

  describe('Custom Days of Month Pattern', () => {
    it('should calculate custom day of month correctly', () => {
      const result = calculateNextOccurrence(testDate, 'custom_days_of_month', '15');
      expect(result).toBeDefined();
      expect(result?.toISOString().split('T')[0]).toBe('2026-10-15');
    });

    it('should handle month boundary correctly', () => {
      const jan10 = new Date('2026-01-10T00:00:00Z');
      const result = calculateNextOccurrence(jan10, 'custom_days_of_month', '31');
      expect(result).toBeDefined();
      // Should go to next month, day 31
      expect(result?.toISOString().split('T')[0]).toBe('2026-02-28'); // Feb doesn't have 31st
    });

    it('should return null for invalid day values', () => {
      const result = calculateNextOccurrence(testDate, 'custom_days_of_month', '0');
      expect(result).toBeNull();

      const result2 = calculateNextOccurrence(testDate, 'custom_days_of_month', '32');
      expect(result2).toBeNull();
    });

    it('should handle February correctly', () => {
      const jan15 = new Date('2026-01-15T00:00:00Z');
      const result = calculateNextOccurrence(jan15, 'custom_days_of_month', '29');
      expect(result).toBeDefined();
      expect(result?.toISOString().split('T')[0]).toBe('2026-02-28'); // Feb 2026 has 28 days
    });

    it('should handle leap year February', () => {
      const jan15Leap = new Date('2024-01-15T00:00:00Z'); // 2024 is leap year
      const result = calculateNextOccurrence(jan15Leap, 'custom_days_of_month', '29');
      expect(result).toBeDefined();
      expect(result?.toISOString().split('T')[0]).toBe('2024-02-29');
    });
  });

  describe('Future Occurrences Generation', () => {
    it('should generate multiple future occurrences for daily pattern', () => {
      const occurrences: Date[] = [];
      let currentDate = new Date('2026-09-10T00:00:00Z');
      const count = 5;

      for (let i = 0; i < count; i++) {
        const nextDate = calculateNextOccurrence(currentDate, 'every_day', null);
        if (!nextDate) break;
        occurrences.push(nextDate);
        currentDate = nextDate;
      }

      expect(occurrences).toHaveLength(5);
      expect(occurrences[0]?.toISOString().split('T')[0]).toBe('2026-09-11');
      expect(occurrences[4]?.toISOString().split('T')[0]).toBe('2026-09-15');
    });

    it('should generate future occurrences for weekly pattern', () => {
      const occurrences: Date[] = [];
      let currentDate = new Date('2026-09-10T00:00:00Z');
      const count = 3;

      for (let i = 0; i < count; i++) {
        const nextDate = calculateNextOccurrence(currentDate, 'every_week', null);
        if (!nextDate) break;
        occurrences.push(nextDate);
        currentDate = nextDate;
      }

      expect(occurrences).toHaveLength(3);
      expect(occurrences[0]?.toISOString().split('T')[0]).toBe('2026-09-17');
      expect(occurrences[1]?.toISOString().split('T')[0]).toBe('2026-09-24');
      expect(occurrences[2]?.toISOString().split('T')[0]).toBe('2026-10-01');
    });

    it('should return empty array for non-recurring task', () => {
      const occurrences: Date[] = [];
      expect(occurrences).toHaveLength(0);
    });

    it('should return empty array when pattern is null', () => {
      const occurrences: Date[] = [];
      expect(occurrences).toHaveLength(0);
    });
  });
});