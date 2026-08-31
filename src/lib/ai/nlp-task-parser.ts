import { NaturalLanguageParseResult } from './task-decomposition-engine';
import type { RecurringPattern } from './task-decomposition-engine';
import type { ParsedTask } from '@/lib/ai';
import * as chrono from 'chrono-node';
import { Component } from 'chrono-node';

export interface NLPParserConfig {
  defaultListId?: number;
  defaultEstimateMinutes?: number;
  timezone?: string;
  enableSmartDefaults?: boolean;
}

export interface ParsedDateTime {
  date?: Date;
  time?: string;
  isRecurring?: boolean;
  recurringPattern?: RecurringPattern;
  confidence: number;
}

/**
 * Natural Language Task Parser
 * Converts human language input into structured task data
 * Supports dates, times, priorities, recurring patterns, labels, and more
 */
export class NaturalLanguageTaskParser {
  private config: NLPParserConfig;
  private priorityKeywords: Map<string, 'high' | 'medium' | 'low' | 'none'> = new Map();
  private recurringPatterns: Map<string, RecurringPattern> = new Map();
  private labelPatterns: RegExp[] = [];

  constructor(config: NLPParserConfig = {}) {
    this.config = {
      defaultListId: config.defaultListId ?? 1,
      defaultEstimateMinutes: config.defaultEstimateMinutes ?? 30,
      timezone: config.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      enableSmartDefaults: config.enableSmartDefaults ?? true,
    };

    this.initializePriorityKeywords();
    this.initializeRecurringPatterns();
    this.initializeLabelPatterns();
  }

  private initializePriorityKeywords(): void {
    this.priorityKeywords.set('urgent', 'high');
    this.priorityKeywords.set('critical', 'high');
    this.priorityKeywords.set('asap', 'high');
    this.priorityKeywords.set('important', 'high');
    this.priorityKeywords.set('high priority', 'high');
    this.priorityKeywords.set('p0', 'high');
    this.priorityKeywords.set('p1', 'high');
    this.priorityKeywords.set('normal', 'medium');
    this.priorityKeywords.set('medium', 'medium');
    this.priorityKeywords.set('standard', 'medium');
    this.priorityKeywords.set('p2', 'medium');
    this.priorityKeywords.set('p3', 'medium');
    this.priorityKeywords.set('low', 'low');
    this.priorityKeywords.set('minor', 'low');
    this.priorityKeywords.set('optional', 'low');
    this.priorityKeywords.set('nice to have', 'low');
    this.priorityKeywords.set('p4', 'low');
    this.priorityKeywords.set('whenever', 'none');
  }

  private initializeRecurringPatterns(): void {
    this.recurringPatterns.set('daily', 'every_day');
    this.recurringPatterns.set('every day', 'every_day');
    this.recurringPatterns.set('weekdays', 'every_weekday');
    this.recurringPatterns.set('weekly', 'every_week');
    this.recurringPatterns.set('every week', 'every_week');
    this.recurringPatterns.set('monthly', 'every_month');
    this.recurringPatterns.set('every month', 'every_month');
    this.recurringPatterns.set('yearly', 'every_year');
    this.recurringPatterns.set('annually', 'every_year');
    this.recurringPatterns.set('every monday', 'custom_days_of_month');
    this.recurringPatterns.set('every tuesday', 'custom_days_of_month');
    this.recurringPatterns.set('every wednesday', 'custom_days_of_month');
    this.recurringPatterns.set('every thursday', 'custom_days_of_month');
    this.recurringPatterns.set('every friday', 'custom_days_of_month');
    this.recurringPatterns.set('every saturday', 'custom_days_of_month');
    this.recurringPatterns.set('every sunday', 'custom_days_of_month');
  }

  private initializeLabelPatterns(): void {
    this.labelPatterns = [
      /#(\w+)/g,           // #label
      /@(\w+)/g,           // @context
      /\[(\w+)\]/g,        // [tag]
    ];
  }

