import { Task, TaskFormData } from '@/lib/types';
import type { RecurringPattern } from '@/lib/types';

export interface DecompositionConfig {
  maxDepth: number;
  minTaskDuration: number;
  maxSubtasks: number;
  includeEstimates: boolean;
  includeDependencies: boolean;
}

export type { RecurringPattern };

export interface TaskDecomposition {
  parentTask: TaskFormData;
  subtasks: SubtaskDecomposition[];
  totalEstimatedMinutes: number;
  suggestedOrder: number[];
  dependencies: Record<number, number[]>;
}

export interface SubtaskDecomposition {
  id: string;
  name: string;
  description: string;
  estimatedMinutes: number;
  priority: 'high' | 'medium' | 'low' | 'none';
  isRecurring?: boolean;
  recurringPattern?: RecurringPattern;
  dependencies: string[];
  order: number;
  rationale: string;
}

export interface NaturalLanguageParseResult {
  tasks: ParsedTask[];
  confidence: number;
  warnings: string[];
  suggestions: string[];
}

export interface ParsedTask {
  name: string;
  description?: string;
  dueDate?: Date;
  deadline?: Date;
  estimateMinutes?: number;
  priority?: 'high' | 'medium' | 'low' | 'none';
  isRecurring?: boolean;
  recurringPattern?: RecurringPattern;
  labels?: string[];
  listId?: number;
  confidence?: number;
}

export interface TaskContext {
  userGoals?: string[];
  currentProjects?: string[];
  availableHours?: number;
  preferredTaskSize?: 'small' | 'medium' | 'large';
  energyLevel?: 'high' | 'medium' | 'low';
  timeOfDay?: 'morning' | 'afternoon' | 'evening';
}

/**
 * AI-Powered Task Decomposition Engine
 * Breaks down complex tasks into manageable subtasks using pattern recognition
 * and user context awareness
 */
export class TaskDecompositionEngine {
  private config: DecompositionConfig;
  private patterns: Map<string, DecompositionPattern> = new Map();
  private fallbackPattern: DecompositionPattern;

  constructor(config: Partial<DecompositionConfig> = {}) {
    this.config = {
      maxDepth: config.maxDepth ?? 3,
      minTaskDuration: config.minTaskDuration ?? 15,
      maxSubtasks: config.maxSubtasks ?? 10,
      includeEstimates: config.includeEstimates ?? true,
      includeDependencies: config.includeDependencies ?? true,
    };

    this.initializePatterns();
    this.fallbackPattern = this.patterns.get('generic') || this.createFallbackPattern();
  }

