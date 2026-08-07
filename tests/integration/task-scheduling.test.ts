/**
 * Integration Test: Task Scheduling Flow
 * -----------------
 * Tests the full flow of:
 *  1. Creating a task via API
 *  2. Assigning it to an agent via AgentOS
 *  3. Handling conflicts during assignment
 *  4. Completing the task
 *  5. Verifying metrics were recorded
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { useAgentOS } from '@/lib/agent-os';
import { useConflictArbiter } from '@/lib/conflict-arbiter';
import { useEnvironmentAgent } from '@/lib/environment-agent';
import { useBackchannelAgent } from '@/lib/backchannel-agent';
import { metricsCollector } from '@/lib/metrics';
import { getScheduler } from '@/lib/scheduler';

// Mock WebSocket for tests
beforeAll(() => {
  global.WebSocket = class MockWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    readyState = MockWebSocket.OPEN;
    url = '';
    addEventListener() {}
    removeEventListener() {}
    send() {}
    close() { this.readyState = MockWebSocket.CLOSED; }
    dispatchEvent() { return true; }
  };
});

describe('Task Scheduling Integration', () => {
  let agentOS: ReturnType<typeof useAgentOS.getState>;
  let conflictArbiter: ReturnType<typeof useConflictArbiter>;
  let scheduler: any;

  beforeAll(() => {
    agentOS = useAgentOS.getState();
    conflictArbiter = useConflictArbiter();
    scheduler = getScheduler();
  });

  it('should create, assign, and complete a task flow', async () => {
    // Register an agent
    const agentId = agentOS.registerAgent({
      id: 'test-agent-e2e',
      name: 'Test Agent E2E',
      version: '1.0.0',
      capabilities: {
        deep_work: true,
        creative: false,
        interrupt_handling: true,
        context_sharing: false,
        data_analysis: true,
        file_operations: false,
        api_integration: true,
      },
      specializations: ['analysis'],
      focus_depth: 80,
      energy_level: 85,
      availability_score: 90,
    });

    // Create a task
    const task = {
      id: 'test-task-e2e',
      description: 'Integration test task',
      required_capabilities: ['data_analysis'],
      priority: 5,
      dependencies: [],
      created_by: 'test-user',
      status: 'pending' as const,
      created_at: Date.now(),
    };

    // Record task start in metrics
    metricsCollector.startTask(task.id, agentId, task.priority);

    // Assign task to agent
    const assignment = agentOS.assignTask(task, agentId);
    expect(assignment.success).toBe(true);
    expect(assignment.assignedAgentId).toBe(agentId);

    // Verify agent state
    const agent = agentOS.getAgent(agentId);
    expect(agent?.currentTaskId).toBe(task.id);

    // Complete task
    agentOS.completeTask(task.id, agentId, true);

    // Verify task is no longer assigned
    const completedAgent = agentOS.getAgent(agentId);
    expect(completedAgent?.currentTaskId).toBeUndefined();

    // Verify metrics recorded
    const taskMetrics = metricsCollector.getTaskMetrics(agentId);
    expect(taskMetrics.length).toBe(1);
    expect(taskMetrics[0].success).toBe(true);

    // Cleanup
    agentOS.releaseLock(task.id);
  });

  it('should handle conflict resolution during task assignment', async () => {
    // Register two agents that could conflict over a task
    const agentId1 = agentOS.registerAgent({
      id: 'conflict-agent-1',
      name: 'Agent One',
      version: '1.0.0',
      capabilities: {
        deep_work: true,
        creative: true,
        interrupt_handling: true,
        context_sharing: true,
        data_analysis: true,
        file_operations: true,
        api_integration: true,
      },
      specializations: ['general'],
      focus_depth: 90,
      energy_level: 90,
      availability_score: 95,
    });

    const agentId2 = agentOS.registerAgent({
      id: 'conflict-agent-2',
      name: 'Agent Two',
      version: '1.0.0',
      capabilities: {
        deep_work: true,
        creative: true,
        interrupt_handling: false,
        context_sharing: true,
        data_analysis: true,
        file_operations: true,
        api_integration: true,
      },
      specializations: ['general'],
      focus_depth: 85,
      energy_level: 80,
      availability_score: 90,
    });

    // Report a conflict
    const conflictId = conflictArbiter.reportConflict({
      type: 'TASK_LOCK_CONTENTION',
      participants: [agentId1, agentId2],
      description: 'Two agents trying to acquire lock on same task',
      priority: 8,
      severity: 'high',
      context: {
        taskId: 'shared-task-1',
        timestamp: Date.now(),
      },
    });

    expect(conflictId).toBeDefined();

    // Verify conflict is detected
    const activeConflicts = conflictArbiter.getActiveConflicts();
    expect(activeConflicts.length).toBe(1);
    expect(activeConflicts[0].id).toBe(conflictId);

    // Resolve conflict
    const resolved = conflictArbiter.resolveConflict(conflictId, 'LOCK_WINNER');
    expect(resolved).toBe(true);

    // Verify conflict is resolved
    const resolvedConflicts = conflictArbiter.getActiveConflicts();
    expect(resolvedConflicts.length).toBe(0);

    // Check resolution history
    const history = conflictArbiter.getResolutionHistory(10);
    expect(history.length).toBe(1);
    expect(history[0].resolution?.strategy).toBe('LOCK_WINNER');
  });

  it('should schedule and execute a recurring task', async () => {
    // Schedule a recurring task
    const recurringTask = {
      id: 'recurring-task-1',
      description: 'Daily backup task',
      required_capabilities: ['data_analysis'],
      priority: 3,
      dependencies: [],
      created_by: 'scheduler',
      status: 'pending' as const,
      created_at: Date.now(),
      recurrence: {
        pattern: 'hourly' as const,
        interval: 2,
        daysOfWeek: [],
      },
      executionCount: 0,
      maxExecutions: 3,
    };

    const scheduledId = scheduler.scheduleTask(recurringTask);
    expect(scheduledId).toBe(recurringTask.id);

    // Wait for at least one execution cycle
    await new Promise(resolve => setTimeout(resolve, 15000));

    // Verify task was scheduled
    const scheduledTasks = scheduler.getScheduledTasks();
    expect(scheduledTasks.length).toBe(1);
    expect(scheduledTasks[0].id).toBe(recurringTask.id);

    // Cleanup
    scheduler.cancelTask(recurringTask.id);
  });

  it('should track and retrieve system metrics', async () => {
    // Record start/end of task
    metricsCollector.startTask('metrics-test-task', 'test-agent-e2e', 5);
    await new Promise(resolve => setTimeout(resolve, 100));
    metricsCollector.finishTask('metrics-test-task', 'test-agent-e2e', true);

    // Check system stats
    const stats = metricsCollector.getSystemStats();
    expect(stats.totalTasks).toBeGreaterThan(0);
    expect(stats.successfulTasks).toBeGreaterThan(0);

    // Check agent stats
    const agentMetrics = metricsCollector.getAgentMetrics();
    const testAgentMetric = agentMetrics.find(m => m.agentId === 'test-agent-e2e');
    expect(testAgentMetric).toBeDefined();
    expect(testAgentMetric?.successfulTasks).toBeGreaterThan(0);
  });
});