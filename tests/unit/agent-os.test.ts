import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAgentOS } from '@/lib/agent-os';
import { AgentCapabilityProfile } from '@/lib/agent-os';

describe('AgentOS', () => {
  beforeEach(() => {
    // Reset the store before each test
    const agentOS = useAgentOS.getState();
    agentOS.agents.clear();
    agentOS.workloads.clear();
    agentOS.active_locks.clear();
    agentOS.global_queue.queue.clear();
    agentOS.phase_registry.clear();
  });

  it('should register an agent correctly', () => {
    const agentOS = useAgentOS.getState();
    const profile: AgentCapabilityProfile = {
      id: 'test-agent-1',
      name: 'Test Agent',
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
      energy_level: 90,
      availability_score: 85,
    };

    const agentId = agentOS.registerAgent(profile);
    expect(agentId).toBe('test-agent-1');
    expect(agentOS.agents.has(agentId)).toBe(true);
    expect(agentOS.agents.get(agentId)?.name).toBe('Test Agent');
    expect(agentOS.workloads.has(agentId)).toBe(true);
  });

  it('should update agent heartbeat and availability', () => {
    const agentOS = useAgentOS.getState();
    const profile: AgentCapabilityProfile = {
      id: 'test-agent-2',
      name: 'Test Agent 2',
      version: '1.0.0',
      capabilities: {
        deep_work: true,
        creative: true,
        interrupt_handling: false,
        context_sharing: true,
        data_analysis: false,
        file_operations: true,
        api_integration: false,
      },
      specializations: ['creative'],
      focus_depth: 70,
      energy_level: 60,
      availability_score: 75,
    };

    const agentId = agentOS.registerAgent(profile);
    const initialContext = agentOS.getContext(agentId);
    expect(initialContext).toBeDefined();
    expect(initialContext?.focusLevel).toBe(100);
    expect(initialContext?.energyLevel).toBe(100);

    // Update context to simulate work
    agentOS.updateContext(agentId, {
      currentPhase: 'deep_work',
      focusLevel: 30,
      energyLevel: 40,
      availableSince: Date.now() - 300000, // 5 minutes ago
    });

    const updatedContext = agentOS.getContext(agentId);
    expect(updatedContext?.currentPhase).toBe('deep_work');
    expect(updatedContext?.focusLevel).toBe(30);
    expect(updatedContext?.energyLevel).toBe(40);
  });

  it('should acquire and release locks', () => {
    const agentOS = useAgentOS.getState();
    const profile: AgentCapabilityProfile = {
      id: 'test-agent-3',
      name: 'Test Agent 3',
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
      focus_depth: 75,
      energy_level: 75,
      availability_score: 80,
    };

    const agentId = agentOS.registerAgent(profile);
    const taskId = 'test-task-1';

    // Initially no lock
    expect(agentOS.isLocked(taskId)).toBe(false);

    // Acquire lock
    const lockAcquired = agentOS.acquireLock(taskId, agentId);
    expect(lockAcquired).toBe(true);
    expect(agentOS.isLocked(taskId)).toBe(true);

    // Try to acquire lock again by same agent (should still work - reentrant?)
    const lockAcquiredAgain = agentOS.acquireLock(taskId, agentId);
    expect(lockAcquiredAgain).toBe(true); // Depending on implementation

    // Release lock
    agentOS.releaseLock(taskId);
    expect(agentOS.isLocked(taskId)).toBe(false);

    // Another agent should be able to acquire now
    const profile2: AgentCapabilityProfile = {
      id: 'test-agent-4',
      name: 'Test Agent 4',
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
      focus_depth: 75,
      energy_level: 75,
      availability_score: 80,
    };
    const agentId2 = agentOS.registerAgent(profile2);
    const lockAcquiredByOther = agentOS.acquireLock(taskId, agentId2);
    expect(lockAcquiredByOther).toBe(true);
  });

  it('should assign tasks based on capabilities and availability', () => {
    const agentOS = useAgentOS.getState();

    // Create agent with specific capabilities
    const agentProfile: AgentCapabilityProfile = {
      id: 'capable-agent',
      name: 'Capable Agent',
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
    };

    const agentId = agentOS.registerAgent(agentProfile);

    // Create a task requiring specific capabilities
    const task = {
      id: 'test-task-2',
      description: 'Test task requiring data analysis',
      required_capabilities: ['data_analysis', 'api_integration'],
      priority: 5,
      dependencies: [],
      created_by: 'test',
      status: 'pending',
      created_at: Date.now(),
    };

    // Should be able to assign
    const result = agentOS.assignTask(task, agentId);
    expect(result.success).toBe(true);
    expect(result.assignedAgentId).toBe(agentId);

    // Check that agent state updated
    const agentContext = agentOS.getContext(agentId);
    expect(agentContext?.currentTaskId).toBe(task.id);
    expect(agentContext?.currentPhase).toBe('in_progress');

    // Check workload updated
    const workload = agentOS.workloads.get(agentId);
    expect(workload?.active_tasks).toBe(1);

    // Try to assign a task requiring capabilities the agent doesn't have
    const task2 = {
      id: 'test-task-3',
      description: 'Task requiring creative work',
      required_capabilities: ['creative'],
      priority: 5,
      dependencies: [],
      created_by: 'test',
      status: 'pending',
      created_at: Date.now(),
    };

    const result2 = agentOS.assignTask(task2, agentId);
    expect(result2.success).toBe(false); // Should fail due to missing capability
  });
});