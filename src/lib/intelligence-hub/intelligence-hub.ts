import { ContextEngine } from './context-engine';
import { AgentOrchestrator } from './agent-orchestrator';
import { WorkflowManager, Workflow, WorkflowStep } from './workflow-manager';
import { Task, TaskWithDetails, User } from '@/lib/types';
import { taskOperations } from '@/lib/db/tasks';
import { timeEntryOperations } from '@/lib/db/time-entries';
import { listOperations } from '@/lib/db/lists';
import { labelOperations } from '@/lib/db/labels';
import { PredictiveAnalytics } from '@/lib/analytics/predictive-analytics';

/**
 * Intelligence Hub - Central AI coordination system for Todo Phoenix Alpha
 * Orchestrates AI agents, context awareness, and workflow automation
 */
export class IntelligenceHub {
  private contextEngine: ContextEngine;
  private agentOrchestrator: AgentOrchestrator;
  private workflowManager: WorkflowManager;

  constructor() {
    this.contextEngine = new ContextEngine();
    this.agentOrchestrator = new AgentOrchestrator();
    this.workflowManager = new WorkflowManager();
  }

  /**
   * Process a comprehensive daily plan for a user
   * Integrates context, task discovery, scheduling, and workflow optimization
   */
  async processDailyPlan(userId: string): Promise<{
    morning: DailyPlanSegment;
    afternoon: DailyPlanSegment;
    evening: DailyPlanSegment;
    insights: string[];
    energyRecommendations: EnergyWindow[];
  }> {
    try {
      // Build comprehensive user context
      const context = await this.contextEngine.buildUserContext(userId);

      // Discover relevant tasks based on context
      const tasks = await this.discoverRelevantTasks(context);

      // Generate optimized schedule using AI agents
      const schedule = await this.agentOrchestrator.generateSchedule(tasks, context);

      // Apply workflow optimizations
      const optimizedSchedule = await this.workflowManager.optimizeWorkflow(schedule, context);

      // Generate personalized insights
      const insights = await this.generateInsights(context, optimizedSchedule);

      // Calculate energy-based recommendations
      const energyRecommendations = this.calculateEnergyWindows(context);

      // Format for user consumption
      return {
        morning: this.formatPlanSegment(optimizedSchedule.morning),
        afternoon: this.formatPlanSegment(optimizedSchedule.afternoon),
        evening: this.formatPlanSegment(optimizedSchedule.evening),
        insights,
        energyRecommendations
      };
    } catch (error) {
      console.error('Intelligence Hub processing failed:', error);
      // Return safe fallback
      return this.getFallbackPlan();
    }
  }

  /**
   * Discover tasks relevant to the current context
   */
  private async discoverRelevantTasks(context: UserContext): Promise<TaskWithDetails[]> {
    // Get all active tasks
    const allTasks = await taskOperations.getAll(false) as TaskWithDetails[];

    // Filter based on context relevance
    return allTasks.filter(task =>
      this.isTaskRelevant(task, context)
    );
  }

  /**
   * Determine if a task is relevant to current context
   */
  private isTaskRelevant(task: TaskWithDetails, context: UserContext): boolean {
    // High priority tasks are always relevant
    if (task.priority === 'high') return true;

    // Tasks due today or overdue
    if (task.deadline) {
      const dueDate = new Date(task.deadline);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dueDate.setHours(0, 0, 0, 0);

      if (dueDate <= today) return true; // Overdue or due today
    }

    // Tasks matching current time of day patterns
    const currentHour = new Date().getHours();
    if (context.productiveHours.includes(currentHour)) {
      return true;
    }

    // Tasks related to current projects/goals
    if (context.activeProjects.some(projectId =>
      task.projectIds?.includes(projectId)
    )) {
      return true;
    }

    // Recently accessed or modified tasks
    const lastAccessed = new Date(task.updated_at || task.created_at);
    const hoursSinceAccess = (Date.now() - lastAccessed.getTime()) / (1000 * 60 * 60);
    if (hoursSinceAccess < 24) return true;

    return false;
  }

