import db from './db/schema';
import { Task, TaskWithDetails } from './types';
import { parseRecurringPattern } from './recurring';

/**
 * Context-Aware Task Suggestion System
 *
 * Provides intelligent task suggestions based on:
 * - User's task patterns and completion history
 * - Common task combinations
 * - Time of day and day of week
 * - Project/goal alignment
 * - Recurring task patterns
 * - Dependency analysis
 */

export interface SuggestionContext {
  userId?: string;
  currentTime?: Date;
  recentTasks?: Task[];
  completedTasks?: Task[];
  activeProjects?: number[];
  timeOfDay?: 'morning' | 'afternoon' | 'evening';
  dayOfWeek?: number; // 0-6 where 0 is Sunday
  goals?: string[];
  recentSearches?: string[];
}

export interface TaskSuggestion {
  id?: string;
  taskName: string;
  description?: string;
  estimatedMinutes?: number;
  priority?: 'high' | 'medium' | 'low';
  suggestedDate?: string | null; // ISO date string or null
  isRecurring?: boolean;
  recurringPattern?: string;
  relatedToTaskIds?: number[];
  relevanceScore: number; // 0-1, how relevant this suggestion is
  reason: string; // Why this suggestion was made
}

/**
 * Get suggestions based on user's task patterns and context
 */
export async function getTaskSuggestions(
  context: SuggestionContext
): Promise<TaskSuggestion[]> {
  const suggestions: TaskSuggestion[] = [];

  // Get user's task history
  const recentTasks = context.recentTasks || await getRecentTasks(10);
  const completedTasks = context.completedTasks || await getCompletedTasks(30);

  if (recentTasks.length === 0) {
    return suggestions;
  }

  // 1. Analyze common task patterns
  const patternSuggestions = analyzeTaskPatterns(recentTasks, completedTasks);
  suggestions.push(...patternSuggestions);

  // 2. Generate time-based suggestions
  const timeSuggestions = generateTimeBasedSuggestions(
    context.timeOfDay,
    context.dayOfWeek,
    recentTasks
  );
  suggestions.push(...timeSuggestions);

  // 3. Analyze recurring task patterns
  const recurringSuggestions = analyzeRecurringPatterns(recentTasks);
  suggestions.push(...recurringSuggestions);

  // 4. Goal-aligned suggestions
  if (context.goals && context.goals.length > 0) {
    const goalSuggestions = alignWithGoals(recentTasks, context.goals);
    suggestions.push(...goalSuggestions);
  }

  // 5. Recent search-based suggestions
  if (context.recentSearches && context.recentSearches.length > 0) {
    const searchSuggestions = basedOnRecentSearches(context.recentSearches, recentTasks);
    suggestions.push(...searchSuggestions);
  }

  // Sort by relevance score (descending)
  suggestions.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Return top 10 suggestions
  return suggestions.slice(0, 10);
}

/**
 * Analyze task patterns to suggest similar or follow-up tasks
 */
function analyzeTaskPatterns(
  recentTasks: Task[],
  completedTasks: Task[]
): TaskSuggestion[] {
  const suggestions: TaskSuggestion[] = [];

  // Find common task prefixes/keywords
  const taskWordFreq = new Map<string, number>();
  const completedWordFreq = new Map<string, number>();

  recentTasks.forEach(task => {
    const words = task.name.toLowerCase().split(' ').filter(w => w.length > 3);
    words.forEach(word => {
      taskWordFreq.set(word, (taskWordFreq.get(word) || 0) + 1);
    });
  });

  completedTasks.forEach(task => {
    const words = task.name.toLowerCase().split(' ').filter(w => w.length > 3);
    words.forEach(word => {
      completedWordFreq.set(word, (completedWordFreq.get(word) || 0) + 1);
    });
  });

  // Suggest tasks based on frequently occurring words in recent vs completed
  taskWordFreq.forEach((frequency, word) => {
    if (frequency >= 2 && !completedWordFreq.has(word)) {
      // This word appears frequently in recent tasks but not in completed
      const relatedTasks = recentTasks.filter(t =>
        t.name.toLowerCase().includes(word)
      );

      if (relatedTasks.length > 0) {
        const avgEstimate = relatedTasks.reduce((sum, t) => sum + (t.estimate_minutes || 0), 0) / relatedTasks.length;

        suggestions.push({
          taskName: `${word} task`,
          description: `Follow up on "${word}" tasks you've been working on`,
          estimatedMinutes: Math.round(avgEstimate),
          priority: 'medium',
          relevanceScore: Math.min(frequency / 10, 1),
          reason: `You have ${frequency} recent tasks involving "${word}"`
        });
      }
    }
  });

  return suggestions;
}