  private initializePatterns(): void {
    // Project planning patterns
    this.patterns.set('project-planning', {
      keywords: ['plan', 'project', 'initiative', 'roadmap', 'strategy'],
      template: [
        { name: 'Define scope and objectives', estimate: 30, rationale: 'Clarify what success looks like' },
        { name: 'Research and gather requirements', estimate: 60, rationale: 'Understand constraints and needs' },
        { name: 'Create project timeline', estimate: 45, rationale: 'Map out milestones and deadlines' },
        { name: 'Identify resources and dependencies', estimate: 30, rationale: 'Know what you need and what blocks you' },
        { name: 'Set up tracking and communication', estimate: 20, rationale: 'Establish how progress will be monitored' },
      ],
    });

    // Feature development patterns
    this.patterns.set('feature-development', {
      keywords: ['feature', 'build', 'implement', 'develop', 'create', 'add'],
      template: [
        { name: 'Design and specification', estimate: 45, rationale: 'Define what to build before coding' },
        { name: 'Implementation', estimate: 120, rationale: 'Core development work' },
        { name: 'Testing and QA', estimate: 60, rationale: 'Ensure quality and catch bugs' },
        { name: 'Documentation', estimate: 30, rationale: 'Document for future maintenance' },
        { name: 'Deploy and monitor', estimate: 30, rationale: 'Release and verify in production' },
      ],
    });

    // Research patterns
    this.patterns.set('research', {
      keywords: ['research', 'investigate', 'analyze', 'explore', 'evaluate', 'study'],
      template: [
        { name: 'Define research questions', estimate: 15, rationale: 'Clear questions guide efficient research' },
        { name: 'Gather sources and data', estimate: 60, rationale: 'Collect relevant information' },
        { name: 'Analyze and synthesize', estimate: 45, rationale: 'Extract insights from data' },
        { name: 'Document findings', estimate: 30, rationale: 'Capture knowledge for future use' },
        { name: 'Present recommendations', estimate: 20, rationale: 'Share actionable conclusions' },
      ],
    });

    // Meeting preparation patterns
    this.patterns.set('meeting-prep', {
      keywords: ['meeting', 'call', 'presentation', 'demo', 'review', 'sync'],
      template: [
        { name: 'Define agenda and objectives', estimate: 15, rationale: 'Keep meeting focused and productive' },
        { name: 'Prepare materials and slides', estimate: 45, rationale: 'Visual aids improve communication' },
        { name: 'Anticipate questions and objections', estimate: 20, rationale: 'Be ready for discussion' },
        { name: 'Set up technical requirements', estimate: 10, rationale: 'Avoid technical delays' },
        { name: 'Send pre-read materials', estimate: 10, rationale: 'Participants come prepared' },
      ],
    });

    // Content creation patterns
    this.patterns.set('content-creation', {
      keywords: ['write', 'article', 'blog', 'report', 'document', 'proposal', 'email'],
      template: [
        { name: 'Outline and structure', estimate: 20, rationale: 'Good structure makes writing faster' },
        { name: 'Draft content', estimate: 60, rationale: 'Get ideas down without editing' },
        { name: 'Edit and refine', estimate: 30, rationale: 'Polish for clarity and impact' },
        { name: 'Review and fact-check', estimate: 20, rationale: 'Ensure accuracy' },
        { name: 'Format and publish', estimate: 15, rationale: 'Final presentation matters' },
      ],
    });

    // Learning patterns
    this.patterns.set('learning', {
      keywords: ['learn', 'study', 'course', 'tutorial', 'certification', 'skill'],
      template: [
        { name: 'Define learning objectives', estimate: 15, rationale: 'Clear goals improve retention' },
        { name: 'Gather learning resources', estimate: 20, rationale: 'Quality materials save time' },
        { name: 'Study and practice', estimate: 90, rationale: 'Active learning requires practice' },
        { name: 'Apply knowledge to project', estimate: 45, rationale: 'Application cements learning' },
        { name: 'Review and reflect', estimate: 15, rationale: 'Metacognition improves future learning' },
      ],
    });

    // Add generic fallback pattern
    this.patterns.set('generic', {
      keywords: [],
      template: [
        { name: 'Break down into steps', estimate: 30, rationale: 'Identify concrete actions' },
        { name: 'Execute first step', estimate: 45, rationale: 'Start making progress' },
        { name: 'Review and adjust', estimate: 15, rationale: 'Iterate based on learnings' },
        { name: 'Complete remaining steps', estimate: 60, rationale: 'Finish the work' },
        { name: 'Final review and wrap up', estimate: 20, rationale: 'Ensure quality completion' },
      ],
    });
  }

  private createFallbackPattern(): DecompositionPattern {
    return {
      keywords: [],
      template: [
        { name: 'Break down into steps', estimate: 30, rationale: 'Identify concrete actions' },
        { name: 'Execute first step', estimate: 45, rationale: 'Start making progress' },
        { name: 'Review and adjust', estimate: 15, rationale: 'Iterate based on learnings' },
        { name: 'Complete remaining steps', estimate: 60, rationale: 'Finish the work' },
        { name: 'Final review and wrap up', estimate: 20, rationale: 'Ensure quality completion' },
      ],
    };
  }

  /**
   * Decompose a complex task into manageable subtasks
   */
  decomposeTask(
    taskName: string,
    taskDescription: string,
    context?: TaskContext
  ): TaskDecomposition {
    const pattern = this.findMatchingPattern(taskName, taskDescription) || this.fallbackPattern;
    const subtasks = this.generateSubtasks(pattern, taskName, taskDescription, context);
    const dependencies = this.calculateDependencies(subtasks);
    const totalEstimatedMinutes = subtasks.reduce((sum, s) => sum + s.estimatedMinutes, 0);
    const suggestedOrder = this.calculateOptimalOrder(subtasks, dependencies);

    return {
      parentTask: {
        name: taskName,
        description: taskDescription,
        estimate_minutes: totalEstimatedMinutes,
        priority: this.inferPriority(taskName, taskDescription, context),
        list_id: 1, // Default to Inbox
      },
      subtasks,
      totalEstimatedMinutes,
      suggestedOrder,
      dependencies,
    };
  }

  private findMatchingPattern(taskName: string, description: string): DecompositionPattern | null {
    const combined = (taskName + ' ' + description).toLowerCase();

    for (const [, pattern] of this.patterns) {
      for (const keyword of pattern.keywords) {
        if (combined.includes(keyword)) {
          return pattern;
        }
      }
    }

    // Default generic pattern
    return {
      keywords: [],
      template: [
        { name: 'Break down into steps', estimate: 30, rationale: 'Identify concrete actions' },
        { name: 'Execute first step', estimate: 45, rationale: 'Start making progress' },
        { name: 'Review and adjust', estimate: 15, rationale: 'Iterate based on learnings' },
        { name: 'Complete remaining steps', estimate: 60, rationale: 'Finish the work' },
        { name: 'Final review and wrap up', estimate: 20, rationale: 'Ensure quality completion' },
      ],
    };
  }

