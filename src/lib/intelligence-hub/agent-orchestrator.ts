import { TaskWithDetails } from '@/lib/types';
import { taskOperations } from '@/lib/db/tasks';
import { labelOperations } from '@/lib/db/labels';
import { listOperations } from '@/lib/db/lists';

/**
 * Agent Orchestrator - Coordinates AI agents for task processing
 * Manages different specialized agents for scheduling, prioritization, and optimization
 */
export class AgentOrchestrator {
  private agents: Map<string, BaseAgent>;
  private schedulerAgent: TaskSchedulerAgent;
  private prioritizerAgent: TaskPrioritizerAgent;
  private optimizerAgent: TaskOptimizerAgent;

  constructor() {
    this.agents = new Map<string, BaseAgent>();
    this.schedulerAgent = new TaskSchedulerAgent();
    this.prioritizerAgent = new TaskPrioritizerAgent();
    this.optimizerAgent = new TaskOptimizerAgent();

    // Register all agents
    this.registerAgent('scheduler', this.schedulerAgent);
    this.registerAgent('prioritizer', this.prioritizerAgent);
    this.registerAgent('optimizer', this.optimizerAgent);
  }

  /**
   * Generate an optimized schedule for tasks based on context
   */
  async generateSchedule(
    tasks: TaskWithDetails[],
    context: any
  ): Promise<{
    morning: TaskWithDetails[];
    afternoon: TaskWithDetails[];
    evening: TaskWithDetails[];
  }> {
    try {
      // Step 1: Prioritize tasks
      const prioritizedTasks = await this.prioritizerAgent.prioritizeTasks(tasks, context);

      // Step 2: Schedule tasks into time blocks
      const scheduledTasks = await this.schedulerAgent.scheduleTasks(prioritizedTasks, context);

      // Step 3: Optimize for flow and energy levels
      const optimizedSchedule = await this.optimizerAgent.optimizeSchedule(scheduledTasks, context);

      return optimizedSchedule;
    } catch (error) {
      console.error('Agent orchestration failed:', error);
      // Return simple chronological sorting as fallback
      return this.getFallbackSchedule(tasks);
    }
  }

  /**
   * Register an agent with the orchestrator
   */
  private registerAgent(name: string, agent: BaseAgent): void {
    this.agents.set(name, agent);
  }

  /**
   * Get an agent by name
   */
  private getAgent(name: string): BaseAgent | undefined {
    return this.agents.get(name);
  }

  /**
   * Execute a specific agent on a task set
   */
  async executeAgent(
    agentName: string,
    tasks: TaskWithDetails[],
    context: any
  ): Promise<TaskWithDetails[]> {
    const agent = this.getAgent(agentName);
    if (!agent) {
      throw new Error(`Agent ${agentName} not found`);
    }

    return await agent.process(tasks, context);
  }

  /**
   * Get fallback schedule when orchestration fails
   */
  private getFallbackSchedule(tasks: TaskWithDetails[]): {
    morning: TaskWithDetails[];
    afternoon: TaskWithDetails[];
    evening: TaskWithDetails[];
  } {
    // Simple distribution by priority and estimated time
    const sortedTasks = [...tasks]
      .sort((a, b) => {
        // High priority first
        if (a.priority === 'high' && b.priority !== 'high') return -1;
        if (a.priority !== 'high' && b.priority === 'high') return 1;

        // Then by estimated time (shorter first for better distribution)
        return (a.estimate_minutes || 0) - (b.estimate_minutes || 0);
      });

    // Simple time-based distribution
    const morning = sortedTasks.slice(0, Math.ceil(sortedTasks.length / 3));
    const afternoon = sortedTasks.slice(Math.ceil(sortedTasks.length / 3), Math.ceil(2 * sortedTasks.length / 3));
    const evening = sortedTasks.slice(Math.ceil(2 * sortedTasks.length / 3));

    return {
      morning,
      afternoon,
      evening
    };
  }
}

/**
 * Base agent interface
 */
export abstract class BaseAgent {
  abstract process(tasks: TaskWithDetails[], context: any): Promise<TaskWithDetails[]>;
}

/**
 * Task Scheduler Agent - Responsible for time-based task allocation
 */
