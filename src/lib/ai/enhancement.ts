/**
 * AI Enhancement Module
 * Provides predictive prioritization, natural language parsing, and context-aware suggestions
 */

import { Task } from '@/types/task';
import { ConflictArbiter } from '@/lib/conflict-arbiter';
import { useRBAC } from '@/lib/security/rbac';
import { versionControl } from '@/lib/conflict-resolution/version-control';
import { encryptionService } from '@/lib/security/encryption';

export type PriorityLevel = 'high' | 'medium' | 'low' | 'none';
export type TimeEstimate = number; // minutes

export interface SuggestedSchedule {
  startDate: Date;
  optimalStartTime: string;
  confidence: number;
}

export interface TaskSuggestion {
  priority: PriorityLevel;
  suggestedTimeEstimate: TimeEstimate;
  relatedTasks: string[];
  confidence: number;
  predictiveSchedule?: SuggestedSchedule;
}

export interface TaskFormData {
  name: string;
  description?: string;
  date?: string;
  deadline?: string;
  estimate_minutes?: number;
  priority?: PriorityLevel;
  is_recurring?: boolean;
  recurring_pattern?: string;
  recurring_custom_value?: string;
}

/**
 * Predictive Prioritization Engine
 * Analyzes tasks and suggests optimal priority based on multiple factors
 */
export class PredictivePrioritization {
  private static readonly DEADLINE_WEIGHT = 0.4;
  private static readonly DEPENDENCY_WEIGHT = 0.3;
  private static readonly RECENCY_WEIGHT = 0.2;
  private static readonly COMPLEXITY_WEIGHT = 0.1;

  /**
   * Predict optimal priority for a task
   */
  static predictPriority(task: Task, allTasks: Task[]): PriorityLevel {
    let score = 0;

    // Factor 1: Deadline proximity
    if (task.deadline) {
      const daysUntilDeadline = this.daysUntil(task.deadline);
      if (daysUntilDeadline <= 1) score += 30;
      else if (daysUntilDeadline <= 3) score += 20;
      else if (daysUntilDeadline <= 7) score += 10;
    }

    // Factor 2: Dependency count
    const dependentCount = allTasks.filter(t => t.dependencies?.includes(task.id ?? '')).length;
    score += dependentCount * 5;

    // Factor 3: Recency (newer tasks get higher priority)
    const daysSinceCreation = this.daysSince(task.created_at);
    if (daysSinceCreation <= 1) score += 15;
    else if (daysSinceCreation <= 3) score += 10;
    else if (daysSinceCreation <= 7) score += 5;

    // Factor 4: Dependency complexity
    if (task.dependencies && task.dependencies.length > 0) {
      score += task.dependencies.length * 3;
    }

    // Determine priority level
    if (score >= 50) return 'high';
    if (score >= 30) return 'medium';
    if (score > 0) return 'low';
    return 'none';
  }

  /**
   * Calculate days between two dates
   */
  private static daysUntil(date: string): number {
    const target = new Date(date).setHours(0, 0, 0, 0);
    const now = new Date().setHours(0, 0, 0, 0);
    return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
  }

  private static daysSince(createdAt: string): number {
    const created = new Date(createdAt).setHours(0, 0, 0, 0);
    const now = new Date().setHours(0, 0, 0, 0);
    return Math.ceil((now - created) / (1000 * 60 * 60 * 24));
  }
}

/**
 * Natural Language Task Parser
 * Parses user input into structured task data
 */
