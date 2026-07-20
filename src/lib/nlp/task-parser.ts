import { parse } from 'chrono-node';
import type { TaskFormData, Priority, RecurringPattern } from '@/lib/types';

// Enhanced task parser using chrono-node with custom logic
export class TaskParser {
  /**
   * Parse natural language text into task properties
   */
  static parse(text: string): Partial<TaskFormData> {
    const result: Partial<TaskFormData> = {
      name: '',
      description: text,
    };

    if (!text || text.trim() === '') {
      return result;
    }

    // Parse dates/times using chrono-node
    const parsed = parse(text, new Date(), {
      forwardDate: true,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });

    // Extract date and deadline from parsed results
    if (parsed.length > 0) {
      const bestMatch = parsed.reduce((prev, curr) =>
        (curr.start.dateValue > prev.start.dateValue ? curr : prev)
      );

      const dateObj = bestMatch.start.dateValue;

      // Determine if it's a date-only or datetime
      if (bestMatch.start.isCertain('date') && !bestMatch.start.isCertain('time')) {
        // Date only (no time specified)
        result.date = dateObj;
      } else {
        // Has time component
        // We'll treat this as deadline if it has time, or date if it's ambiguous
        result.deadline = dateObj;

        // If it's clearly a time-based reminder (like "at 3pm"),
        // we might want to set reminder instead
        if (bestMatch.text.toLowerCase().includes('at ') ||
            bestMatch.text.toLowerCase().includes(':') ||
            bestMatch.text.toLowerCase().includes('am') ||
            bestMatch.text.toLowerCase().includes('pm')) {
          // This looks like a specific time - could be deadline or reminder time
          // For now, treat as deadline
          result.deadline = dateObj;
        }
      }
    }

    // Extract priority from text
    const priorityMatch = text.toLowerCase().match(/\b(high|medium|low|none)\s+priority\b/);
    if (priorityMatch) {
      result.priority = priorityMatch[1] as Priority;
    }

    // Extract time estimates (e.g., "2 hours", "30m", "1.5h")
    const timeMatch = text.toLowerCase().match(/\b(\d+(?:\.\d+)?)\s*(h|hr|hrs|hours?|m|min|mins?|minutes?)\b/);
    if (timeMatch) {
      const value = parseFloat(timeMatch[1]);
      const unit = timeMatch[2];
      let minutes = 0;

      if (unit.startsWith('h')) {
        minutes = value * 60;
      } else if (unit.startsWith('m')) {
        minutes = value;
      }

      if (!isNaN(minutes) && minutes > 0 && minutes <= 480) { // Max 8 hours
        result.estimate_minutes = Math.round(minutes);
      }
    }

    // Extract recurring patterns
    const recurringPatterns: { [key: string]: RecurringPattern } = {
      'every day': 'every_day',
      'each day': 'every_day',
      'daily': 'every_day',
      'every weekday': 'every_weekday',
      'weekdays': 'every_weekday',
      'every week': 'every_week',
      'weekly': 'every_week',
      'every month': 'every_month',
      'monthly': 'every_month',
      'every year': 'every_year',
      'yearly': 'every_year',
      'annually': 'every_year',
    };

    for (const [patternText, patternEnum] of Object.entries(recurringPatterns)) {
      if (text.toLowerCase().includes(patternText)) {
        result.is_recurring = true;
        result.recurring_pattern = patternEnum;

        // Extract custom values for patterns like "every 2 days"
        const customMatch = text.toLowerCase().match(/every\s+(\d+)\s+(day|week|month)/);
        if (customMatch) {
          const value = parseInt(customMatch[1], 10);
          const unit = customMatch[2];

          if (unit === 'day' && patternEnum === 'every_day') {
            result.recurring_pattern = 'custom_n_days';
            result.recurring_custom_value = value.toString();
          } else if (unit === 'week' && patternEnum === 'every_week') {
            result.recurring_pattern = 'custom_n_weeks';
            result.recurring_custom_value = value.toString();
          }
        }
        break;
      }
    }

    // Extract labels (words starting with #)
    const labelMatches = text.match(/#(\w+)/g);
    if (labelMatches) {
      // We'll store label names temporarily - actual label IDs need to be resolved
      // For now, we'll put them in description or handle separately
      const labelNames = labelMatches.map(match => match.substring(1));
      // Could add to description or handle in UI
    }

    // Clean up the name - remove parsed elements to get clean task name
    let cleanName = text;

    // Remove time expressions
    cleanName = cleanName.replace(/\b\d{1,2}:\d{2}\s*(?:am|pm)?\b/gi, '');
    cleanName = cleanName.replace(/\b(?:am|pm)\b/gi, '');

    // Remove date expressions
    cleanName = cleanName.replace(/\b(?:today|tomorrow|yesterday)\b/gi, '');
    cleanName = cleanName.replace(/\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '');
    cleanName = cleanName.replace(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/gi, '');

    // Remove priority expressions
    cleanName = cleanName.replace(/\b(?:high|medium|low|none)\s+priority\b/gi, '');

    // Remove time estimates
    cleanName = cleanName.replace(/\b\d+(?:\.\d+)?\s*(?:h|hr|hrs|hours?|m|min|mins?|minutes?)\b/gi, '');

    // Remove recurring expressions
    cleanName = cleanName.replace(/\b(?:every|each)\s+(?:day|weekday|week|month|year)\b/gi, '');
    cleanName = cleanName.replace(/\bevery\s+\d+\s+(?:day|week|month)\b/gi, '');

    // Remove label markers
    cleanName = cleanName.replace(/#\w+/g, '');

    // Clean up extra whitespace and set as name if not empty
    cleanName = cleanName.trim().replace(/\s+/g, ' ');
    if (cleanName.length > 0) {
      result.name = cleanName;
    } else {
      // Fallback: use first 50 chars of original text
      result.name = text.substring(0, Math.min(50, text.length)).trim();
    }

    return result;
  }

  /**
   * Parse and suggest improvements to task text
   */
  static suggestImprovements(text: string): string {
    const parsed = this.parse(text);
    const suggestions: string[] = [];

    if (!parsed.name || parsed.name.length < 3) {
      suggestions.push("Consider making the task name more descriptive");
    }

    if (!parsed.date && !parsed.deadline) {
      suggestions.push("Adding a date or deadline can help with scheduling");
    }

    if (!parsed.priority) {
      suggestions.push("Setting a priority (high/medium/low) can help with focus");
    }

    if (!parsed.estimate_minutes) {
      suggestions.push("Adding a time estimate can improve planning");
    }

    return suggestions.join('. ');
  }
}