/**
 * Task Metrics Collector
 * Records execution statistics for tasks and agents.
 *
 * Metrics stored in-memory for demo; in production could be sent to
 * Prometheus, InfluxDB, or a time-series DB.
 */

export interface TaskMetric {
  taskId: string;
  agentId: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  success: boolean;
  error?: string;
  priority: number;
}

export interface AgentMetric {
  agentId: string;
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  averageDurationMs: number;
  lastSeen: number;
}

export class MetricsCollector {
  private taskMetrics: TaskMetric[] = [];
  private agentMetrics: Map<string, AgentMetric> = new Map();

  /**
   * Record the start of a task execution.
   */
  startTask(taskId: string, agentId: string, priority: number): void {
    // No-op; we'll capture start time in finishTask using a temporary map
    // For simplicity we store a pending start in agentMetrics.
    const agent = this.agentMetrics.get(agentId);
    const now = Date.now();
    if (!agent) {
      this.agentMetrics.set(agentId, {
        agentId,
        totalTasks: 0,
        successfulTasks: 0,
        failedTasks: 0,
        averageDurationMs: 0,
        lastSeen: now,
      });
    }
    // Store start time in a temporary map keyed by taskId
    // We'll use a separate map for pending starts.
    (this as any).pendingStarts ??= new Map();
    (this as any).pendingStarts.set(taskId, { agentId, startedAt: now, priority });
  }

  /**
   * Record the end of a task execution.
   */
  finishTask(
    taskId: string,
    agentId: string,
    success: boolean,
    error?: string,
  ): void {
    const now = Date.now();
    const pending = (this as any).pendingStarts?.get(taskId);
    if (!pending) {
      console.warn(`Metrics: No start recorded for task ${taskId}`);
      return;
    }
    const durationMs = now - pending.startedAt;

    const metric: TaskMetric = {
      taskId,
      agentId: pending.agentId,
      startedAt: pending.startedAt,
      endedAt: now,
      durationMs,
      success,
      error,
      priority: pending.priority,
    };
    this.taskMetrics.push(metric);

    // Update agent metrics
    const agent = this.agentMetrics.get(agentId) ?? {
      agentId,
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      averageDurationMs: 0,
      lastSeen: now,
    };
    agent.totalTasks++;
    if (success) {
      agent.successfulTasks++;
    } else {
      agent.failedTasks++;
    }
    // Recalculate average duration
    const totalDuration =
      agent.averageDurationMs * (agent.totalTasks - 1) + durationMs;
    agent.averageDurationMs = totalDuration / agent.totalTasks;
    agent.lastSeen = now;
    this.agentMetrics.set(agentId, agent);

    // Clean pending start
    (this as any).pendingStarts?.delete(taskId);
  }

  /**
   * Get all task metrics (optionally filtered by agentId).
   */
  getTaskMetrics(agentId?: string): TaskMetric[] {
    if (agentId) {
      return this.taskMetrics.filter((m) => m.agentId === agentId);
    }
    return [...this.taskMetrics];
  }

  /**
   * Get summary metrics for all agents.
   */
  getAgentMetrics(): AgentMetric[] {
    return [...this.agentMetrics.values()];
  }

  /**
   * Get overall system stats.
   */
  getSystemStats() {
    const totalTasks = this.taskMetrics.length;
    const successful = this.taskMetrics.filter((t) => t.success).length;
    const failed = totalTasks - successful;
    const avgDuration =
      totalTasks > 0
        ? this.taskMetrics.reduce((sum, t) => sum + t.durationMs, 0) /
          totalTasks
        : 0;
    return {
      totalTasks,
      successfulTasks: successful,
      failedTasks: failed,
      averageDurationMs: avgDuration,
      timestamp: Date.now(),
    };
  }
}

// Export a singleton instance for easy import
export const metricsCollector = new MetricsCollector();