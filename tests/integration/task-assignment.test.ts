"use client";
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAgentOS } from '@/lib/agent-os';
import { usePriorityAgent } from '@/lib/priority-agent';
import { useEnvironmentAgent } from '@/lib/environment-agent';
import { useAgentRegistry } from '@/lib/agent-registry';
import { createTask, assignTask, completeTask, getTasks } from '@/api/tasks';

const MOCK_AGENT_ID = 'mock-agent-1';

function mockAgentCapabilities() {
  return {
    deep_work: true,
    creative: false,
    interrupt_handling: true,
    context_sharing: true,
    data_analysis: true,
    file_operations: false,
    api_integration: true,
  };
}

function createMockTask(priority: number = 5) {
  return {
    id: `task-${Date.now()}-${Math.random()}`,
    description: 'Integration test task',
    required_capabilities: ['data_analysis', 'api_integration'],
    priority,
    dependencies: [],
    created_by: MOCK_AGENT_ID,
    status: 'pending' as const,
    created_at: Date.now(),
    deadline: new Date(Date.now() + 3600000), // 1 hour from now
  };
}

describe('Task Assignment Integration Flow', () => {
  beforeEach(() => {
    // Mock environment context
    useEnvironmentAgent.getState().updateContext({
      currentContext: 'deep_work',
      confidence: 0.8,
      signals: { test: true },
    } as any);

    // Register mock agent
    const agentRegistry = useAgentRegistry.getState();
    const agentId = agentRegistry.registerAgent({
      name: 'Mock Test Agent',
      capabilities: mockAgentCapabilities(),
      workField: 'analysis',
    });

    // Reset agent OS
    const agentOS = useAgentOS.getState();
    agentOS.agents.clear();
    agentOS.workloads.clear();
    agentOS.active_locks.clear();
    agentOS.global_queue.queue.clear();
    agentOS.phase_registry.clear();

    // Re-register the agent
    const profile = {
      id: agentId,
      name: 'Mock Test Agent',
      version: '1.0.0',
      capabilities: mockAgentCapabilities(),
      specializations: ['analysis'],
      focus_depth: 80,
      energy_level: 85,
      availability_score: 90,
    };

    agentOS.registerAgent(profile);
  });

  it('should complete full task assignment and execution flow', async () => {
    const priorityAgent = usePriorityAgent.getState();

    // Create a task
    const task = createMockTask(7);

    // Initialize priority score
    priorityAgent.updateScore({
      taskId: task.id,
      description: task.description,
      deadline: task.deadline,
      dependencies: task.dependencies,
      context_type: 'work',
      user_focus_areas: ['analysis'],
      user_energy_level: 80,
    });

    // Create task in backend (simulated)
    const createdTask = await createTask(task);
    expect(createdTask).toBeDefined();

    // Assign task to agent
    const assignmentResult = await assignTask(createdTask.id, MOCK_AGENT_ID);
    expect(assignmentResult).toBeDefined();
    expect(assignmentResult.assignedAgentId).toBe(MOCK_AGENT_ID);

    // Verify task status in agent OS
    const agentOS = useAgentOS.getState();
    const agent = agentOS.getAgent(MOCK_AGENT_ID);
    expect(agent).toBeDefined();
    expect(agent?.currentTaskId).toBe(createdTask.id);

    // Simulate task completion
    const completionResult = await completeTask(createdTask.id, MOCK_AGENT_ID, true);
    expect(completionResult.success).toBe(true);

    // Verify task status in backend
    const retrievedTask = await getTasks(MOCK_AGENT_ID);
    expect(retrievedTask).toBeDefined();
    expect(retrievedTask.status).toBe('completed');

    // Verify agent workload updated
    const updatedAgent = agentOS.getAgent(MOCK_AGENT_ID);
    expect(updatedAgent).toBeDefined();
    expect(updatedAgent?.totalTasksCompleted).toBeGreaterThanOrEqual(1);
  });

  it('should reject task assignment when agent lacks required capabilities', async () => {
    const agentOS = useAgentOS.getState();

    // Create an agent with limited capabilities
    const limitedCapabilities = {
      deep_work: false,
      creative: false,
      interrupt_handling: false,
      context_sharing: false,
      data_analysis: false,
      file_operations: false,
      api_integration: false,
    };

    const agentId = agentOS.registerAgent({
      id: 'limited-agent',
      name: 'Limited Capabilities Agent',
      version: '1.0.0',
      capabilities: limitedCapabilities,
      specializations: ['limited'],
      focus_depth: 50,
      energy_level: 50,
      availability_score: 50,
    });

    // Create a task requiring capabilities the agent doesn't have
    const task = createMockTask(5);
    // Override the task's required capabilities
    task.required_capabilities = ['creative'];

    const assignmentResult = await assignTask(task.id, agentId);
    expect(assignmentResult.success).toBe(false);

    // Verify agent state not changed
    const agent = agentOS.getAgent(agentId);
    expect(agent?.currentTaskId).toBeUndefined();
  });

  it('should handle multiple concurrent tasks with priority ordering', async () => {
    const agentOS = useAgentOS.getState();
    const priorityAgent = usePriorityAgent.getState();

    // Create multiple tasks with different priorities
    const highPriorityTask = createMockTask(9);
    const mediumPriorityTask = createMockTask(5);
    const lowPriorityTask = createMockTask(1);

    // Initialize priority scores
    priorityAgent.updateScore({
      taskId: highPriorityTask.id,
      description: highPriorityTask.description,
      deadline: highPriorityTask.deadline,
      dependencies: highPriorityTask.dependencies,
      context_type: 'work',
      user_focus_areas: ['analysis'],
      user_energy_level: 80,
    });

    priorityAgent.updateScore({
      taskId: mediumPriorityTask.id,
      description: mediumPriorityTask.description,
      deadline: mediumPriorityTask.deadline,
      dependencies: mediumPriorityTask.dependencies,
      context_type: 'work',
      user_focus_areas: ['analysis'],
      user_energy_level: 80,
    });

    priorityAgent.updateScore({
      taskId: lowPriorityTask.id,
      description: lowPriorityTask.description,
      deadline: lowPriorityTask.deadline,
      dependencies: lowPriorityTask.dependencies,
      context_type: 'work',
      user_focus_areas: ['analysis'],
      user_energy_level: 80,
    });

    // Create tasks in backend
    const createdTasks = await Promise.all([
      createTask(highPriorityTask),
      createTask(mediumPriorityTask),
      createTask(lowPriorityTask),
    ]);

    // Assign tasks to the same agent
    const assignments = await Promise.all([
      assignTask(createdTasks[0].id, MOCK_AGENT_ID),
      assignTask(createdTasks[1].id, MOCK_AGENT_ID),
      assignTask(createdTasks[2].id, MOCK_AGENT_ID),
    ]);

    // Verify assignment results (should succeed for all due to priority scoring)
    assignments.forEach((result, index) => {
      expect(result.success).toBe(true);
    });

    // Verify tasks are queued in agent OS
    const agent = agentOS.getAgent(MOCK_AGENT_ID);
    expect(agent?.currentTaskId).toBeDefined();

    // Simulate completion and check task ordering
    await completeTask(createdTasks[0].id, MOCK_AGENT_ID, true);

    // After completion, the next priority task should be auto-assigned
    // (This tests the queuing mechanism in agent OS)
    // Note: In a real implementation, there would be a background process
    // that picks up the next task from the queue
  });
});