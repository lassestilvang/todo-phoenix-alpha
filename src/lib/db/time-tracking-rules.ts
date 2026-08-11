import db from './schema';

export interface TimeTrackingRule {
  id: number;
  task_id: number;
  min_duration_minutes: number;
  max_duration_minutes: number;
  require_description: boolean;
  allowed_days: number[] | null;
  allowed_hours_start: string | null;
  allowed_hours_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface TimeTrackingRuleOptions {
  minDuration: number;
  maxDuration: number;
  enabled: boolean;
  allowedDays: number[];
  allowedHoursStart: string;
  allowedHoursEnd: string;
  priorityEnforcement: boolean;
  descriptionRequired: boolean;
}

export class TimeTrackingManager {
  private rules = new Map<number, TimeTrackingRule>();

  public addRule(rule: TimeTrackingRule): void {
    this.rules.set(rule.task_id, rule);
  }

  public getRule(taskId: number): TimeTrackingRule | null {
    const rule = this.rules.get(taskId);
    if (rule) return rule;

    // Load from database if not in memory
    const dbRule = db.prepare(
      'SELECT * FROM time_tracking_rules WHERE task_id = ?'
    ).get(taskId) as TimeTrackingRule | undefined;

    if (dbRule) {
      this.rules.set(taskId, dbRule);
      return dbRule;
    }

    return null;
  }

  public validateEdit(taskId: number, updates: any): { isValid: boolean; message: string } {
    const rule = this.getRule(taskId);
    if (!rule) return { isValid: true, message: 'No validation required' };

    // Time duration validation
    if (updates.duration_minutes !== undefined) {
      const duration = updates.duration_minutes;
      if (duration < rule.min_duration_minutes) {
        return { isValid: false, message: `Duration below minimum ${rule.min_duration_minutes} minutes` };
      }
      if (rule.max_duration_minutes && duration > rule.max_duration_minutes) {
        return { isValid: false, message: `Duration exceeds maximum ${rule.max_duration_minutes} minutes` };
      }
    }

    // Working hours validation
    const now = new Date();
    const nowDay = now.getDay();
    const nowHours = now.getHours();
    const nowMinutes = now.getMinutes();
    const currentTimeMinutes = nowHours * 60 + nowMinutes;

    // Check allowed days
    if (rule.allowed_days && !rule.allowed_days.includes(nowDay)) {
      return { isValid: false, message: 'Edit not allowed on this day of week' };
    }

    // Check allowed hours
    if (rule.allowed_hours_start && rule.allowed_hours_end) {
      const startMinutes = this.parseTimeString(rule.allowed_hours_start);
      const endMinutes = this.parseTimeString(rule.allowed_hours_end);
      if (currentTimeMinutes < startMinutes || currentTimeMinutes > endMinutes) {
        return { isValid: false, message: 'Edit outside allowed hours' };
      }
    }

    // Description validation
    if (rule.require_description && updates.description === undefined) {
      return { isValid: false, message: 'Description is required' };
    }

    return { isValid: true, message: '' };
  }

  public validateStartTime(taskId: number, startTime: Date): { isValid: boolean; message: string } {
    const rule = this.getRule(taskId);
    if (!rule) return { isValid: true, message: '' };

    const dayOfWeek = startTime.getDay();
    const hour = startTime.getHours();
    const minutes = startTime.getMinutes();
    const currentTimeMinutes = hour * 60 + minutes;

    // Check allowed days
    if (rule.allowed_days && !rule.allowed_days.includes(dayOfWeek)) {
      return { isValid: false, message: 'Starting timer not allowed on this day of week' };
    }

    // Check allowed hours
    if (rule.allowed_hours_start && rule.allowed_hours_end) {
      const startMinutes = this.parseTimeString(rule.allowed_hours_start);
      const endMinutes = this.parseTimeString(rule.allowed_hours_end);
      if (currentTimeMinutes < startMinutes || currentTimeMinutes > endMinutes) {
        return { isValid: false, message: 'Starting timer outside allowed hours' };
      }
    }

    return { isValid: true, message: '' };
  }