/**
 * Generate time-based suggestions (morning planning, evening wrap-up, etc.)
 */
function generateTimeBasedSuggestions(
  timeOfDay?: 'morning' | 'afternoon' | 'evening',
  dayOfWeek?: number,
  recentTasks: Task[]
): TaskSuggestion[] {
  const suggestions: TaskSuggestion[] = [];

  // Morning suggestions - planning and high-priority tasks
  if (timeOfDay === 'morning' || (!timeOfDay && dayOfWeek && dayOfWeek >= 1 && dayOfWeek <= 5)) {
    // Suggest planning/organization tasks
    suggestions.push({
      taskName: 'Daily planning session',
      description: 'Review and prioritize tasks for today',
      estimatedMinutes: 15,
      priority: 'high',
      suggestedDate: formatDateForToday(),
      relevanceScore: 0.8,
      reason: 'Morning is optimal for planning and prioritization'
    });

    // Suggest tackling high-priority tasks first
    const highPriority = recentTasks.filter(t => t.priority === 'high' && t.is_completed === 0);
    if (highPriority.length > 0) {
      suggestions.push({
        taskName: 'Complete high-priority task',
        description: 'Start with your most important task',
        estimatedMinutes: highPriority[0]?.estimate_minutes || 60,
        priority: 'high',
        relevanceScore: 0.7,
        reason: 'Complete your most important task early in the day'
      });
    }
  }

  // Afternoon suggestions - progress and collaboration
  if (timeOfDay === 'afternoon' || (!timeOfDay && dayOfWeek && dayOfWeek >= 1 && dayOfWeek <= 5)) {
    suggestions.push({
      taskName: 'Progress check',
      description: 'Review morning progress and adjust priorities',
      estimatedMinutes: 10,
      priority: 'medium',
      relevanceScore: 0.6,
      reason: 'Afternoon check-in to stay on track'
    });

    // Suggest collaboration tasks
    const collaborationTasks = recentTasks.filter(t =>
      t.name.toLowerCase().includes('meeting') ||
      t.name.toLowerCase().includes('call') ||
      t.name.toLowerCase().includes('discuss')
    );
    if (collaborationTasks.length > 0) {
      suggestions.push({
        taskName: 'Schedule collaborative session',
        description: 'Book time for team collaboration or discussion',
        estimatedMinutes: 30,
        priority: 'medium',
        relevanceScore: 0.5,
        reason: 'Afternoon is good for team interactions'
      });
    }
  }

  // Evening suggestions - wrap-up and planning
  if (timeOfDay === 'evening' || (!timeOfDay && dayOfWeek && dayOfWeek >= 1 && dayOfWeek <= 5)) {
    suggestions.push({
      taskName: 'End-of-day wrap-up',
      description: 'Review completed tasks and plan tomorrow',
      estimatedMinutes: 15,
      priority: 'medium',
      suggestedDate: formatDateForTomorrow(),
      relevanceScore: 0.8,
      reason: 'Evening wrap-up helps with next-day productivity'
    });

    // Suggest recurring weekly review
    suggestions.push({
      taskName: 'Weekly review',
      description: 'Reflect on the week and set goals for next week',
      estimatedMinutes: 30,
      priority: 'medium',
      relevanceScore: 0.7,
      reason: 'Weekly review every Friday helps with long-term planning'
    });
  }

  return suggestions;
}

/**
 * Analyze recurring task patterns and suggest similar recurring tasks
 */
function analyzeRecurringPatterns(recentTasks: Task[]): TaskSuggestion[] {
  const suggestions: TaskSuggestion[] = [];

  // Find tasks that might benefit from being made recurring
  const recurringCandidates = recentTasks.filter(task => {
    // Tasks that are repeated frequently or have similar names
    const name = task.name.toLowerCase();
    // Check if this task type appears to be a regular pattern
    return /^(daily|weekly|monthly|every)/.test(name) ||
           /(follow.up|check|review|call|meeting)/.test(name);
  });

  recurringCandidates.forEach(task => {
    // Suggest making this task recurring
    suggestions.push({
      taskName: `Make "${task.name}" recurring`,
      description: `Set up recurring pattern for this regularly-occurring task`,
      estimatedMinutes: task.estimate_minutes || 30,
      priority: 'low',
      isRecurring: true,
      relevanceScore: 0.6,
      reason: 'This task appears to be part of a regular pattern'
    });
  });

  return suggestions;
}