  /**
   * Parse natural language input into structured task(s)
   */
  parse(input: string): NaturalLanguageParseResult {
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Split input into potential multiple tasks
    const taskSegments = this.splitIntoTasks(input);

    const tasks: ParsedTask[] = [];

    for (const segment of taskSegments) {
      const parsed = this.parseSingleTask(segment.trim());
      if (parsed) {
        tasks.push(parsed);
      }
    }

    // Calculate overall confidence
    const confidence = tasks.length > 0
      ? tasks.reduce((sum, t) => sum + (t.confidence || 0.8), 0) / tasks.length
      : 0;

    // Generate warnings and suggestions
    if (tasks.length === 0) {
      warnings.push('Could not parse any tasks from input');
      suggestions.push('Try being more specific: "Buy groceries tomorrow at 5pm"');
    }

    tasks.forEach((task, index) => {
      if (!task.dueDate && !task.deadline && this.config.enableSmartDefaults) {
        warnings.push(`Task ${index + 1} has no date - will default to today`);
        suggestions.push('Add a time like "tomorrow", "next Monday", or "in 2 hours"');
      }
      if (!task.estimateMinutes && this.config.enableSmartDefaults) {
        suggestions.push(`Consider adding time estimate for task ${index + 1} (e.g., "~30min")`);
      }
    });

    return {
      tasks,
      confidence,
      warnings,
      suggestions,
    };
  }

  private splitIntoTasks(input: string): string[] {
    // Split by common task separators
    const separators = [
      /\n\s*\n/,           // Double newline
      /;\s*/,              // Semicolon
      /\.\s+(?=[A-Z])/,    // Period followed by capital letter
      /\|\s*/,             // Pipe
      /,\s*(?=(?:buy|call|email|write|finish|complete|start|begin|schedule|plan|review|check|update|send|create|make|do|go|meet|pick up|drop off))/i,
    ];

    let segments = [input];

    for (const separator of separators) {
      const newSegments: string[] = [];
      for (const segment of segments) {
        newSegments.push(...segment.split(separator).filter(s => s.trim().length > 0));
      }
      segments = newSegments;
    }

    return segments.filter(s => s.trim().length > 3); // Filter out very short segments
  }

  private parseSingleTask(input: string): ParsedTask | null {
    if (input.trim().length < 3) return null;

    const originalInput = input;
    let remainingInput = input;

    // Extract labels first
    const labels = this.extractLabels(remainingInput);
    remainingInput = this.removeLabels(remainingInput);

    // Extract priority
    const priority = this.extractPriority(remainingInput);
    remainingInput = this.removePriorityKeywords(remainingInput);

    // Extract recurring pattern
    const { pattern: recurringPattern, isRecurring } = this.extractRecurringPattern(remainingInput);
    remainingInput = this.removeRecurringKeywords(remainingInput);

    // Extract time estimates
    const estimateMinutes = this.extractEstimate(remainingInput);
    remainingInput = this.removeEstimateKeywords(remainingInput);

    // Extract dates using chrono-node
    const dateTimeInfo = this.extractDateTime(remainingInput);

    // Clean up the task name
    const name = this.cleanTaskName(remainingInput, dateTimeInfo);

    // Build parsed task
    const parsed: ParsedTask = {
      name: name || this.extractMainAction(originalInput) || 'Untitled Task',
      description: originalInput.length > name.length ? originalInput : undefined,
      dueDate: dateTimeInfo.date,
      deadline: dateTimeInfo.date,
      estimateMinutes: estimateMinutes ?? this.config.defaultEstimateMinutes,
      priority,
      isRecurring,
      recurringPattern,
      labels: labels.length > 0 ? labels : undefined,
      listId: this.config.defaultListId,
      confidence: this.calculateConfidence(name, dateTimeInfo, priority, estimateMinutes),
    };

    return parsed;
  }

