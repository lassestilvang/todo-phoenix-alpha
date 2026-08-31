/**
 * Task Form Integration with AI Features
 *
 * Enhances the task creation form with:
 * - AI-powered task decomposition
 * - Natural language parsing
 * - Context-aware suggestions
 * - Smart defaults based on user patterns
 */
import { TaskFormData, Priority } from '@/lib/types';
import { taskDecompositionEngine, NaturalLanguageParseResult, ParsedTask } from '@/lib/ai/task-decomposition-engine';
import { nlpTaskParser } from '@/lib/ai/nlp-task-parser';
import { SuggestionContext } from '@/lib/context-aware-suggestions';

export interface TaskFormAIIntegration {
  /** Decompose a large task into subtasks */
  decomposeTask: (taskName: string, description?: string, context?: {
    userGoals?: string[];
    energyLevel?: 'high' | 'medium' | 'low';
    preferredSize?: 'small' | 'medium' | 'large';
  }) => Promise<{
    parentTask: TaskFormData;
    subtasks: TaskFormData[];
    decomposition: any;
  }>;

  /** Parse natural language input into structured task */
  parseNaturalLanguage: (input: string) => Promise<NaturalLanguageParseResult>;

  /** Get AI-powered task suggestions based on context */
  getSuggestions: (context: SuggestionContext) => Promise<TaskSuggestion[]>;

  /** Auto-generate task name from description */
  generateTaskName: (description: string) => string;
}

export interface TaskSuggestion {
  id: string;
  taskName: string;
  description?: string;
  estimatedMinutes?: number;
  priority?: 'high' | 'medium' | 'low';
  suggestedDate?: string;
  relevanceScore: number;
  reason: string;
}

export class TaskFormIntegration implements TaskFormAIIntegration {
  async decomposeTask(
    taskName: string,
    description?: string,
    context?: {
      userGoals?: string[];
      energyLevel?: 'high' | 'medium' | 'low';
      preferredSize?: 'small' | 'medium' | 'large';
    }
  ) {
    // Map the context to the engine's expected format
    const engineContext = context ? {
      userGoals: context.userGoals,
      energyLevel: context.energyLevel,
      preferredTaskSize: context.preferredSize,
    } : undefined;

    const decomposition = taskDecompositionEngine.decomposeTask(
      taskName,
      description || '',
      engineContext
    );

    const subtasks: TaskFormData[] = decomposition.subtasks.map(s => ({
      name: s.name,
      description: s.rationale,
      estimate_minutes: s.estimatedMinutes,
      priority: s.priority as import('../types').Priority,
      list_id: 1, // Default to Inbox
      is_recurring: !!s.recurringPattern,
      recurring_pattern: s.recurringPattern,
    }));

    return {
      parentTask: {
        name: decomposition.parentTask.name,
        description: decomposition.parentTask.description,
        estimate_minutes: decomposition.totalEstimatedMinutes,
        priority: decomposition.parentTask.priority,
        list_id: 1, // Default to Inbox
      },
      subtasks,
      decomposition,
    };
  }

  async parseNaturalLanguage(input: string) {
    return nlpTaskParser.parse(input);
  }

  async getSuggestions(context: SuggestionContext): Promise<TaskSuggestion[]> {
    // Get base suggestions from context-aware system
    // In production, this would integrate with the actual suggestion system
    const suggestions: TaskSuggestion[] = [];

    // Generate time-based suggestions
    const now = context.currentTime ?? new Date();
    const hour = now.getHours();

    if (hour >= 5 && hour < 12) {
      suggestions.push({
        id: 'daily-planning',
        taskName: 'Daily planning session',
        estimatedMinutes: 15,
        priority: 'high',
        suggestedDate: now.toISOString().split('T')[0],
        relevanceScore: 0.8,
        reason: 'Morning is optimal for planning and prioritization'
      });
    }

    if (hour >= 15 && hour < 19) {
      suggestions.push({
        id: 'progress-check',
        taskName: 'Progress check',
        estimatedMinutes: 10,
        priority: 'medium',
        relevanceScore: 0.6,
        reason: 'Afternoon check-in to stay on track'
      });
    }

    if (hour >= 18 || hour < 5) {
      suggestions.push({
        id: 'end-of-day-wrap-up',
        taskName: 'End-of-day wrap-up',
        estimatedMinutes: 15,
        priority: 'medium',
        suggestedDate: now.toISOString().split('T')[0],
        relevanceScore: 0.8,
        reason: 'Evening wrap-up helps with next-day productivity'
      });
    }

    // Add a goal-aligned suggestion if goals are provided
    if (context.goals && context.goals.length > 0) {
      const goal = context.goals[0];
      suggestions.push({
        id: 'goal-progress',
        taskName: `Continue progress on "${goal}"`,
        estimatedMinutes: 30,
        priority: 'high',
        relevanceScore: 0.7,
        reason: `Aligned with your goal: "${goal}"`
      });
    }

    // Sort by relevance
    suggestions.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return suggestions.slice(0, 10);
  }

  generateTaskName(description: string): string {
    // Simple name generation from description
    if (!description) return 'New Task';

    // Take first sentence or first 50 chars
    const firstSentence = description.split('.')[0];
    const truncated = firstSentence.length > 50 ? firstSentence.slice(0, 50) + '...' : firstSentence;

    // Capitalize and ensure it's a proper task name
    return truncated.charAt(0).toUpperCase() + truncated.slice(1);
  }
}

export const taskFormAI = new TaskFormIntegration();