  private generateSubtasks(
    pattern: DecompositionPattern,
    taskName: string,
    description: string,
    context?: TaskContext
  ): SubtaskDecomposition[] {
    const baseSubtasks = pattern.template.slice(0, this.config.maxSubtasks);

    return baseSubtasks.map((template, index) => {
      const estimatedMinutes = this.adjustEstimate(
        template.estimate,
        context?.preferredTaskSize,
        context?.energyLevel
      );

      return {
        id: `subtask-${Date.now()}-${index}`,
        name: this.customizeSubtaskName(template.name, taskName),
        description: template.rationale,
        estimatedMinutes,
        priority: this.inferSubtaskPriority(index, baseSubtasks.length),
        dependencies: this.config.includeDependencies && index > 0 ? [`subtask-${Date.now()}-${index - 1}`] : [],
        order: index,
        rationale: template.rationale,
      };
    });
  }

  private customizeSubtaskName(templateName: string, parentTaskName: string): string {
    // Customize subtask names based on parent task context
    const lowerParent = parentTaskName.toLowerCase();

    if (lowerParent.includes('meeting') && templateName.includes('materials')) {
      return `Prepare meeting materials for "${parentTaskName}"`;
    }
    if (lowerParent.includes('feature') && templateName.includes('implementation')) {
      return `Implement core functionality for "${parentTaskName}"`;
    }
    if (lowerParent.includes('research') && templateName.includes('sources')) {
      return `Gather research sources for "${parentTaskName}"`;
    }

    return `${templateName} - ${parentTaskName}`;
  }

  private adjustEstimate(
    baseEstimate: number,
    preferredSize?: 'small' | 'medium' | 'large',
    energyLevel?: 'high' | 'medium' | 'low'
  ): number {
    let estimate = baseEstimate;

    // Adjust for preferred task size
    switch (preferredSize) {
      case 'small': estimate *= 0.7; break;
      case 'large': estimate *= 1.5; break;
    }

    // Adjust for energy level
    switch (energyLevel) {
      case 'high': estimate *= 0.8; break;
      case 'low': estimate *= 1.3; break;
    }

    return Math.max(this.config.minTaskDuration, Math.round(estimate));
  }

  private inferPriority(
    taskName: string,
    description: string,
    context?: TaskContext
  ): 'high' | 'medium' | 'low' | 'none' {
    const combined = (taskName + ' ' + description).toLowerCase();

    if (combined.includes('urgent') || combined.includes('critical') || combined.includes('asap')) {
      return 'high';
    }
    if (combined.includes('later') || combined.includes('someday') || combined.includes('maybe')) {
      return 'low';
    }
    if (context?.energyLevel === 'low') {
      return 'medium';
    }

    return 'medium';
  }

  private inferSubtaskPriority(index: number, total: number): 'high' | 'medium' | 'low' | 'none' {
    if (index === 0) return 'high'; // First step is critical
    if (index === total - 1) return 'medium'; // Last step for wrap-up
    return 'medium';
  }

  private calculateDependencies(subtasks: SubtaskDecomposition[]): Record<number, number[]> {
    const deps: Record<number, number[]> = {};

    subtasks.forEach((subtask, index) => {
      if (subtask.dependencies.length > 0) {
        const depIndices = subtask.dependencies
          .map(depId => subtasks.findIndex(s => s.id === depId))
          .filter(idx => idx !== -1);
        if (depIndices.length > 0) {
          deps[index] = depIndices;
        }
      }
    });

    return deps;
  }

  private calculateOptimalOrder(
    subtasks: SubtaskDecomposition[],
    dependencies: Record<number, number[]>
  ): number[] {
    // Topological sort for dependency ordering
    const visited = new Set<number>();
    const order: number[] = [];

    const visit = (index: number) => {
      if (visited.has(index)) return;
      visited.add(index);

      const deps = dependencies[index] || [];
      deps.forEach(dep => visit(dep));

      order.push(index);
    };

    subtasks.forEach((_, index) => visit(index));

    return order;
  }

  /**
   * Get suggested decomposition patterns for a user
   */
  getSuggestedPatterns(context?: TaskContext): DecompositionPattern[] {
    // Return patterns most relevant to user's context
    return Array.from(this.patterns.values());
  }

  /**
   * Add a custom decomposition pattern
   */
  addCustomPattern(name: string, pattern: DecompositionPattern): void {
    this.patterns.set(name, pattern);
  }
}

interface DecompositionPattern {
  keywords: string[];
  template: Array<{
    name: string;
    estimate: number;
    rationale: string;
  }>;
}

// Singleton instance
export const taskDecompositionEngine = new TaskDecompositionEngine();