export class NaturalLanguageParser {
  /**
   * Parse a task description into structured form data
   */
  static parse(description: string): Partial<TaskFormData> {
    const result: Partial<TaskFormData> = {
      name: '',
      description: description,
      date: null,
      deadline: null,
      estimate_minutes: null,
      priority: 'medium',
      is_recurring: false,
      recurring_pattern: null,
      recurring_custom_value: null,
    };

    // Extract task name (first sentence or up to first period)
    const nameMatch = description.match(/^[^.!?]+/);
    if (nameMatch) {
      result.name = nameMatch[0].trim();
    }

    // Extract deadline patterns
    const deadlinePatterns = [
      /due\s+(?:on|by)?\s+([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s+\d{4})?)/i,
      /by\s+([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s+\d{4})?)/i,
      /deadline\s*[=:]\s*([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s+\d{4})?)/i
    ];

    for (const pattern of deadlinePatterns) {
      const match = description.match(pattern);
      if (match) {
        const parsedDate = this.parseDate(match[1]);
        if (parsedDate) {
          result.deadline = parsedDate;
          break;
        }
      }
    }

    // Extract date patterns
    const datePatterns = [
      /due\s+(?:on)?\s+([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s+\d{4})?)/i,
      /schedule[d]?\s+(?:for)?\s+([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s+\d{4})?)/i
    ];

    for (const pattern of datePatterns) {
      const match = description.match(pattern);
      if (match) {
        const parsedDate = this.parseDate(match[1]);
        if (parsedDate) {
          result.date = parsedDate;
          break;
        }
      }
    }

    // Extract time estimate patterns
    const timeEstimatePatterns = [
      /(\d+)\s*(?:hour|hours|hr)/i,
      /(\d+)\s*(?:minute|minutes|min)/i
    ];

    for (const pattern of timeEstimatePatterns) {
      const match = description.match(pattern);
      if (match) {
        const value = parseInt(match[1], 10);
        if (pattern.includes('hour')) {
          result.estimate_minutes = value * 60;
        } else {
          result.estimate_minutes = value;
        }
        break;
      }
    }

    // Detect recurring patterns
    const recurringPatterns = description.toLowerCase();
    if (recurringPatterns.includes('daily') || recurringPatterns.includes('every day')) {
      result.is_recurring = true;
      result.recurring_pattern = 'every_day';
    } else if (recurringPatterns.includes('weekly') || recurringPatterns.includes('every week')) {
      result.is_recurring = true;
      result.recurring_pattern = 'every_week';
    } else if (recurringPatterns.includes('monthly') || recurringPatterns.includes('every month')) {
      result.is_recurring = true;
      result.recurring_pattern = 'every_month';
    }

    return result;
  }

  /**
   * Parse human-readable date strings
   */
  private static parseDate(dateStr: string): string | null {
    // Handle relative dates
    const lower = dateStr.toLowerCase();

    if (lower.includes('today')) return new Date().toISOString().split('T')[0];
    if (lower.includes('tomorrow')) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow.toISOString().split('T')[0];
    }
    if (lower.includes('this week')) {
      const endOfWeek = new Date();
      endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
      return endOfWeek.toISOString().split('T')[0];
    }
    if (lower.includes('next week')) {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      return nextWeek.toISOString().split('T')[0];
    }

    // Try to parse as "Month Day, Year"
    const dateRegex = /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s*(\d{4})?/i;
    const match = dateStr.match(dateRegex);
    if (match) {
      const monthNames: Record<string, number> = {
        january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
        july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
      };
      const month = monthNames[match[1].toLowerCase()];
      const day = parseInt(match[2], 10);
      const year = match[3] ? parseInt(match[3], 10) : new Date().getFullYear();

      try {
        const date = new Date(year, month, day);
        return date.toISOString().split('T')[0];
      } catch {
        return null;
      }
    }

    // Try "Day Month Year" format
    const altRegex = /(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})?/i;
    const altMatch = dateStr.match(altRegex);
    if (altMatch) {
      const monthNames: Record<string, number> = {
        january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
        july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
      };
      const month = monthNames[altMatch[2].toLowerCase()];
      const day = parseInt(altMatch[1], 10);
      const year = altMatch[3] ? parseInt(altMatch[3], 10) : new Date().getFullYear();

      try {
        const date = new Date(year, month, day);
        return date.toISOString().split('T')[0];
      } catch {
        return null;
      }
    }

    return null;
  }
}

/**
 * Context-Aware Task Suggestions
 * Provides suggestions based on task history and context
 */
export class ContextAwareSuggestions {
  private static readonly HIGH_CONFIDENCE_THRESHOLD = 80;
  private static readonly MEDIUM_CONFIDENCE_THRESHOLD = 60;