export class TaskSchedulerAgent extends BaseAgent {
  async process(tasks: TaskWithDetails[], context: any): Promise<TaskWithDetails[]> {
    // For scheduler, we just return tasks as scheduling happens in orchestrator
    // This agent would handle more complex scheduling logic
    return tasks;
  }

  /**
   * Schedule tasks into time blocks based on estimates and priorities
   */
  async scheduleTasks(
    tasks: TaskWithDetails[],
    context: any
  ): Promise<{
    morning: TaskWithDetails[];
    afternoon: TaskWithDetails[];
    evening: TaskWithDetails[];
  }> {
    // Separate tasks by estimated duration
    const shortTasks = tasks.filter(t => (t.estimate_minutes || 0) <= 30);
    const mediumTasks = tasks.filter(t =>
      (t.estimate_minutes || 0) > 30 && (t.estimate_minutes || 0) <= 120
    );
    const longTasks = tasks.filter(t => (t.estimate_minutes || 0) > 120);

    // Distribute tasks considering energy levels and task types
    const morningSlots = this.allocateTimeBlock(
      [...shortTasks, ...mediumTasks.filter(t => t.priority === 'high')],
      'morning',
      context
    );

    const afternoonSlots = this.allocateTimeBlock(
      [...mediumTasks.filter(t => t.priority !== 'high'), ...longTasks.filter(t => t.priority === 'high')],
      'afternoon',
      context
    );

    const eveningSlots = this.allocateTimeBlock(
      [...longTasks.filter(t => t.priority !== 'high'), ...shortTasks],
      'evening',
      context
    );

    return {
      morning: morningSlots,
      afternoon: afternoonSlots,
      evening: eveningSlots
    };
  }

  /**
   * Allocate tasks to a specific time block
   */
  private allocateTimeBlock(
    tasks: TaskWithDetails[],
    period: 'morning' | 'afternoon' | 'evening',
    context: any
  ): TaskWithDetails[] {
    // Simple allocation based on available time and task priorities
    // In production, this would use optimization algorithms

    // Sort by priority and estimated time
    const sorted = [...tasks]
      .sort((a, b) => {
        // Priority: high > medium > low > none
        const priorityValues: { [key: string]: number } = {
          high: 4, medium: 3, low: 2, none: 1
        };

        const aPriority = priorityValues[a.priority || 'none'] || 1;
        const bPriority = priorityValues[b.priority || 'none'] || 1;

        if (aPriority !== bPriority) {
          return bPriority - aPriority; // Higher priority first
        }

        // Then by estimated time (shorter first for better packing)
        return (a.estimate_minutes || 0) - (b.estimate_minutes || 0);
      });

    // Simple allocation - take tasks until we reach time limit
    const timeLimits: { [key: string]: number } = {
      morning: 240,  // 4 hours
      afternoon: 240, // 4 hours
      evening: 180   // 3 hours
    };

    const timeLimit = timeLimits[period];
    let allocatedTime = 0;
    const allocatedTasks: TaskWithDetails[] = [];

    for (const task of sorted) {
      const taskTime = task.estimate_minutes || 0;
      if (allocatedTime + taskTime <= timeLimit) {
        allocatedTasks.push(task);
        allocatedTime += taskTime;
      } else {
        // Try to fit a smaller task if available
        continue;
      }
    }

    return allocatedTasks;
  }
}

/**
 * Task Prioritizer Agent - Responsible for task prioritization
 */
export class TaskPrioritizerAgent extends BaseAgent {
  async process(tasks: TaskWithDetails[], context: any): Promise<TaskWithDetails[]> {
    return this.prioritizeTasks(tasks, context);
  }

  /**
   * Prioritize tasks based on multiple factors
   */
  async prioritizeTasks(
    tasks: TaskWithDetails[],
    context: any
  ): Promise<TaskWithDetails[]> {
    return [...tasks]
      .sort((a, b) => {
        const scoreA = this.calculatePriorityScore(a, context);
        const scoreB = this.calculatePriorityScore(b, context);
        return scoreB - scoreA; // Higher score first
      });
  }