/**
 * Align tasks with user goals
 */
function alignWithGoals(recentTasks: Task[], goals: string[]): TaskSuggestion[] {
  const suggestions: TaskSuggestion[] = [];

  goals.forEach(goal => {
    // Find tasks related to this goal
    const relatedTasks = recentTasks.filter(task =>
      task.name.toLowerCase().includes(goal.toLowerCase()) ||
      (task.description && task.description.toLowerCase().includes(goal.toLowerCase()))
    );

    if (relatedTasks.length > 0) {
      const mostRecent = relatedTasks[relatedTasks.length - 1];
      suggestions.push({
        taskName: `${goal}: Continue progress`,
        description: `Continue work toward "${goal}" - last task: ${mostRecent.name}`,
        estimatedMinutes: mostRecent.estimate_minutes || 45,
        priority: 'high',
        relevanceScore: 0.7,
        reason: `Aligned with your goal: "${goal}"`
      });
    } else {
      // No existing tasks, suggest starting
      suggestions.push({
        taskName: `Start working on "${goal}"`,
        description: `Begin tasks related to your goal: "${goal}"`,
        estimatedMinutes: 60,
        priority: 'high',
        relevanceScore: 0.5,
        reason: `New task aligned with your goal: "${goal}"`
      });
    }
  });

  return suggestions;
}

/**
 * Generate suggestions based on recent searches
 */
function basedOnRecentSearches(recentSearches: string[], recentTasks: Task[]): TaskSuggestion[] {
  const suggestions: TaskSuggestion[] = [];

  recentSearches.forEach(search => {
    // Find tasks matching the search term
    const matchingTasks = recentTasks.filter(task =>
      task.name.toLowerCase().includes(search.toLowerCase()) ||
      (task.description && task.description.toLowerCase().includes(search.toLowerCase()))
    );

    if (matchingTasks.length > 0) {
      const mostRecent = matchingTasks[matchingTasks.length - 1];
      suggestions.push({
        taskName: `Follow up: ${search}`,
        description: `Task related to your recent search for "${search}"`,
        estimatedMinutes: mostRecent.estimate_minutes || 30,
        priority: 'medium',
        relevanceScore: 0.6,
        reason: `Matches your recent search: "${search}"`
      });
    } else {
      // No matching tasks, suggest creating one
      suggestions.push({
        taskName: `New task: ${search}`,
        description: `Create a new task related to "${search}"`,
        estimatedMinutes: 45,
        priority: 'medium',
        relevanceScore: 0.4,
        reason: `New task based on recent search: "${search}"`
      });
    }
  });

  return suggestions;
}

/**
 * Format today's date as ISO string
 */
function formatDateForToday(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

/**
 * Format tomorrow's date as ISO string
 */
function formatDateForTomorrow(): string {
  const tomorrow = new Date(Date.now() + 86400000);
  return tomorrow.toISOString().split('T')[0];
}

/**
 * Get recent tasks from database
 */
async function getRecentTasks(limit: number): Promise<Task[]> {
  if (typeof window === 'undefined') {
    try {
      const Database = require('better-sqlite3');
      const dbPath = require('path').join(process.cwd(), 'data', 'planner.db');
      const dbInstance = new Database(dbPath);
      return dbInstance.prepare(
        'SELECT * FROM tasks ORDER BY created_at DESC LIMIT ?'
      ).all(limit) as Task[];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Get completed tasks from database
 */
async function getCompletedTasks(limit: number): Promise<Task[]> {
  if (typeof window === 'undefined') {
    try {
      const Database = require('better-sqlite3');
      const dbPath = require('path').join(process.cwd(), 'data', 'planner.db');
      const dbInstance = new Database(dbPath);
      return dbInstance.prepare(
        'SELECT * FROM tasks WHERE is_completed = 1 ORDER BY completed_at DESC LIMIT ?'
      ).all(limit) as Task[];
    } catch {
      return [];
    }
  }
  return [];
}

export { getTaskSuggestions, SuggestionContext, TaskSuggestion };