  /**
   * Generate task suggestions based on similar completed tasks
   */
  static generateSuggestions(
    task: Task,
    completedTasks: Task[],
    currentContext: 'morning' | 'afternoon' | 'evening' | 'any' = 'any'
  ): TaskSuggestion {
    const priority = PredictivePrioritization.predictPriority(task, completedTasks);
    const confidence = this.calculateConfidence(task, completedTasks);

    // Estimate time based on similar tasks
    const similarTasks = completedTasks.filter(t =>
      t.priority === task.priority &&
      this.isSimilarComplexity(task, t)
    );

    let suggestedTimeEstimate = 30; // default
    if (similarTasks.length > 0) {
      const avgTime = similarTasks.reduce((sum, t) => sum + (t.estimate_minutes || 0), 0) / similarTasks.length;
      suggestedTimeEstimate = Math.round(avgTime);
    }

    // Generate related tasks based on dependencies and tags
    const relatedTasks = this.findRelatedTasks(task, completedTasks);

    // Predict schedule if confidence is high enough
    let predictiveSchedule: SuggestedSchedule | undefined;
    if (confidence >= this.HIGH_CONFIDENCE_THRESHOLD) {
      predictiveSchedule = this.predictSchedule(task, currentContext);
    }

    return {
      priority,
      suggestedTimeEstimate,
      relatedTasks,
      confidence,
      predictiveSchedule
    };
  }

  /**
   * Check if two tasks have similar complexity
   */
  private static isSimilarComplexity(task1: Task, task2: Task): boolean {
    const complexityDiff = Math.abs(
      (task1.estimate_minutes || 0) - (task2.estimate_minutes || 0)
    );
    return complexityDiff <= 30; // Within 30 minutes
  }

  /**
   * Find related tasks based on various factors
   */
  private static findRelatedTasks(
    task: Task,
    allTasks: Task[]
  ): string[] {
    const related: string[] = [];

    // Find tasks with shared dependencies
    if (task.dependencies) {
      allTasks.forEach(t => {
        if (t.dependencies && t.dependencies.some((dep: string) => task.dependencies!.includes(dep))) {
          if (!related.includes(t.id.toString())) related.push(t.id.toString());
        }
      });
    }

    // Find tasks with similar priority
    allTasks.forEach(t => {
      if (t.priority === task.priority && t.id !== task.id) {
        if (!related.includes(t.id.toString())) related.push(t.id.toString());
      }
    });

    return related.slice(0, 5); // Limit to 5 related tasks
  }

  /**
   * Predict optimal start time and date
   */
  private static predictSchedule(
    task: Task,
    context: 'morning' | 'afternoon' | 'evening' | 'any'
  ): SuggestedSchedule {
    const now = new Date();
    let startDate = new Date(now);
    let optimalStartTime: string;
    let confidence = 75; // base confidence

    // Adjust start date based on deadline
    if (task.deadline) {
      const deadline = new Date(task.deadline);
      const daysUntilDeadline = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

      if (daysUntilDeadline <= 1) {
        startDate = new Date(now);
        optimalStartTime = '09:00';
        confidence = 90;
      } else if (daysUntilDeadline <= 3) {
        startDate = new Date(now);
        optimalStartTime = '09:00';
        confidence = 80;
      } else {
        // Schedule for 2 days from now
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() + 2);
        optimalStartTime = '09:00';
        confidence = 70;
      }
    } else {
      // No deadline - schedule based on context
      switch (context) {
        case 'morning':
          optimalStartTime = '09:00';
          break;
        case 'afternoon':
          optimalStartTime = '14:00';
          break;
        case 'evening':
          optimalStartTime = '18:00';
          break;
        default:
          optimalStartTime = '09:00';
      }
      // Schedule for tomorrow
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() + 1);
      confidence = 65;
    }

    return {
      startDate,
      optimalStartTime,
      confidence
    };
  }

  /**
   * Calculate overall confidence score
   */
  private static calculateConfidence(task: Task, completedTasks: Task[]): number {
    let confidence = 50; // base confidence

    // Increase confidence based on historical data
    if (completedTasks.length > 0) {
      confidence += Math.min(20, completedTasks.length * 2);
    }

    // Increase confidence if task has clear deadline
    if (task.deadline) confidence += 10;

    // Increase confidence if task has dependencies
    if (task.dependencies && task.dependencies.length > 0) confidence += 5;

    // Cap at 100
    return Math.min(100, confidence);
  }
}

/**
 * Export convenient functions
 */
export const enhancement = {
  predictPriority: (task: Task, allTasks: Task[]): PriorityLevel =>
    PredictivePrioritization.predictPriority(task, allTasks),

  parseTask: (description: string): Partial<TaskFormData> =>
    NaturalLanguageParser.parse(description),

  suggestTasks: (
    task: Task,
    completedTasks: Task[],
    context?: 'morning' | 'afternoon' | 'evening' | 'any'
  ): TaskSuggestion => ContextAwareSuggestions.generateSuggestions(task, completedTasks, context)
};