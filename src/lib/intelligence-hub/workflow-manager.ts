import { TaskWithDetails } from '@/lib/types';
import { taskOperations } from '@/lib/db/tasks';
import { labelOperations } from '@/lib/db/labels';

/**
 * Workflow Manager - Handles task workflows, approvals, and automated processes
 */
export class WorkflowManager {
  private workflowRegistry: Map<string, Workflow>;

  constructor() {
    this.workflowRegistry = new Map<string, Workflow>();
  }

  /**
   * Create a task workflow for task completion
   */
  async createCompletionWorkflow(
    taskId: number,
    completerId: string
  ): Promise<{
    workflowId: string;
    steps: WorkflowStep[];
    status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
    createdAt: string;
  }> {
    const task = await taskOperations.getById(taskId);

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const workflowId = `workflow-${taskId}-${Date.now()}`;

    const steps: WorkflowStep[] = [
      {
        id: 'step-1',
        name: 'Task Completion Verification',
        type: 'verification',
        status: 'pending',
        assignedTo: completerId,
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        dependsOn: [],
        action: 'verifyTaskCompletion',
        metadata: { taskId }
      },
      {
        id: 'step-2',
        name: 'Update Task Status',
        type: 'status-update',
        status: 'pending',
        assignedTo: completerId,
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        dependsOn: ['step-1'],
        action: 'markTaskCompleted',
        metadata: { taskId }
      },
      {
        id: 'step-3',
        name: 'Notify Stakeholders',
        type: 'notification',
        status: 'pending',
        assignedTo: completerId,
        dueDate: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(), // 12 hours
        dependsOn: ['step-2'],
        action: 'sendCompletionNotification',
        metadata: { taskId }
      },
      {
        id: 'step-4',
        name: 'Award Points/Badges',
        type: 'gamification',
        status: 'pending',
        assignedTo: completerId,
        dueDate: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(), // 6 hours
        dependsOn: ['step-3'],
        action: 'awardRecognition',
        metadata: { taskId }
      },
      {
        id: 'step-5',
        name: 'Post-Review Analysis',
        type: 'analysis',
        status: 'pending',
        assignedTo: completerId,
        dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48 hours
        dependsOn: ['step-4'],
        action: 'postTaskReview',
        metadata: { taskId }
      }
    ];

    const workflow: Workflow = {
      workflowId,
      steps,
      status: 'pending',
      createdAt: new Date().toISOString(),
      metadata: { taskId }
    };

    // Store in registry
    this.workflowRegistry.set(workflowId, workflow);

    return {
      workflowId,
      steps,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Save/update a workflow in the registry
   */
  saveWorkflow(workflow: Workflow): void {
    this.workflowRegistry.set(workflow.workflowId, workflow);
  }

  /**
   * Execute a workflow step
   */
  async executeStep(workflowId: string, stepId: string, userId: string): Promise<{
    success: boolean;
    message: string;
    nextStep?: string;
  }> {
    // Get workflow from registry
    const workflow = this.workflowRegistry.get(workflowId);

    if (!workflow) {
      return {
        success: false,
        message: `Workflow ${workflowId} not found`
      };
    }

    const step = workflow.steps.find(s => s.id === stepId);

    if (!step) {
      return {
        success: false,
        message: `Step ${stepId} not found in workflow ${workflowId}`
      };
    }

    if (step.status !== 'pending') {
      return {
        success: false,
        message: `Step ${stepId} is not pending (status: ${step.status})`
      };
    }

    // Execute step action based on type
    let executionResult: any;

    switch (step.action) {
      case 'verifyTaskCompletion':
        executionResult = await this.verifyTaskCompletion(
          workflow.metadata?.taskId as number,
          userId
        );
        break;
      case 'markTaskCompleted':
        executionResult = await this.markTaskCompleted(
          workflow.metadata?.taskId as number,
          userId
        );
        break;
      case 'sendCompletionNotification':
        executionResult = await this.sendCompletionNotification(
          workflow.metadata?.taskId as number,
          userId
        );
        break;
      case 'awardRecognition':
        executionResult = await this.awardRecognition(
          workflow.metadata?.taskId as number,
          userId
        );
        break;
      case 'postTaskReview':
        executionResult = await this.postTaskReview(
          workflow.metadata?.taskId as number,
          userId
        );
        break;
      default:
        return {
          success: false,
          message: `Unknown action: ${step.action}`
        };
    }

    // Update step status
    const stepIndex = workflow.steps.findIndex(s => s.id === stepId);
    if (stepIndex !== -1) {
      workflow.steps[stepIndex].status = executionResult.success ? 'completed' : 'failed';
      workflow.steps[stepIndex].completedAt = new Date().toISOString();
      workflow.steps[stepIndex].output = executionResult.output;
      workflow.steps[stepIndex].errorMessage = executionResult.errorMessage;
    }

    // Check if all steps are complete
    const allStepsComplete = workflow.steps.every(s => s.status === 'completed');
    if (allStepsComplete) {
      workflow.status = 'completed';
    } else {
      workflow.status = executionResult.success ? 'in-progress' : 'failed';
    }

    // Save updated workflow to registry
    this.saveWorkflow(workflow);

    return {
      success: executionResult.success,
      message: executionResult.message || 'Step executed',
      nextStep: executionResult.nextStep
    };
  }

  /**
   * Verify task completion by checking database state
   */
  private async verifyTaskCompletion(
    taskId: number,
    userId: string
  ): Promise<{
    success: boolean;
    message: string;
    output?: any;
    errorMessage?: string;
  }> {
    const task = await taskOperations.getById(taskId);

    if (!task) {
      return {
        success: false,
        message: 'Task not found',
        errorMessage: 'Task not found'
      };
    }

    if (task.is_completed === 1) {
      return {
        success: true,
        message: 'Task already marked as completed',
        output: { taskId, wasAlreadyCompleted: true }
      };
    }

    // Check if user has permission to mark this task
    // In production, would check user roles/permissions

    return {
      success: true,
      message: 'Task completion verified',
      output: { taskId, wasAlreadyCompleted: false }
    };
  }

  /**
   * Mark task as completed in database
   */
  private async markTaskCompleted(
    taskId: number,
    userId: string
  ): Promise<{
    success: boolean;
    message: string;
    output?: any;
    errorMessage?: string;
  }> {
    const task = await taskOperations.getById(taskId);

    if (!task) {
      return {
        success: false,
        message: 'Task not found',
        errorMessage: 'Task not found'
      };
    }

    // Mark task as completed
    const updateResult = await taskOperations.update(taskId, {
      is_completed: 1,
      updated_at: new Date().toISOString()
    });

    if (!updateResult) {
      return {
        success: false,
        message: 'Failed to update task status',
        errorMessage: 'Failed to update task status'
      };
    }

    // Award gamification points
    // Would integrate with gamification system in production

    return {
      success: true,
      message: 'Task marked as completed successfully',
      output: { taskId, wasAlreadyCompleted: false }
    };
  }

  /**
   * Send completion notification
   */
  private async sendCompletionNotification(
    taskId: number,
    userId: string
  ): Promise<{
    success: boolean;
    message: string;
    output?: any;
    errorMessage?: string;
  }> {
    // In production, would send actual notification via email, push, etc.
    return {
      success: true,
      message: 'Completion notification queued',
      output: { taskId, notificationType: 'task_completion' }
    };
  }

  /**
   * Award recognition/badges for task completion
   */
  private async awardRecognition(
    taskId: number,
    userId: string
  ): Promise<{
    success: boolean;
    message: string;
    output?: any;
    errorMessage?: string;
  }> {
    // In production, would integrate with gamification system
    // Would check for achievements, award points, update badges, etc.
    return {
      success: true,
      message: 'Recognition awarded',
      output: { taskId, recognitionType: 'task_completion' }
    };
  }

  /**
   * Post-task review analysis
   */
  private async postTaskReview(
    taskId: number,
    userId: string
  ): Promise<{
    success: boolean;
    message: string;
    output?: any;
    errorMessage?: string;
  }> {
    // In production, would analyze task completion patterns,
    // provide insights, update productivity metrics, etc.
    return {
      success: true,
      message: 'Post-task review completed',
      output: { taskId, reviewType: 'completion_analysis' }
    };
  }

  /**
   * Get workflow from storage (placeholder implementation)
   */
  private async getWorkflow(workflowId: string): Promise<{
    workflowId: string;
    steps: WorkflowStep[];
    status: string;
    createdAt: string;
    metadata?: any;
  }> {
    // In production, would fetch from database
    // Returning mock structure for now
    return {
      workflowId,
      steps: [],
      status: 'pending',
      createdAt: new Date().toISOString(),
      metadata: {}
    };
  }

  /**
   * Optimize workflow schedule based on context
   */
  async optimizeWorkflow(
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
      // Use the agent orchestrator to optimize the schedule
      // In production, would inject the agent orchestrator dependency
      const optimizerAgent = new (await import('@/lib/intelligence-hub/agent-orchestrator'))
        .TaskOptimizerAgent;

      return optimizerAgent.optimizeSchedule(schedule, context);
    } catch (error) {
      console.error('Workflow optimization failed:', error);
      // Fallback: simple redistribution
      return this.simpleWorkflowOptimization(schedule);
    }
  }

  /**
   * Simple workflow optimization fallback
   */
  private simpleWorkflowOptimization(
    schedule: {
      morning: TaskWithDetails[];
      afternoon: TaskWithDetails[];
      evening: TaskWithDetails[];
    }
  ): {
    morning: TaskWithDetails[];
    afternoon: TaskWithDetails[];
    evening: TaskWithDetails[];
  } {
    // Simple balancing - ensure no period exceeds reasonable limits
    const timeLimits = { morning: 240, afternoon: 240, evening: 180 };

    const result = {
      morning: [...schedule.morning],
      afternoon: [...schedule.afternoon],
      evening: [...schedule.evening]
    };

    // Check and balance workloads
    const calculateLoad = (tasks: TaskWithDetails[]): number =>
      tasks.reduce((sum, task) => sum + (task.estimate_minutes || 0), 0);

    const currentLoads = {
      morning: calculateLoad(schedule.morning),
      afternoon: calculateLoad(schedule.afternoon),
      evening: calculateLoad(schedule.evening)
    };

    // Move tasks from overloaded periods to underloaded ones
    const targets = {
      morning: timeLimits.morning,
      afternoon: timeLimits.afternoon,
      evening: timeLimits.evening
    };

    // Simple transfer from afternoon to morning if morning has capacity
    if (currentLoads.morning > targets.morning && currentLoads.afternoon < targets.afternoon) {
      const excess = currentLoads.morning - targets.morning;
      const morningTasks = [...schedule.morning].sort(
        (a, b) => (b.estimate_minutes || 0) - (a.estimate_minutes || 0)
      );

      for (const task of morningTasks) {
        const taskTime = task.estimate_minutes || 0;
        if (excess >= taskTime && currentLoads.afternoon + taskTime <= targets.afternoon) {
          result.morning = result.morning.filter(t => t.id !== task.id);
          result.afternoon.push(task);
          excess -= taskTime;
        }
      }
    }

    // Simple transfer from evening to afternoon if afternoon has capacity
    if (currentLoads.afternoon > targets.afternoon && currentLoads.evening < targets.evening) {
      const excess = currentLoads.afternoon - targets.afternoon;
      const afternoonTasks = [...schedule.afternoon].sort(
        (a, b) => (b.estimate_minutes || 0) - (a.estimate_minutes || 0)
      );

      for (const task of afternoonTasks) {
        const taskTime = task.estimate_minutes || 0;
        if (excess >= taskTime && currentLoads.evening + taskTime <= targets.evening) {
          result.afternoon = result.afternoon.filter(t => t.id !== task.id);
          result.evening.push(task);
          excess -= taskTime;
        }
      }
    }

    return result;
  }
}

/**
 * Workflow step interface
 */
export interface WorkflowStep {
  id: string;
  name: string;
  type: 'verification' | 'status-update' | 'notification' | 'gamification' | 'analysis';
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  assignedTo: string;
  dueDate: string;
  dependsOn: string[];
  action: string;
  metadata?: any;
  completedAt?: string;
  output?: any;
  errorMessage?: string;
}

export interface Workflow {
  workflowId: string;
  steps: WorkflowStep[];
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  createdAt: string;
  metadata?: any;
}