  private extractLabels(input: string): string[] {
    const labels: string[] = [];
    for (const pattern of this.labelPatterns) {
      const matches = input.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const label = match.slice(1, -1); // Remove #, @, or []
          if (label.length > 1) labels.push(label);
        });
      }
    }
    return [...new Set(labels)]; // Deduplicate
  }

  private removeLabels(input: string): string {
    let result = input;
    for (const pattern of this.labelPatterns) {
      result = result.replace(pattern, '').trim();
    }
    return result;
  }

  private extractPriority(input: string): 'high' | 'medium' | 'low' | 'none' {
    const lowerInput = input.toLowerCase();
    for (const [keyword, priority] of this.priorityKeywords) {
      if (lowerInput.includes(keyword.toLowerCase())) {
        return priority;
      }
    }
    return 'none';
  }

  private removePriorityKeywords(input: string): string {
    let result = input;
    for (const keyword of this.priorityKeywords.keys()) {
      const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      result = result.replace(regex, '').trim();
    }
    return result;
  }

  private extractRecurringPattern(input: string): { pattern?: RecurringPattern; isRecurring: boolean } {
    const lowerInput = input.toLowerCase();

    for (const [keyword, pattern] of this.recurringPatterns) {
      if (lowerInput.includes(keyword)) {
        return { pattern, isRecurring: true };
      }
    }

    // Check for custom patterns like "every 3 days"
    const customMatch = lowerInput.match(/every\s+(\d+)\s+(day|week|month|year)s?/);
    if (customMatch) {
      const num = parseInt(customMatch[1]);
      const unit = customMatch[2];
      if (unit === 'day') return { pattern: 'custom_n_days', isRecurring: true };
      if (unit === 'week') return { pattern: 'custom_n_weeks', isRecurring: true };
    }

    return { isRecurring: false };
  }

  private removeRecurringKeywords(input: string): string {
    let result = input;
    for (const keyword of this.recurringPatterns.keys()) {
      const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      result = result.replace(regex, '').trim();
    }
    // Remove custom patterns
    result = result.replace(/\bevery\s+\d+\s+(day|week|month|year)s?\b/gi, '').trim();
    return result;
  }

  private extractEstimate(input: string): number | undefined {
    const patterns = [
      /~(\d+(?:\.\d+)?)\s*(?:h|hr|hour|hours?)/gi,
      /(\d+(?:\.\d+)?)\s*(?:h|hr|hour|hours?)\b/gi,
      /~(\d+)\s*(?:m|min|minute|minutes?)\b/gi,
      /(\d+)\s*(?:m|min|minute|minutes?)\b/gi,
      /~(\d+)\s*min/gi,
      /estimate[:\s]*(\d+(?:\.\d+)?)\s*(?:h|hr|hour|hours?)/gi,
      /effort[:\s]*(\d+(?:\.\d+)?)\s*(?:h|hr|hour|hours?)/gi,
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) {
        const numStr = match[1] || match[0].match(/\d+(?:\.\d+)?/)?.[0];
        if (numStr) {
          const num = parseFloat(numStr);
          // Check if it's hours or minutes
          const isHours = /h|hr|hour/.test(match[0]);
          return isHours ? Math.round(num * 60) : num;
        }
      }
    }

    return undefined;
  }

  private removeEstimateKeywords(input: string): string {
    let result = input;
    const patterns = [
      /~?\d+(?:\.\d+)?\s*(?:h|hr|hour|hours?)\b/gi,
      /~?\d+\s*(?:m|min|minute|minutes?)\b/gi,
      /estimate[:\s]*\d+(?:\.\d+)?\s*(?:h|hr|hour|hours?)/gi,
      /effort[:\s]*\d+(?:\.\d+)?\s*(?:h|hr|hour|hours?)/gi,
    ];
    for (const pattern of patterns) {
      result = result.replace(pattern, '').trim();
    }
    return result;
  }

  private extractDateTime(input: string): ParsedDateTime {
    // Use chrono-node for robust date parsing
    const results = chrono.parse(input, new Date(), { forwardDate: true });

    if (results.length === 0) {
      return { confidence: 0 };
    }

    // Get the best match
    const bestResult = results[0];
    const startDate = bestResult.start.date();

    return {
      date: startDate,
      time: undefined,
      isRecurring: false, // Handled separately
      confidence: 0.9,
    };
  }

  private cleanTaskName(input: string, dateTimeInfo: ParsedDateTime): string {
    let name = input.trim();

    // Remove date/time references that chrono might have parsed
    if (dateTimeInfo.date) {
      // Remove common date phrases
      const datePatterns = [
        /\b(today|tomorrow|yesterday)\b/gi,
        /\b(next|this|last)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month|year)\b/gi,
        /\bin\s+\d+\s+(day|week|month|year)s?\b/gi,
        /\bon\s+\w+\s+\d+/gi,
        /\b\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?\b/g,
        /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}/gi,
        /\bat\s+\d{1,2}:\d{2}\s*(?:am|pm)?/gi,
        /\b\d{1,2}:\d{2}\s*(?:am|pm)/gi,
      ];

      for (const pattern of datePatterns) {
        name = name.replace(pattern, '').trim();
      }
    }

    // Clean up extra whitespace and punctuation
    name = name.replace(/\s+/g, ' ').trim();
    name = name.replace(/^[,\s]+|[,\s]+$/g, '');

    // Capitalize first letter
    if (name) {
      name = name.charAt(0).toUpperCase() + name.slice(1);
    }

    return name;
  }

  private extractMainAction(input: string): string | null {
    // Try to extract the main verb/action from the input
    const actionVerbs = [
      'buy', 'purchase', 'get', 'pick up', 'grab',
      'call', 'phone', 'email', 'message', 'text', 'contact',
      'write', 'draft', 'create', 'make', 'build', 'develop',
      'finish', 'complete', 'done', 'wrap up',
      'start', 'begin', 'initiate', 'launch',
      'schedule', 'book', 'arrange', 'plan',
      'review', 'check', 'verify', 'inspect', 'audit',
      'update', 'modify', 'change', 'edit', 'revise',
      'send', 'submit', 'deliver', 'ship',
      'meet', 'meeting', 'sync', 'call',
      'learn', 'study', 'read', 'watch', 'listen',
      'exercise', 'workout', 'run', 'walk', 'gym',
      'clean', 'organize', 'tidy', 'declutter',
      'cook', 'prepare', 'meal prep',
      'pay', 'bill', 'invoice', 'transfer',
    ];

    const lowerInput = input.toLowerCase();
    for (const verb of actionVerbs) {
      const regex = new RegExp(`\\b${verb}\\b`, 'i');
      const match = lowerInput.match(regex);
      if (match) {
        // Return the rest of the sentence after the verb
        const index = lowerInput.indexOf(verb) + verb.length;
        const remainder = input.slice(index).trim();
        if (remainder) return remainder;
        return verb.charAt(0).toUpperCase() + verb.slice(1);
      }
    }

    return null;
  }

  private calculateConfidence(
    name: string,
    dateTimeInfo: ParsedDateTime,
    priority: string,
    estimateMinutes: number | undefined
  ): number {
    let confidence = 0.5; // Base confidence

    if (name && name.length > 3) confidence += 0.2;
    if (dateTimeInfo.date) confidence += 0.15;
    if (priority !== 'none') confidence += 0.1;
    if (estimateMinutes) confidence += 0.05;

    return Math.min(confidence, 1.0);
  }

  /**
   * Parse a quick-add style input (e.g., "Buy milk tomorrow #errands ~15min")
   */
  parseQuickAdd(input: string): ParsedTask | null {
    return this.parseSingleTask(input);
  }

  /**
   * Get parsing suggestions for autocomplete
   */
  getSuggestions(partialInput: string): string[] {
    const suggestions: string[] = [];

    // Time suggestions
    if (!/\b(tomorrow|today|next|in\s+\d+)\b/i.test(partialInput)) {
      suggestions.push('tomorrow', 'next Monday', 'in 2 hours', 'Friday');
    }

    // Priority suggestions
    if (!/[#@]/.test(partialInput) && !/urgent|high|low|medium/i.test(partialInput)) {
      suggestions.push('#work', '#personal', 'urgent', 'low priority');
    }

    // Estimate suggestions
    if (!/~?\d+\s*(?:h|m|min)/i.test(partialInput)) {
      suggestions.push('~30min', '~1hr', '~2hr');
    }

    // Recurring suggestions
    if (!/every|daily|weekly|monthly/i.test(partialInput)) {
      suggestions.push('daily', 'weekly', 'every Monday');
    }

    return suggestions.slice(0, 5);
  }
}

// Singleton instance
export const nlpTaskParser = new NaturalLanguageTaskParser();