  /**
   * Calculate priority score for a task
   */
  private calculatePriorityScore(task: TaskWithDetails, context: any): number {
    let score = 0;

    // Base priority (25 points max)
    const priorityScores: { [key: string]: number } = {
      high: 25,
      medium: 15,
      low: 5,
      none: 0
    };
    score += priorityScores[task.priority || 'none'] || 0;

    // Deadline proximity (25 points max)
    if (task.deadline) {
      const deadline = new Date(task.deadline);
      const now = new Date();
      const hoursUntilDeadline = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntilDeadline <= 0) {
        score += 25; // Overdue
      } else if (hoursUntilDeadline <= 24) {
        score += 20; // Due today
      } else if (hoursUntilDeadline <= 72) {
        score += 15; // Due in 3 days
      } else if (hoursUntilDeadline <= 168) {
        score += 10; // Due in week
      }
      // Else no deadline bonus
    }

    // Estimated effort (15 points max - shorter tasks get higher score for quick wins)
    const estimateMinutes = task.estimate_minutes || 0;
    if (estimateMinutes <= 15) {
      score += 15; // Quick win
    } else if (estimateMinutes <= 60) {
      score += 10; // Short task
    } else if (estimateMinutes <= 180) {
      score += 5; // Medium task
    }
    // Long tasks get 0 effort points (they're important but not quick wins)

    // Dependencies (15 points max - unblocking tasks get higher score)
    const dependencyScore = this.calculateDependencyScore(task);
    score += dependencyScore;

    // Context alignment (20 points max)
    score += this.calculateContextAlignment(task, context);

    return score;
  }

  /**
   * Calculate dependency score - unblocking tasks get higher scores
   */
  private calculateDependencyScore(task: TaskWithDetails): number {
    // In production, would check actual task dependencies
    // For now, heuristic based on task name/description
    const taskText = (task.name + ' ' + (task.description || '')).toLowerCase();

    const unblockingKeywords = [
      'setup', 'prepare', 'enable', 'unblock', 'allow', 'facilitate',
      'foundation', 'base', 'core', 'initial', 'first'
    ];

    const blockingKeywords = [
      'finish', 'complete', 'finalize', 'wrap up', 'polish', 'refine',
      'last', 'final', 'end', 'conclusion'
    ];

    let score = 0;
    unblockingKeywords.forEach(keyword => {
      if (taskText.includes(keyword)) score += 3;
    });

    blockingKeywords.forEach(keyword => {
      if (taskText.includes(keyword)) score -= 2; // Slight penalty for blocking tasks
    });

    return Math.min(Math.max(score, 0), 15); // Clamp to 0-15
  }

  /**
   * Calculate how well task aligns with user context
   */
  private calculateContextAlignment(task: TaskWithDetails, context: any): number {
    let score = 0;

    // Time of day alignment
    const currentHour = new Date().getHours();
    if (context.productiveHours.includes(currentHour)) {
      score += 5; // Bonus for working during productive hours
    }

    // Project/goal alignment
    if (context.activeProjects.length > 0) {
      // Would check if task relates to active projects
      // Placeholder implementation
      score += 3;
    }

    // Streak maintenance
    if (context.currentStreak > 0) {
      score += 2; // Encourage maintaining streaks
    }

    // Workload balancing
    if (context.workload > 0.8) {
      // High workload - prefer shorter tasks
      const estimateMinutes = task.estimate_minutes || 0;
      if (estimateMinutes <= 30) {
        score += 5;
      }
    } else if (context.workload < 0.3) {
      // Low workload - can handle longer tasks
      const estimateMinutes = task.estimate_minutes || 0;
      if (estimateMinutes > 120) {
        score += 5;
      }
    }

    return Math.min(score, 20); // Clamp to 0-20
  }
}

/**
 * Task Optimizer Agent - Responsible for schedule optimization
 */
export class TaskOptimizerAgent extends BaseAgent {
  async process(tasks: TaskWithDetails[], context: any): Promise<TaskWithDetails[]> {
    // For optimizer, we return tasks as optimization happens in orchestrator
    return tasks;
  }

