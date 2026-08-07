/**
 * Task Scheduler Utility
 * Handles recurring tasks, delayed execution, and time-based workflows
 */

import { useAgentOS } from '@/lib/agent-os';
import { usePriorityAgent } from '@/lib/priority-agent';
import { useEnvironmentAgent } from '@/lib/environment-agent';
import { useBackchannelAgent } from '@/lib/backchannel-agent';
import { useConflictArbiter } from '@/lib/conflict-arbiter';
import { usePatternMiningService } from '@/lib/pattern-miner';
import { Task } from '@/types/task';
import { v4 as uuidv4 } from 'uuid';

export interface ScheduledTask extends Task {
  recurrence?: {
    pattern: 'hourly' | 'daily' | 'weekly' | 'monthly';
    interval?: number; // Number of units (e.g., every 2 hours)
    daysOfWeek?: number[]; // 0-6 for weekly pattern (0 = Sunday)
    dayOfMonth?: number; // 1-31 for monthly pattern
    hour?: number; // 0-23
    minute?: number; // 0-59
  };
  delayMs?: number; // One-time delay before execution
  expiresAt?: number; // Timestamp after which task should not be executed
  maxExecutions?: number; // Maximum number of times to execute (for recurring)
  executionCount?: number; // Track actual executions
}

export interface SchedulerState {
  scheduledTasks: Map<string, ScheduledTask>;
  runningTasks: Map<string, ScheduledTask>;
  isRunning: boolean;
  timerId: NodeJS.Timeout | null;
}

export class TaskScheduler {
  private state: SchedulerState = {
    scheduledTasks: new Map(),
    runningTasks: new Map(),
    isRunning: false,
    timerId: null,
  };

  private config = {
    checkIntervalMs: 10000, // Check for due tasks every 10 seconds
    maxConcurrentScheduled: 5,
    timezoneOffset: 0, // Adjust for local timezone if needed
  };