  /**
   * Generate personalized insights from context and schedule
   */
  private async generateInsights(
    context: UserContext,
    schedule: AISchedule
  ): Promise<string[]> {
    const insights: string[] = [];

    // Productivity insights
    if (context.completionRate < 0.5) {
      insights.push('Your task completion rate is below 50%. Consider breaking large tasks into smaller, manageable pieces.');
    } else if (context.completionRate > 0.8) {
      insights.push('Excellent task completion rate! You\'re highly productive.');
    }

    // Time management insights
    const overdueCount = context.overdueTasks;
    if (overdueCount > 0) {
      insights.push(`You have ${overdueCount} overdue tasks. Review deadlines and consider delegating or rescheduling.`);
    }

    // Energy pattern insights
    const peakHour = context.mostProductiveHours[0];
    if (peakHour !== undefined) {
      insights.push(`Your peak productivity hour is ${peakHour}:00. Schedule your most important tasks during this time.`);
    }

    // Workload insights
    if (context.workload > 0.8) {
      insights.push('Your workload is high. Consider delegating tasks or adjusting deadlines to prevent burnout.');
    } else if (context.workload < 0.3) {
      insights.push('Your workload is light. This is a great opportunity to tackle long-term projects or skill development.');
    }

    // Meeting effectiveness insights
    if (context.meetingEffectiveness < 0.6) {
      insights.push('Meeting effectiveness is below average. Consider shorter, more focused meetings with clear agendas.');
    }

    // Streak insights
    if (context.currentStreak > 0) {
      insights.push(`You\'re on a ${context.currentStreak}-day productivity streak! Keep up the great work.`);
    }

    return insights;
  }

  /**
   * Calculate energy-based time window recommendations
   */
  private calculateEnergyWindows(context: UserContext): EnergyWindow[] {
    const windows: EnergyWindow[] = [];

    // Morning window (typically high energy for most people)
    windows.push({
      period: 'morning',
      startTime: '08:00',
      endTime: '12:00',
      energyLevel: 'high',
      recommendedTaskTypes: ['focused-work', 'creative-tasks', 'problem-solving'],
      description: 'High energy period ideal for deep work and complex tasks'
    });

    // Afternoon window (energy may dip)
    windows.push({
      period: 'afternoon',
      startTime: '13:00',
      endTime: '17:00',
      energyLevel: 'medium',
      recommendedTaskTypes: ['meetings', 'collaborative-work', 'routine-tasks'],
      description: 'Moderate energy period good for meetings and collaborative tasks'
    });

    // Evening window (variable energy)
    windows.push({
      period: 'evening',
      startTime: '18:00',
      endTime: '21:00',
      energyLevel: 'variable',
      recommendedTaskTypes: ['planning', 'review', 'light-tasks'],
      description: 'Variable energy period suitable for planning and review activities'
    });

    // Adjust based on user's actual productive hours
    const productiveHours = context.mostProductiveHours;
    if (productiveHours.length > 0) {
      // Customize windows based on actual data
      // This would be enhanced with machine learning in production
    }

    return windows;
  }

  /**
   * Format schedule segment for user presentation
   */
  private formatPlanSegment(tasks: TaskWithDetails[]): DailyPlanSegment {
    return {
      tasks: tasks.map(task => ({
        id: task.id,
        title: task.name,
        description: task.description || '',
        estimatedMinutes: task.estimate_minutes || 0,
        priority: task.priority,
        isRecurring: task.is_recurring > 0
      })),
      totalEstimatedMinutes: tasks.reduce((sum, task) =>
        sum + (task.estimate_minutes || 0), 0
      )
    };
  }

  /**
   * Get fallback plan when processing fails
   */
  private getFallbackPlan(): any {
    return {
      morning: { tasks: [], totalEstimatedMinutes: 0 },
      afternoon: { tasks: [], totalEstimatedMinutes: 0 },
      evening: { tasks: [], totalEstimatedMinutes: 0 },
      insights: ['Unable to generate personalized plan. Showing default view.'],
      energyRecommendations: []
    };
  }