  /**
   * Optimize the schedule for better flow and energy alignment
   */
  async optimizeSchedule(
    schedule: {
      morning: TaskWithDetails[];
      afternoon: TaskWithDetails[];
      evening: TaskWithDetails[];
    },
    context: any
  ): Promise<{
    morning: TaskWithDetails[];
    afternoon: TaskWithDetails[];
    evening: TaskWithDetails[];
  }> {
    try {
      const optimized = {
        morning: [...schedule.morning],
        afternoon: [...schedule.afternoon],
        evening: [...schedule.evening]
      };

      // Apply various optimizations
      optimized.morning = this.applyEnergyOptimization(optimized.morning, 'morning', context);
      optimized.afternoon = this.applyEnergyOptimization(optimized.afternoon, 'afternoon', context);
      optimized.evening = this.applyEnergyOptimization(optimized.evening, 'evening', context);

      // Balance workload across time periods
      optimized = this.balanceWorkload(optimized, context);

      // Ensure critical tasks are properly placed
      optimized = this.placeCriticalTasks(optimized, context);

      return optimized;
    } catch (error) {
      console.error('Schedule optimization failed:', error);
      return schedule; // Return original if optimization fails
    }
  }

  /**
   * Apply energy-based optimization to a time block
   */
  private applyEnergyOptimization(
    tasks: TaskWithDetails[],
    period: 'morning' | 'afternoon' | 'evening',
    context: any
  ): TaskWithDetails[] {
    // Define energy-appropriate task types for each period
    const energyPreferences: { [key: string]: string[] } = {
      morning: ['focused-work', 'creative-tasks', 'problem-solving', 'planning'],
      afternoon: ['meetings', 'collaborative-work', 'routine-tasks', 'communication'],
      evening: ['review', 'planning', 'light-tasks', 'preparation']
    };

    const preferredTypes = energyPreferences[period] || [];

    // Sort tasks by how well they match preferred types for this period
    return [...tasks]
      .sort((a, b) => {
        const aMatch = this.calculateTypeMatch(a, preferredTypes);
        const bMatch = this.calculateTypeMatch(b, preferredTypes);
        return bMatch - aMatch; // Higher match first
      });
  }

  /**
   * Calculate how well a task matches preferred types for a period
   */
  private calculateTypeMatch(task: TaskWithDetails, preferredTypes: string[]): number {
    if (preferredTypes.length === 0) return 0;

    const taskText = (task.name + ' ' + (task.description || '')).toLowerCase();
    let matches = 0;

    preferredTypes.forEach(type => {
      // Simple keyword matching - would be enhanced with NLP in production
      const typeKeywords: { [key: string]: string[] } = {
        'focused-work': ['focus', 'concentrate', 'deep', 'write', 'code', 'develop'],
        'creative-tasks': ['design', 'brainstorm', 'create', 'innovate', 'concept', 'idea'],
        'problem-solving': ['debug', 'fix', 'solve', 'analyze', 'investigate', 'troubleshoot'],
        'planning': ['plan', 'organize', 'schedule', 'prepare', 'outline', 'strategy'],
        'meetings': ['meeting', 'call', 'discuss', 'review', 'present', 'collaborate'],
        'collaborative-work': ['team', 'group', 'partner', 'collaborate', 'together', 'joint'],
        'routine-tasks': ['update', 'maintain', 'check', 'review', 'process', 'routine'],
        'communication': ['email', 'message', 'respond', 'notify', 'inform', 'announce'],
        'review': ['review', 'audit', 'check', 'inspect', 'evaluate', 'assess'],
        'light-tasks': ['organize', 'file', 'archive', 'clean', 'tidy', 'simple']
      };

      const keywords = typeKeywords[type] || [];
      matches += keywords.filter(keyword => taskText.includes(keyword)).length;
    });

    return matches;
  }