  private conflictArbiter = useConflictArbiter();
  private patternMiningService = usePatternMiningService();

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.state.isRunning) return;
    this.state.isRunning = true;
    this.scheduleCheckLoop();
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    this.state.isRunning = false;
    if (this.state.timerId) {
      clearInterval(this.state.timerId);
      this.state.timerId = null;
    }
  }

  /**
   * Schedule a task for execution
   */
  scheduleTask(task: ScheduledTask): string {
    const taskId = task.id || uuidv4();
    const scheduledTask: ScheduledTask = {
      ...task,
      id: taskId,
      executionCount: task.executionCount || 0,
    };

    // Add initial delay if specified
    if (task.delayMs) {
      scheduledTask.createdAt = Date.now() + task.delayMs;
    } else {
      scheduledTask.createdAt = Date.now();
    }

    this.state.scheduledTasks.set(taskId, scheduledTask);
    return taskId;
  }

  /**
   * Cancel a scheduled task
   */
  cancelTask(taskId: string): boolean {
    return this.state.scheduledTasks.delete(taskId);
  }

  /**
   * Get all scheduled tasks
   */
  getScheduledTasks(): ScheduledTask[] {
    return Array.from(this.state.scheduledTasks.values());
  }

  /**
   * Get running scheduled tasks
   */
  getRunningTasks(): ScheduledTask[] {
    return Array.from(this.state.runningTasks.values());
  }

  /**
   * Main check loop - runs periodically to check for due tasks
   */
  private scheduleCheckLoop(): void {
    const checkLoop = async () => {
      if (!this.state.isRunning) return;

      try {
        await this.processDueTasks();
      } catch (error) {
        console.error('Error in scheduler check loop:', error);
      }

      if (this.state.isRunning) {
        this.state.timerId = setTimeout(checkLoop, this.config.checkIntervalMs);
      }
    };

    // Start the loop
    this.state.timerId = setTimeout(checkLoop, 0);
  }

  /**
   * Process tasks that are due for execution
   */
  private async processDueTasks(): Promise<void> {
    const now = Date.now();

    // Get tasks that are due
    const dueTasks = Array.from(this.state.scheduledTasks.values()).filter(
      task => {
        // Check if task has expired
        if (task.expiresAt && now > task.expiresAt) {
          // Remove expired task
          this.state.scheduledTasks.delete(task.id);
          return false;
        }

        // Check if task is ready to run based on schedule or delay
        if (task.createdAt && now >= task.createdAt) {
          // Check recurrence pattern
          if (task.recurrence) {
            // For recurring tasks, check if it's time to execute
            return this.isRecurrenceDue(task, now);
          } else {
            // One-time task - check if already executed
            return (
              !this.state.runningTasks.has(task.id) &&
              task.executionCount < (task.maxExecutions || 1)
            );
          }
        }

        return false;
      }
    );

    // Limit concurrent executions
    const availableSlots =
      this.config.maxConcurrentScheduled -
      this.state.runningTasks.size;
    const tasksToRun = dueTasks.slice(0, availableSlots);

    // Execute each due task
    for (const task of tasksToRun) {
      await this.executeScheduledTask(task);
    }
  }

  /**
   * Check if a recurring task is due based on its pattern
   */
  private isRecurrenceDue(task: ScheduledTask, now: number): boolean {
    const date = new Date(now);
    const lastExecution = new Date(task.createdAt);

    switch (task.recurrence.pattern) {
      case 'hourly':
        return this.isHourlyDue(date, lastExecution, task.recurrence.interval);
      case 'daily':
        return this.isDailyDue(date, lastExecution, task.recurrence.interval);
      case 'weekly':
        return this.isWeeklyDue(
          date,
          lastExecution,
          task.recurrence.interval,
          task.recurrence.daysOfWeek
        );
      case 'monthly':
        return this.isMonthlyDue(
          date,
          lastExecution,
          task.recurrence.interval,
          task.recurrence.dayOfMonth
        );
      default:
        return false;
    }
  }

  private isHourlyDue(
    now: Date,
    lastExecution: Date,
    interval: number | undefined
  ): boolean {
    const hoursDiff =
      (now.getTime() - lastExecution.getTime()) / (1000 * 60 * 60);
    return hoursDiff >= (interval || 1);
  }

  private isDailyDue(
    now: Date,
    lastExecution: Date,
    interval: number | undefined
  ): boolean {
    const daysDiff =
      (now.getTime() - lastExecution.getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff >= (interval || 1);
  }

  private isWeeklyDue(
    now: Date,
    lastExecution: Date,
    interval: number | undefined,
    daysOfWeek: number[] | undefined
  ): boolean {
    // Check if enough weeks have passed
    const weeksDiff =
      (now.getTime() - lastExecution.getTime()) /
      (1000 * 60 * 60 * 24 * 7);
    if (weeksDiff < (interval || 1)) return false;

    // Check if day of week matches
    if (daysOfWeek && daysOfWeek.length > 0) {
      return daysOfWeek.includes(now.getDay());
    }
    return true;
  }

  private isMonthlyDue(
    now: Date,
    lastExecution: Date,
    interval: number | undefined,
    dayOfMonth: number | undefined
  ): boolean {
    // Check if enough months have passed
    const monthsDiff =
      (now.getMonth() - lastExecution.getMonth()) +
      (now.getFullYear() - lastExecution.getFullYear()) * 12;
    if (monthsDiff < (interval || 1)) return false;

    // Check if day of month matches
    if (dayOfMonth !== undefined) {
      return now.getDate() === dayOfMonth;
    }
    return true;
  }

  /**
   * Execute a scheduled task
   */
  private async executeScheduledTask(task: ScheduledTask): Promise<void> {
    const agentOS = useAgentOS.getState();
    const priorityAgent = usePriorityAgent.getState();
    const backchannel = useBackchannelAgent();
    const environment = useEnvironmentAgent.getState();
    const conflictArbiter = useConflictArbiter.getState();

    try {
      // Check if we have available agents for the required capabilities
      const availableAgents = agentOS.getAvailableAgents(
        task.required_capabilities || []
      );

      if (availableAgents.length === 0) {
        // No available agents - reschedule for later
        this.rescheduleTask(task);
        return;
      }

      // Check for potential conflicts before assignment
      const conflictCheck = await this.conflictArbiter.checkConflict(
        { taskId: task.id, participants: availableAgents.map(a => a.id) }
      );

      if (conflictCheck.conflictDetected) {
        // Resolve conflict or queue task for later
        const resolution = await this.conflictArbiter.resolveConflict(
          conflictCheck.conflictId!,
          'consensus'
        );
        if (!resolution.success) {
          // Conflict unresolved - reschedule for later
          this.rescheduleTask(task);
          return;
        }
      }

      // Select best agent based on priority and context
      const bestAgent = this.selectBestAgent(
        task,
        availableAgents,
        environment.getCurrentContext()
      );

      if (!bestAgent) {
        this.rescheduleTask(task);
        return;
      }

      // Mark task as running
      this.state.runningTasks.set(task.id, task);

      // Update execution count
      task.executionCount = (task.executionCount || 0) + 1;
      this.state.scheduledTasks.set(task.id, task);

      // Execute the task via agent OS
      const assignmentResult = agentOS.assignTask(task, bestAgent.id);
      if (!assignmentResult.success) {
        // Failed to assign - reschedule
        this.state.runningTasks.delete(task.id);
        this.rescheduleTask(task);
        return;
      }

      // Notify via backchannel
      backchannel.send({
        type: 'SCHEDULED_TASK_ASSIGNMENT',
        from: 'scheduler',
        to: bestAgent.id,
        payload: {
          taskId: task.id,
          description: task.description,
          recurrence: task.recurrence,
          executionCount: task.executionCount,
        },
        priority: task.priority,
        timestamp: Date.now(),
      });

      // Set up completion handler (in real implementation, this would be event-driven)
      // For now we'll just mark as completed after a delay for demo purposes
      setTimeout(() => {
        this.completeScheduledTask(task.id, bestAgent.id, true);
      }, 5000); // Simulate 5 second execution time
    } catch (error) {
      console.error(`Error executing scheduled task ${task.id}:`, error);
      this.handleTaskError(task, error as Error);
    }
  }

  /**
   * Select the best agent for a scheduled task
   */
  private selectBestAgent(
    task: ScheduledTask,
    availableAgents: any[],
    currentContext: string
  ): any | null {
    // Simple implementation - in reality would use more sophisticated scoring
    return availableAgents[0] || null;
  }

  /**
   * Handle completion of a scheduled task
   */
  private completeScheduledTask(
    taskId: string,
    agentId: string,
    success: boolean
  ): void {
    const agentOS = useAgentOS.getState();
    const backchannel = useBackchannelAgent();
    const task = this.state.runningTasks.get(taskId);

    if (!task) return;

    // Remove from running tasks
    this.state.runningTasks.delete(taskId);

    // Update task execution tracking
    const currentTask = this.state.scheduledTasks.get(taskId);
    if (currentTask) {
      // For recurring tasks, reschedule if not at max executions
      if (
        currentTask.maxExecutions === undefined ||
        currentTask.executionCount < currentTask.maxExecutions
      ) {
        // Reschedule for next occurrence
        this.rescheduleTask(currentTask);
      } else {
        // Reached max executions - remove from scheduled tasks
        this.state.scheduledTasks.delete(taskId);
      }
    }

    // Notify completion via backchannel
    backchannel.send({
      type: success
        ? 'SCHEDULED_TASK_COMPLETED'
        : 'SCHEDULED_TASK_FAILED',
      from: 'scheduler',
      to: agentId,
      payload: {
        taskId: task.id,
        success,
        executionCount: task.executionCount,
      },
      priority: success ? 3 : 6,
      timestamp: Date.now(),
    });

    // Complete the task in agent OS
    agentOS.completeTask(task.id, agentId, success);
  }

  /**
   * Reschedule a task for its next occurrence
   */
  private rescheduleTask(task: ScheduledTask): void {
    // Calculate next execution time based on recurrence
    const now = new Date();
    let nextExecution = new Date(now);

    switch (task.recurrence.pattern) {
      case 'hourly':
        nextExecution.setHours(
          now.getHours() + (task.recurrence.interval || 1)
        );
        break;
      case 'daily':
        nextExecution.setDate(
          now.getDate() + (task.recurrence.interval || 1)
        );
        break;
      case 'weekly':
        nextExecution.setDate(
          now.getDate() + 7 * (task.recurrence.interval || 1)
        );
        // Adjust day of week if specified
        if (task.recurrence.daysOfWeek) {
          // Find next matching day of week
          const targetDay = task.recurrence.daysOfWeek[0];
          const currentDay = now.getDay();
          let daysToAdd = targetDay - currentDay;
          if (daysToAdd <= 0) daysToAdd += 7;
          nextExecution.setDate(now.getDate() + daysToAdd);
        }
        break;
      case 'monthly':
        nextExecution.setMonth(
          now.getMonth() + (task.recurrence.interval || 1)
        );
        // Adjust day of month if specified
        if (task.recurrence.dayOfMonth) {
          nextExecution.setDate(task.recurrence.dayOfMonth);
          // Handle month overflow
          if (nextExecution.getDate() !== task.recurrence.dayOfMonth) {
            nextExecution.setDate(0); // Last day of previous month
          }
        }
        break;
    }

    // Update the task's creation time to the next execution
    task.createdAt = nextExecution.getTime();
    this.state.scheduledTasks.set(task.id, task);
  }

  /**
   * Handle errors during task execution
   */
  private handleTaskError(task: ScheduledTask, error: Error): void {
    const agentOS = useAgentOS.getState();
    const backchannel = useBackchannelAgent();

    // Remove from running tasks
    this.state.runningTasks.delete(task.id);

    // Notify failure via backchannel
    backchannel.send({
      type: 'SCHEDULED_TASK_ERROR',
      from: 'scheduler',
      to: '*', // Broadcast to all agents
      payload: {
        taskId: task.id,
        error: error.message,
        executionCount: task.executionCount,
      },
      priority: 8, // High priority for errors
      timestamp: Date.now(),
    });

    // For recurring tasks, we might want to reschedule despite error
    // For one-time tasks, we might want to retry or mark as failed
    if (task.recurrence) {
      // Reschedule anyway for recurring tasks
      this.rescheduleTask(task);
    } else {
      // For one-time tasks, increment error count and possibly reschedule
      // This is a simple implementation - in reality would have retry logic
      const currentTask = this.state.scheduledTasks.get(task.id);
      if (currentTask) {
        // Simple retry: reschedule for 1 minute later
        currentTask.createdAt = Date.now() + 60000;
        this.state.scheduledTasks.set(task.id, currentTask);
      }
    }
  }

  /**
   * Get scheduler status
   */
  getStatus(): SchedulerState {
    return {
      ...this.state,
      scheduledTasksCount: this.state.scheduledTasks.size,
      runningTasksCount: this.state.runningTasks.size,
    };
  }
}

// Export singleton instance
let schedulerInstance: TaskScheduler | null = null;

export function getScheduler(): TaskScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new TaskScheduler();
  }
  return schedulerInstance;
}

export function createScheduler(): TaskScheduler {
  return new TaskScheduler();
}