/**
 * Orchestrator - Core state machine that drives the multi‑agent workflow.
 *
 * Responsibilities:
 * 1. Pull tasks from the global queue.
 * 2. Select the most appropriate agent (using PriorityAgent and ConflictArbiter).
 * 3. Dispatch the task to the selected agent.
 * 4. Handle retries, timeouts and failures.
 * 5. Emit progress events for UI/dashboard consumption.
 */

import { useAgentOS } from '@/lib/agent-os';
import { usePriorityAgent } from '@/lib/priority-agent';
import { useConflictArbiter } from '@/lib/conflict-arbiter';
import { useBackchannelAgent } from '@/lib/backchannel-agent';
import { useEnvironmentAgent } from '@/lib/environment-agent';
import { Task } from '@/types/task';
import { v4 as uuidv4 } from 'uuid';

export interface OrchestratorConfig {
  maxConcurrentTasks?: number;
  taskTimeoutMs?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
}

const defaultConfig: OrchestratorConfig = {
  maxConcurrentTasks: 10,
  taskTimeoutMs: 300000, // 5 minutes
  retryAttempts: 3,
  retryDelayMs: 5000,
};

export class Orchestrator {
  private config: OrchestratorConfig;
  private isRunning: boolean = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private activeTasks: Map<string, { task: Task; agentId: string; startTime: number }> = new Map();

  constructor(config: Partial<OrchestratorConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Start the orchestrator processing loop
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.processingLoop();
  }

