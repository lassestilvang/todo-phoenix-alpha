import { parse } from 'chrono-node';
import type { TaskFormData, Priority, RecurringPattern } from '@/lib/types';

export class TaskParser {
  /**
   * Parse natural language text into task properties with enhanced logic
   */
  static parse(text: string): Partial<TaskFormData> {
    if (!text || text.trim() === '') {
      return {
        name: text ? text.trim() : '',
        description: text, // Preserve original text in description
      };
    }

    const result: Partial<TaskFormData> = {
      name: '',
      description: text.trim()
    };

    // Parse dates/times using chrono-node
    const parsed = parse(text, new Date(), {
      forwardDate: true,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });

    // Extract date and deadline from parsed results
    if (parsed.length > 0) {
      // Find the best date match - prefer certain dates with values
      let bestMatch: any = parsed[0];
      for (const match of parsed) {
        const currentCertain = match.start.isCertain('date');
        const bestCertain = bestMatch.start.isCertain('date');
        const currentHasValue = !!match.start.dateValue;
        const bestHasValue = !!bestMatch.start.dateValue;

        // Priority: certain date with value > uncertain date with value > certain date > uncertain date
        if (currentHasValue && !bestHasValue) {
          bestMatch = match;
        } else if (currentHasValue && bestHasValue && match.start.dateValue > bestMatch.start.dateValue) {
          bestMatch = match;
        } else if (!currentHasValue && !bestHasValue && currentCertain && !bestCertain) {
          bestMatch = match;
        } else if (!currentHasValue && !bestHasValue && currentCertain === bestCertain && match.text.length > bestMatch.text.length) {
          bestMatch = match;
        }
      }

      const dateObj = bestMatch.start.dateValue;

      // If chrono-node didn't extract a date value, use simple heuristics
      let effectiveDate: Date | null = dateObj ? new Date(dateObj) : null;

      // Fallback: simple date extraction for common phrases
      if (!effectiveDate) {
        const todayMatch = text.toLowerCase().match(/\b(today|tomorrow)\b/);
        if (todayMatch) {
          const refDate = new Date();
          effectiveDate = new Date(refDate);
          if (todayMatch[1] === 'tomorrow') {
            effectiveDate.setDate(refDate.getDate() + 1);
          }
        }
      }

      // Additional fallback: extract time from common patterns like "at 3pm", "3pm", etc.
      if (!effectiveDate) {
        const timePatternMatch = text.toLowerCase().match(/\b(\d+)(:?(\d{2}))?\s*(am|pm)?\b/);
        if (timePatternMatch) {
          const hour = parseInt(timePatternMatch[1], 10);
          const minute = timePatternMatch[3] ? parseInt(timePatternMatch[3], 10) : 0;
          const ampm = timePatternMatch[4];
          const refDate = new Date();
          const formattedHour = ampm && ampm[0].toLowerCase() === 'pm' && hour < 12
            ? hour + 12
            : ampm && ampm[0].toLowerCase() === 'am' && hour === 12 ? 0 : hour;
          effectiveDate = new Date(refDate);
          effectiveDate.setHours(formattedHour, minute);
        }
      }

      // Set date and deadline based on extracted information
      if (effectiveDate) {
        // Check if the text explicitly mentions a deadline/time
        const hasDeadlineKeywords = text.toLowerCase().includes('at ') ||
          text.toLowerCase().includes(':') ||
          text.toLowerCase().includes('am') ||
          text.toLowerCase().includes('pm');

        if (hasDeadlineKeywords) {
          // Handle time extraction from chrono-node and AM/PM patterns
          result.deadline = effectiveDate;
          // If the text includes AM/PM or colon patterns, ensure the time is preserved
          // For "at 3pm" style inputs, the deadline should have the correct hour
          if (/pm|am|\d+:\d+/.test(text)) {
            // Ensure hour is correctly set based on AM/PM
            const ampmMatch = text.toLowerCase().match(/(\d+)(am|pm)/);
            if (ampmMatch) {
              const hour = parseInt(ampmMatch[1], 10);
              const ampm = ampmMatch[2];
              if (ampm === 'pm' && hour < 12) {
                // Convert to 24-hour format
                effectiveDate.setHours(hour + 12);
              } else if (ampm === 'am' && hour === 12) {
                // Midnight case
                effectiveDate.setHours(0);
              }
            }
          }
          // Also set date if it's a date-only reference (no am/pm patterns)
          if (!/pm|am|\d+:\d+/.test(text)) {
            result.date = effectiveDate;
          }
        } else {
          // Date-only or ambiguous - set both for flexibility
          result.date = effectiveDate;
          result.deadline = effectiveDate;
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

    // First check for custom patterns (every N days/weeks/months)
    const customPatternMatch = text.toLowerCase().match(/every\s+(\d+)\s+(day|week|month)/);
    if (customPatternMatch) {
      result.is_recurring = true;
      const value = parseInt(customPatternMatch[1], 10);
      const unit = customPatternMatch[2];

      if (unit === 'day') {
        result.recurring_pattern = 'custom_n_days';
        result.recurring_custom_value = value.toString();
      } else if (unit === 'week') {
        result.recurring_pattern = 'custom_n_weeks';
        result.recurring_custom_value = value.toString();
      } else if (unit === 'month') {
        result.recurring_pattern = 'custom_days_of_month';
        result.recurring_custom_value = value.toString();
      }
    } else {
      // Check for static patterns
      for (const [patternText, patternEnum] of Object.entries(recurringPatterns)) {
        if (text.toLowerCase().includes(patternText)) {
          result.is_recurring = true;
          result.recurring_pattern = patternEnum;
          break;
        }
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
    cleanName = cleanName.replace(/\b\d{1,2}\s*:\d{2}\s*(?:am|pm)?\b/gi, '');
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

    // Suggest name improvement for very generic names (3 chars or less, or common vague phrases)
    const genericNames = ['do something', 'task', 'todo', 'thing', 'stuff'];
    const isGenericName = genericNames.includes(parsed.name.toLowerCase()) ||
                          (parsed.name.length > 0 && parsed.name.length <= 3);

    if (isGenericName) {
      suggestions.push('Consider making the task name more descriptive');
    }

    if (!parsed.date && !parsed.deadline) {
      suggestions.push('Adding a date or deadline can help with scheduling');
    }

    if (!parsed.priority) {
      suggestions.push('Setting a priority (high/medium/low) can help with focus');
    }

    if (!parsed.estimate_minutes) {
      suggestions.push('Adding a time estimate can improve planning');
    }

    return suggestions.join('. ');
  }

  /**
   * Generate enhanced AI suggestions for task text
   */
  static async generateEnhancedSuggestions(text: string): Promise<string> {
    const parsed = this.parse(text);
    const suggestions: string[] = [];

    // Check for missing critical information
    if (!parsed.date && !parsed.deadline) {
      suggestions.push('Consider setting a deadline for better time management');
    }

    if (!parsed.priority) {
      suggestions.push('Priority not set - consider if this is high/medium/low importance');
    }

    if (!parsed.estimate_minutes) {
      suggestions.push('No time estimate - this helps with scheduling accuracy');
    }

    // Verify the name is descriptive
    if (parsed.name.length <= 3 || ['task', 'todo', 'item'].includes(parsed.name.toLowerCase())) {
      suggestions.push('Make task name more specific and actionable');
    }

    return suggestions.join('. ');
  }
};

// Export createTaskFromNLP for use in actions
export async function createTaskFromNLP(text: string, listId: number) {
  // This is a wrapper that would typically call the server action
  // For now, we'll parse and return the task data structure
  const parsed = TaskParser.parse(text);

  // In a real implementation, this would call the server action
  // But for testing purposes, we return a mock task-like object
  return {
    ...parsed,
    list_id: listId,
    id: Date.now(), // Mock ID
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
// Backwards compatibility export for tests
export async function parseTaskInput(input: string): Promise<any> {
  const parsed = TaskParser.parse(input);
  return {
    id: 1,
    ...parsed,
  };
}