  private parseTimeString(timeString: string): number {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Calculate business hours overlap between two durations
   */
  public calculateBusinessHoursOverlap(
    taskId: number,
    start: Date,
    end: Date
  ): number {
    const rule = this.getRule(taskId);
    if (!rule || !rule.allowed_days || !rule.allowed_hours_start || !rule.allowed_hours_end) {
      // If no rule, return total duration
      return (end.getTime() - start.getTime()) / (1000 * 60);
    }

    const totalMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    const startMinutes = this.parseTimeString(rule.allowed_hours_start);
    const endMinutes = this.parseTimeString(rule.allowed_hours_end);

    let overlapMinutes = 0;
    let current = new Date(start);

    while (current < end) {
      const dayOfWeek = current.getDay();
      const currentMinutes = current.getHours() * 60 + current.getMinutes();

      if (
        rule.allowed_days.includes(dayOfWeek) &&
        currentMinutes >= startMinutes &&
        currentMinutes <= endMinutes
      ) {
        overlapMinutes += 1; // 1 minute overlap
      }

      current.setMinutes(current.getMinutes() + 1);
    }

    return overlapMinutes;
  }

  /**
   * Validate time entry against rules before creation
   */
  public validateTimeEntry(
    taskId: number,
    startedAt: string,
    stoppedAt: string | null,
    durationMinutes: number,
    description?: string
  ): { isValid: boolean; message: string } {
    const rule = this.getRule(taskId);
    if (!rule) return { isValid: true, message: '' };

    // Duration validation
    if (durationMinutes < rule.min_duration_minutes) {
      return { isValid: false, message: `Time entry below minimum ${rule.min_duration_minutes} minutes` };
    }
    if (rule.max_duration_minutes && durationMinutes > rule.max_duration_minutes) {
      return { isValid: false, message: `Time entry exceeds maximum ${rule.max_duration_minutes} minutes` };
    }

    // Description validation
    if (rule.require_description && (!description || description.trim().length === 0)) {
      return { isValid: false, message: 'Description is required for time entries' };
    }

    // Date validation
    const startDate = new Date(startedAt);
    const startDayOfWeek = startDate.getDay();
    const startMinutes = startDate.getHours() * 60 + startDate.getMinutes();

    if (rule.allowed_days && !rule.allowed_days.includes(startDayOfWeek)) {
      return { isValid: false, message: 'Time entry started on disallowed day' };
    }

    if (rule.allowed_hours_start && rule.allowed_hours_end) {
      const startMin = this.parseTimeString(rule.allowed_hours_start);
      const endMin = this.parseTimeString(rule.allowed_hours_end);
      if (startMinutes < startMin || startMinutes > endMin) {
        return { isValid: false, message: 'Time entry started outside allowed hours' };
      }
    }

    return { isValid: true, message: '' };
  }
}

// Singleton instance
let timeTrackingManagerInstance: TimeTrackingManager | null = null;

export const getTimeTrackingManager = (): TimeTrackingManager => {
  if (!timeTrackingManagerInstance) {
    timeTrackingManagerInstance = new TimeTrackingManager();
  }
  return timeTrackingManagerInstance;
};

// Initialize with existing rules from database
export const initializeTimeTrackingRules = (): void => {
  const manager = getTimeTrackingManager();
  const rawRules = db.prepare('SELECT * FROM time_tracking_rules').all() as any[];
  const rules = rawRules.map(rule => {
    // Convert database integer (0/1) to boolean for require_description field
    const convertedRule = {
      ...rule,
      require_description: Boolean(rule.require_description),
      allowed_days: rule.allowed_days ? JSON.parse(rule.allowed_days) : null
    };
    return convertedRule as TimeTrackingRule;
  });
  rules.forEach(rule => {
    manager.addRule(rule);
  });
};