  /**
   * Stop the orchestrator processing loop
   */
  stop(): void {
    this.isRunning = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  /**
   * Main processing loop - runs continuously while orchestrator is active
   */
  private processingLoop(): void {
    const loop = async () => {
      if (!this.isRunning) return;

      try {
        // 1. Get pending tasks from agent OS queue
        const pendingTasks = this.getPendingTasks();

        // 2. Process each pending task up to max concurrency
        for (const task of pendingTasks) {
          if (this.activeTasks.size >= this.config.maxConcurrentTasks!) {
            break; // Reached max concurrency
          }

          // Check if we're already processing this task
          if (Array.from(this.activeTasks.values()).some(t => t.task.id === task.id)) {
            continue; // Skip if already processing
          }

          // 3. Select the best agent for this task
          const agentSelection = this.selectAgentForTask(task);
          if (!agentSelection) {
            // No suitable agent found, skip for now
            continue;
          }

          // 4. Dispatch task to selected agent
          await this.dispatchTask(task, agentSelection.agentId);
        }
      } catch (error) {
        console.error('Error in orchestrator processing loop:', error);
      }

      // Schedule next iteration
      if (this.isRunning) {
        setTimeout(() => this.processingLoop(), 1000); // Run every second
      }
    };

    // Start the loop
    loop();
  }

  /**
   * Get pending tasks from the agent OS queue
   */
  private getPendingTasks(): Task[] {
    const agentOS = useAgentOS.getState();
    const pending = agentOS.global_queue.getPending();
    return pending;
  }

  /**
   * Select the best agent for a given task based on capabilities, priority, and context
   */
  private selectAgentForTask(task: Task): { agentId: string; agent: any } | null {
    // 1. Get available agents that match required capabilities
    const agentOS = useAgentOS.getState();
    const requiredCapabilities = task.required_capabilities || [];
    const availableAgents = agentOS.getAvailableAgents(requiredCapabilities);

    if (availableAgents.length === 0) {
      return null;
    }

    // 2. Get current environment context
    const environment = useEnvironmentAgent.getState();
    const currentContext = environment.getCurrentContext();

    // 3. Score each agent based on suitability
    const scoredAgents = availableAgents.map(agent => {
      // Capability match score (all required capabilities must be present)
      const capabilityScore = requiredCapabilities.every(cap =>
        agent.capabilities[cap as keyof typeof agent.capabilities] === true
      ) ? 1.0 : 0;

      // Current workload (lower is better)
      const workload = agentOS.workloads.get(agent.id)?.active_tasks || 0;
      const workloadScore = 1.0 / (workload + 1);

      // Context fit score
      const contextScore = this.evaluateContextFit(task, currentContext.context);

      // Priority alignment (higher priority tasks get slight boost)
      const priorityScore = task.priority / 10.0; // Normalize to 0-1 range

      // Combined score
      const totalScore = (capabilityScore * 0.4) + (workloadScore * 0.3) + (contextScore * 0.2) + (priorityScore * 0.1);

      return { agentId: agent.id, agent, score: totalScore };
    });

    // 4. Sort by score (highest first) and return the best
    scoredAgents.sort((a, b) => b.score - a.score);
    const bestAgent = scoredAgents[0];

    // Only return if score is above threshold
    return bestAgent.score > 0.3 ? bestAgent : null;
  }

  /**
   * Evaluate how well a task fits the current context
   */
  private evaluateContextFit(task: Task, currentContext: string): number {
    // If task has no context requirements, it fits any context
    if (!task.allowedContexts || task.allowedContexts.length === 0) {
      return 1.0;
    }

    // Check if current context is allowed for this task
    return task.allowedContexts.includes(currentContext) ? 1.0 : 0.3;
  }

  /**
   * Dispatch a task to an agent for execution
   */
  private async dispatchTask(task: Task, agentId: string): Promise<void> {
    const agentOS = useAgentOS.getState();
    const backchannel = useBackchannelAgent();

    try {
      // 1. Assign task to agent in AgentOS
      const assignmentResult = agentOS.assignTask(task, agentId);
      if (!assignmentResult.success) {
        throw new Error(`Failed to assign task to agent ${agentId}`);
      }

      // 2. Track active task
      this.activeTasks.set(task.id, {
        task,
        agentId,
        startTime: Date.now()
      });

      // 3. Notify via backchannel
      backchannel.send({
        type: 'TASK_ASSIGNMENT',
        from: 'orchestrator',
        to: agentId,
        payload: {
          taskId: task.id,
          description: task.description,
          priority: task.priority,
          requiredCapabilities: task.required_capabilities,
        },
        priority: task.priority,
        timestamp: Date.now(),
      });

      // 4. Set up timeout for this task
      setTimeout(() => {
        this.checkTaskTimeout(task.id);
      }, this.config.taskTimeoutMs!);

    } catch (error) {
      console.error(`Failed to dispatch task ${task.id} to agent ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Check if a task has timed out and handle accordingly
   */
  private checkTaskTimeout(taskId: string): void {
    const activeTask = this.activeTasks.get(taskId);
    if (!activeTask) return; // Task already completed or removed

    const elapsed = Date.now() - activeTask.startTime;
    if (elapsed >= this.config.taskTimeoutMs!) {
      console.warn(`Task ${taskId} has timed out after ${elapsed}ms`);
      this.handleTaskTimeout(activeTask.task, activeTask.agentId);
    }
  }

  /**
   * Handle a timed out task
   */
  private handleTaskTimeout(task: Task, agentId: string): void {
    const agentOS = useAgentOS.getState();
    const backchannel = useBackchannelAgent();

    try {
      // 1. Release any locks held by this task
      agentOS.releaseLock(task.id);

      // 2. Mark task as failed due to timeout
      agentOS.global_queue.markFailed(task.id, agentId, 'Task timed out');

      // 3. Update agent workload
      agentOS.updateWorkloadMetrics(agentId, false, 'timeout');

      // 4. Notify via backchannel
      backchannel.send({
        type: 'TASK_TIMEOUT',
        from: 'orchestrator',
        to: agentId,
        payload: {
          taskId: task.id,
          reason: 'execution_timeout',
        },
        priority: 8, // High priority for timeout notifications
        timestamp: Date.now(),
      });

      // 5. Remove from active tasks
      this.activeTasks.delete(task.id);
    } catch (error) {
      console.error(`Error handling timeout for task ${task.id}:`, error);
    }
  }

  /**
   * Handle task completion (called by agents when they finish a task)
   */
  completeTask(taskId: string, agentId: string, success: boolean, error?: string): void {
    const agentOS = useAgentOS.getState();
    const backchannel = useBackchannelAgent();
    const priorityAgent = usePriorityAgent.getState();
    const metrics = require('./metrics').metricsCollector;

    try {
      // 1. Release any locks held by this task
      agentOS.releaseLock(taskId);

      // 2. Update task status in queue
      if (success) {
        agentOS.global_queue.markCompleted(taskId, agentId);
        agentOS.updateWorkloadMetrics(agentId, true);
      } else {
        agentOS.global_queue.markFailed(taskId, agentId, error || 'Unknown error');
        agentOS.updateWorkloadMetrics(agentId, false, error);
      }

      // 3. Record metrics
      metrics.finishTask(taskId, agentId, success, error);

      // 4. Update priority agent with task outcome (for learning)
      // This would typically involve updating the priority scoring based on outcome
      // For now we'll just note that the task completed

      // 5. Notify via backchannel
      backchannel.send({
        type: success ? 'TASK_COMPLETED' : 'TASK_FAILED',
        from: 'orchestrator',
        to: agentId,
        payload: {
          taskId: task.id,
          success,
          error: error || undefined,
          durationMs: Date.now() - (this.activeTasks.get(taskId)?.startTime || Date.now()),
        },
        priority: success ? 3 : 6, // Higher priority for failures
        timestamp: Date.now(),
      });

      // 6. Remove from active tasks
      this.activeTasks.delete(taskId);
    } catch (error) {
      console.error(`Error completing task ${taskId}:`, error);
    }
  }

  /**
   * Get current orchestrator status
   */
  getStatus() {
    const agentOS = useAgentOS.getState();
    return {
      isRunning: this.isRunning,
      activeTasks: this.activeTasks.size,
      queuedTasks: agentOS.global_queue.queue.size,
      totalAgents: agentOS.agents.size,
      timestamp: Date.now(),
    };
  }
}

// Export a singleton instance
let orchestratorInstance: Orchestrator | null = null;

export function getOrchestrator(config?: Partial<OrchestratorConfig>): Orchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new Orchestrator(config);
  }
  return orchestratorInstance;
}

export function createOrchestrator(config?: Partial<OrchestratorConfig>): Orchestrator {
  return new Orchestrator(config);
}