  /**
   * Balance workload across time periods
   */
  private balanceWorkload(
    schedule: {
      morning: TaskWithDetails[];
      afternoon: TaskWithDetails[];
      evening: TaskWithDetails[];
    },
    context: any
  ): {
    morning: TaskWithDetails[];
    afternoon: TaskWithDetails[];
    evening: TaskWithDetails[];
  } {
    const timeLimits: { [key: string]: number } = {
      morning: 240,  // 4 hours
      afternoon: 240, // 4 hours
      evening: 180   // 3 hours
    };

    // Calculate current workload for each period
    const workloadByPeriod = {
      morning: this.calculatePeriodWorkload(schedule.morning),
      afternoon: this.calculatePeriodWorkload(schedule.afternoon),
      evening: this.calculatePeriodWorkload(schedule.evening)
    };

    // Redistribute tasks if any period is significantly overloaded
    const balanced = { ...schedule };

    // Handle morning overload
    if (workloadByPeriod.morning > timeLimits.morning * 1.2) {
      balanced.morning = this.reducePeriodLoad(
        balanced.morning,
        workloadByPeriod.morning - timeLimits.morning,
        'morning'
      );
      // Move excess to afternoon/evening
      // Implementation would distribute excess tasks
    }

    // Handle afternoon overload
    if (workloadByPeriod.afternoon > timeLimits.afternoon * 1.2) {
      balanced.afternoon = this.reducePeriodLoad(
        balanced.afternoon,
        workloadByPeriod.afternoon - timeLimits.afternoon,
        'afternoon'
      );
    }

    // Handle evening overload
    if (workloadByPeriod.evening > timeLimits.evening * 1.2) {
      balanced.evening = this.reducePeriodLoad(
        balanced.evening,
        workloadByPeriod.evening - timeLimits.evening,
        'evening'
      );
    }

    return balanced;
  }

  /**
   * Calculate total estimated minutes for a period
   */
  private calculatePeriodWorkload(tasks: TaskWithDetails[]): number {
    return tasks.reduce((sum, task) => sum + (task.estimate_minutes || 0), 0);
  }

  /**
   * Reduce workload in a period by moving tasks to other periods
   */
  private reducePeriodLoad(
    tasks: TaskWithDetails[],
    excessMinutes: number,
    period: 'morning' | 'afternoon' | 'evening'
  ): TaskWithDetails[] {
    // Sort by estimated time (largest first) to reduce count of moved tasks
    const sorted = [...tasks]
      .sort((a, b) => (b.estimate_minutes || 0) - (a.estimate_minutes || 0));

    const reduced: TaskWithDetails[] = [];
    let removedMinutes = 0;

    for (const task of sorted) {
      const taskTime = task.estimate_minutes || 0;
      if (removedMinutes + taskTime <= excessMinutes) {
        // Move this task to another period (implementation would handle this)
        removedMinutes += taskTime;
      } else {
        reduced.push(task);
      }
    }

    return reduced;
  }

  /**
   * Ensure critical tasks are properly placed in schedule
   */
  private placeCriticalTasks(
    schedule: {
      morning: TaskWithDetails[];
      afternoon: TaskWithDetails[];
      evening: TaskWithDetails[];
    },
    context: any
  ): {
    morning: TaskWithDetails[];
    afternoon: TaskWithDetails[];
    evening: TaskWithDetails[];
  } {
    const result = { ...schedule };

    // Identify critical tasks (high priority, overdue, or blocking)
    const allTasks = [
      ...schedule.morning,
      ...schedule.afternoon,
      ...schedule.evening
    ];

    const criticalTasks = allTasks.filter(task => {
      const isHighPriority = task.priority === 'high';
      const isOverdue = task.deadline && new Date(task.deadline) < new Date();
      const isBlocking = this.isBlockingTask(task);

      return isHighPriority || isOverdue || isBlocking;
    });

    // For each critical task, ensure it's in an appropriate time slot
    criticalTasks.forEach(task => {
      // In production, would check current placement and move if inappropriate
      // Placeholder implementation
    });

    return result;
  }

  /**
   * Determine if a task is blocking (prevents other tasks from proceeding)
   */
  private isBlockingTask(task: TaskWithDetails): boolean {
    // Heuristic based on task characteristics
    const taskText = (task.name + ' ' + (task.description || '')).toLowerCase();

    const blockingIndicators = [
      'setup', 'install', 'configure', 'enable', 'unblock',
      'foundation', 'base', 'prerequisite', 'required', 'need',
      'must', 'should', 'have to', 'need to'
    ];

    return blockingIndicators.some(indicator => taskText.includes(indicator));
  }
}