  /**
   * Create a workflow for task completion
   */
  async createTaskCompletionWorkflow(
    taskId: number,
    completerId: string
  ): Promise<{
    workflowId: string;
    steps: WorkflowStep[];
    status: string;
  }> {
    const result = await this.workflowManager.createCompletionWorkflow(taskId, completerId);
    return {
      workflowId: result.workflowId,
      steps: result.steps,
      status: result.status
    };
  }

  /**
   * Execute a specific workflow step
   */
  async executeWorkflowStep(
    workflowId: string,
    stepId: string,
    userId: string
  ): Promise<{
    success: boolean;
    message: string;
    nextStep?: string;
  }> {
    return await this.workflowManager.executeStep(workflowId, stepId, userId);
  }

  /**
   * Get active workflows for a user
   */
  async getActiveWorkflows(): Promise<Workflow[]> {
    // Return all workflows from registry (in production, would query from database)
    // For now, we'll need to access the workflow registry
    return [];
  }

  /**
   * Get prediction for task duration
   */
  async predictTaskDuration(
    taskId: number
  ): Promise<{
    predictedMinutes: number;
    confidence: number;
    methodology: string;
    factors: any[];
  }> {
    const predictiveEngine = new PredictiveAnalytics();
    const prediction = await predictiveEngine.getDurationPrediction(taskId);

    return {
      predictedMinutes: prediction.predictedMinutes,
      confidence: prediction.confidence,
      methodology: prediction.methodology,
      factors: prediction.factors
    };
  }

  /**
   * Get predictive insights for a set of tasks
   */
  async getPredictiveInsights(taskIds: number[]): Promise<{
    predictions: { taskId: number; name: string; predictedMinutes: number; confidence: number; predictedCompletion: string | null }[];
    recommendations: string[];
  }> {
    const predictiveEngine = new PredictiveAnalytics();
    const forecasts = await Promise.all(
      taskIds.map(async (taskId) => {
        try {
          const task = await taskOperations.getById(taskId);
          if (!task) return null;

          const prediction = await predictiveEngine.getDurationPrediction(taskId);
          return {
            taskId,
            name: task.name,
            predictedMinutes: prediction.predictedMinutes,
            confidence: prediction.confidence,
            predictedCompletion: prediction.predictedCompletionDate
          };
        } catch {
          return null;
        }
      })
    );

    const validPredictions = predictions.filter(Boolean) as any[];

    // Generate recommendations based on predictions
    const recommendations: string[] = [];

    const lowConfidenceTasks = validPredictions.filter((p: any) => p.confidence < 0.5);
    if (lowConfidenceTasks.length > 0) {
      recommendations.push(
        `${lowConfidenceTasks.length} tasks need more historical data for accurate predictions.`
      );
    }

    const overduePredicted = validPredictions.filter((p: any) =>
      p.predictedCompletion === null && p.confidence > 0.5
    );
    if (overduePredicted.length > 0) {
      recommendations.push(
        `${overduePredicted.length} tasks are predicted to be overdue. Consider rescheduling.`
      );
    }

    return {
      predictions: validPredictions,
      recommendations
    };
  }
}

/**
 * Interface definitions for Intelligence Hub
 */
export interface AISchedule {
  morning: TaskWithDetails[];
  afternoon: TaskWithDetails[];
  evening: TaskWithDetails[];
}

export interface DailyPlanSegment {
  tasks: {
    id: number;
    title: string;
    description: string;
    estimatedMinutes: number;
    priority: string;
    isRecurring: boolean;
  }[];
  totalEstimatedMinutes: number;
}

export interface EnergyWindow {
  period: 'morning' | 'afternoon' | 'evening';
  startTime: string; // HH:MM format
  endTime: string;   // HH:MM format
  energyLevel: 'low' | 'medium' | 'high' | 'variable';
  recommendedTaskTypes: string[];
  description: string;
}