/**
 * AgentOS - The operational system for distributed micro-agents
 *
 * Core responsibilities:
 * - Agent lifecycle management (register, heartbeat, unregister)
 * - Distributed locking for concurrency control
 * - Context sharing across agents
 * - Workload distribution and priority ranking
 * - Conflict resolution for parallel edits
 */

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { createAgentDiscoveryCommand, AgentDiscoveryCommand } from './agent-protocols';
import { createWorkRequest, AgentWorkRequest } from './agent-protocols';
import { createStatusBroadcast, AgentStatusBroadcast } from './agent-protocols';
import { createCapabilityDelegation, DistrictsCapabilityDelegates } from './agent-protocols';

// Type definitions for the AgentOS ecosystem
export interface AgentCapabilityProfile {
  id: string;
  name: string;
  version: string;
  capabilities: {
    deep_work: boolean;
    creative: boolean;
    interrupt_handling: boolean;
    context_sharing: boolean;
    data_analysis: boolean;
    file_operations: boolean;
    api_integration: boolean;
    [key: string]: any;
  };
  specializations: string[];
  focus_depth: number; // 0-100
  energy_level: number; // 0-100
  current_workflow_id?: string;
  availability_score: number; // 0-100
}

export interface AgentWorkloadMetrics {
  active_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  avg_completion_time_ms: number;
  current_load_percentage: number;
  peak_load_percentage: number;
  task_spillage_rate: number;
}

export interface AgentConflictResolutionResult {
  resolved: boolean;
  resolution_method: 'lock_winner' | 'context_merge' | 'priority_escalation';
  winner_agent_id?: string;
  merged_context?: Partial<AgentContext>;
  conflicts_resolved: number;
}

export interface AgentCoordinationConfig {
  heartbeat_interval_ms: number;
  lock_timeout_ms: number;
  max_concurrent_tasks_per_agent: number;
  context_merge_tolerance: number;
  priority_decay_rate: number; // per minute without activity
  auto_unavailable_threshold_ms: number; // if no heartbeat for this long, mark as unavailable
}

// Core AgentOS Store
export type AgentOSState = {
  agents: Map<string, AgentCapabilityProfile>;
  workloads: Map<string, AgentWorkloadMetrics>;
  active_locks: Map<string, { agentId: string; acquiredAt: number; expiresAt: number }>;
  coordination_config: AgentCoordinationConfig;
  global_queue: AgentTaskQueue;
  phase_registry: Map<string, { phase: string; agents: Set<string>; priority: number }>;
};

export type AgentTask = {
  id: string;
  description: string;
  required_capabilities: string[];
  priority: number; // 1-10, higher = more urgent
  deadline?: Date;
  dependencies: string[]; // task IDs this depends on
  created_by: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed';
  created_at: number;
  started_at?: number;
  completed_at?: number;
};

export type AgentTaskQueue = {
  queue: Map<string, AgentTask>;
  enqueue: (task: AgentTask) => string;
  dequeue: (agentId: string, preferredCapabilities: string[]) => AgentTask | null;
  peek: (agentId: string, preferredCapabilities: string[]) => AgentTask | null;
  getPending: () => AgentTask[];
  markCompleted: (taskId: string, agentId: string) => void;
  markFailed: (taskId: string, agentId: string, error: string) => void;
};

export type AgentContext = {
  agentId: string;
  currentPhase: 'idle' | 'deep_work' | 'interrupt_handling' | 'paused' | 'conflict_resolution';
  focusLevel: number;
  energyLevel: number;
  currentTaskId?: string;
  availableSince: number;
  lastHeartbeat: number;
  workField: string;
  lastConflict?: {
    taskId: string;
    conflictType: 'lock_contention' | 'context_merge' | 'priority_ambiguity';
    resolved: boolean;
    resolution?: string;
    timestamp: number;
  };
};

// AgentOS Store with Zustand
export const useAgentOS = create<AgentOSState>((set, get) => ({
  agents: new Map(),
  workloads: new Map(),
  active_locks: new Map(),
  coordination_config: {
    heartbeat_interval_ms: 5000,
    lock_timeout_ms: 30000,
    max_concurrent_tasks_per_agent: 5,
    context_merge_tolerance: 0.8,
    priority_decay_rate: 0.01, // 1% per minute
    auto_unavailable_threshold_ms: 30000, // 30s without heartbeat
  },
  global_queue: {
    queue: new Map(),

    enqueue: (task: AgentTask) => {
      const queue = get().global_queue.queue;
      queue.set(task.id, task);
      return task.id;
    },

    dequeue: (agentId: string, preferredCapabilities: string[]) => {
      const tasks = Array.from(get().global_queue.queue.values());

      // Filter tasks by required capabilities
      const capableTasks = tasks.filter(task =>
        task.required_capabilities.every(cap =>
          preferredCapabilities.includes(cap)
        )
      );

      if (capableTasks.length === 0) return null;

      // Sort by priority (descending), then by deadline (earliest first)
      capableTasks.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return a.deadline.getTime() - b.deadline.getTime();
      });

      const task = capableTasks[0];
      if (task) {
        // Remove from queue
        get().global_queue.queue.delete(task.id);
      }
      return task || null;
    },

    peek: (agentId: string, preferredCapabilities: string[]) => {
      const tasks = Array.from(get().global_queue.queue.values());
      const capableTasks = tasks.filter(task =>
        task.required_capabilities.every(cap =>
          preferredCapabilities.includes(cap)
        )
      );

      if (capableTasks.length === 0) return null;
      capableTasks.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return a.deadline.getTime() - b.deadline.getTime();
      });
      return capableTasks[0] || null;
    },

    getPending: () => {
      return Array.from(get().global_queue.queue.values()).filter(
        task => task.status === 'pending'
      );
    },

    markCompleted: (taskId: string, agentId: string) => {
      const queue = get().global_queue.queue;
      if (queue.has(taskId)) {
        const task = queue.get(taskId)!;
        task.status = 'completed';
        task.completed_at = Date.now();
        // Update workload metrics
        get().updateWorkloadMetrics(agentId, true);
      }
    },

    markFailed: (taskId: string, agentId: string, error: string) => {
      const queue = get().global_queue.queue;
      if (queue.has(taskId)) {
        const task = queue.get(taskId)!;
        task.status = 'failed';
        task.completed_at = Date.now();
        // Update workload metrics with failure
        get().updateWorkloadMetrics(agentId, false, error);
      }
    },
  },

  phase_registry: new Map(),

  // Register a new agent
  registerAgent: (agentProfile: AgentCapabilityProfile) => {
    const agents = new Map(get().agents);
    const workloads = new Map(get().workloads);

    agents.set(agentProfile.id, agentProfile);
    workloads.set(agentProfile.id, {
      active_tasks: 0,
      completed_tasks: 0,
      failed_tasks: 0,
      avg_completion_time_ms: 0,
      current_load_percentage: 0,
      peak_load_percentage: 0,
      task_spillage_rate: 0,
    });

    set({ agents, workloads });
    return agentProfile.id;
  },

  // Update agent heartbeat and availability
  updateAgentHeartbeat: (agentId: string) => {
    set(state => {
      const agent = state.agents.get(agentId);
      if (!agent) return state;

      // Update availability based on recent activity
      const now = Date.now();
      const lastHeartbeat = now;

      // Apply priority decay if no activity for a while
      let availabilityScore = 100;
      const decayMinutes = (now - (agent.availableSince || now)) / 60000;
      if (decayMinutes > 0) {
        availabilityScore = Math.max(0, 100 - (decayMinutes * state.coordination_config.priority_decay_rate * 100));
      }

      return {
        agents: new Map(state.agents).set(agentId, {
          ...agent,
          availability_score: availabilityScore,
          lastHeartbeat,
        }),
      };
    });
  },

  // Acquire a distributed lock for a task
  acquireLock: (taskId: string, agentId: string): boolean => {
    const { active_locks, coordination_config } = get();
    const lockTimeout = coordination_config.lock_timeout_ms;

    // Check if task already has a lock
    if (active_locks.has(taskId)) {
      const existingLock = active_locks.get(taskId)!;
      // Check if existing lock is expired
      if (Date.now() < existingLock.expiresAt) {
        // Lock is still held, cannot acquire
        return false;
      } else {
        // Lock expired, remove it
        active_locks.delete(taskId);
      }
    }

    // Acquire new lock
    const expiresAt = Date.now() + lockTimeout;
    const newLock = {
      agentId,
      acquiredAt: Date.now(),
      expiresAt,
    };

    set(state => ({
      active_locks: new Map(state.active_locks).set(taskId, newLock),
    }));

    return true;
  },

  // Release a distributed lock
  releaseLock: (taskId: string) => {
    set(state => {
      const newLocks = new Map(state.active_locks);
      newLocks.delete(taskId);
      return { active_locks: newLocks };
    });
  },

  // Check if a lock is held for a task
  isLocked: (taskId: string): boolean => {
    return get().active_locks.has(taskId);
  },

  // Update workload metrics for an agent
  updateWorkloadMetrics: (agentId: string, success: boolean, error?: string) => {
    const workloads = new Map(get().workloads);
    const agent = get().agents.get(agentId);

    if (!workloads.has(agentId) || !agent) return;

    const current = workloads.get(agentId)!;
    const now = Date.now();

    let updated: AgentWorkloadMetrics;

    if (success) {
      updated = {
        ...current,
        active_tasks: Math.max(0, current.active_tasks - 1),
        completed_tasks: current.completed_tasks + 1,
        avg_completion_time_ms:
          current.avg_completion_time_ms
            ? (current.avg_completion_time_ms + (now - (current.lastCompletion || now))) / 2
            : (now - (current.lastStart || now)),
        current_load_percentage: Math.max(0, Math.min(100, current.current_load_percentage - 10)),
        peak_load_percentage: Math.max(current.peak_load_percentage, current.current_load_percentage),
        task_spillage_rate: Math.max(0, current.task_spillage_rate - 0.01),
      };
    } else {
      updated = {
        ...current,
        active_tasks: current.active_tasks + 1,
        failed_tasks: (current.failed_tasks || 0) + 1,
        current_load_percentage: Math.min(100, current.current_load_percentage + 15),
        peak_load_percentage: Math.max(current.peak_load_percentage, current.current_load_percentage + 15),
        task_spillage_rate: Math.min(1, (current.task_spillage_rate || 0) + 0.05),
      };
    }

    // Store last completion/start timestamps for calculations
    if (success) {
      ;(updated as any).lastCompletion = now;
    } else {
      ;(updated as any).lastFailure = now;
    }

    workloads.set(agentId, updated);
    set({ workloads });
  },

  // Assign a task to an agent based on capabilities, availability, and context
  assignTask: (task: AgentTask, agentId: string): { success: boolean; assignedAgentId?: string } => {
    const agent = get().agents.get(agentId);
    if (!agent) return { success: false };

    // Check capability match
    const capabilityMatch = task.required_capabilities.every(cap =>
      agent.capabilities[cap as keyof AgentCapabilityProfile] === true
    );

    if (!capabilityMatch) return { success: false };

    // Check if agent has capacity
    const workload = get().workloads.get(agentId);
    if (!workload) return { success: false };

    if (workload.active_tasks >= get().coordination_config.max_concurrent_tasks_per_agent) {
      return { success: false };
    }

    // Get current environment context
    const env = useEnvironmentAgent();
    const currentContext = env.getCurrentContext();
    const context = currentContext.context;

    // Check if task requires specific context
    if (task.required_context && !task.required_context.includes(context)) {
      return { success: false }; // Context mismatch
    }

    // Get environment context from the environment agent
    try {
      const { getCurrentContext: getEnvContext } = useEnvironmentAgent.getState();
      const envContext = getEnvContext();
      const currentPhase = envContext.context;

      // Check if the task aligns with current phase
      if (currentPhase === 'meeting' && task.priority < 5) {
        return { success: false }; // Low priority tasks during meetings
      }

      // Adjust priority based on context
      const contextAdjustedPriority = task.priority;
      // In a real implementation, we would use the context-adjusted priority
    } catch (error) {
      // If environment agent fails, continue with default logic
    }

    // Acquire lock for this task
    const lockAcquired = get().acquireLock(task.id, agentId);
    if (!lockAcquired) return { success: false };

    // Update agent state
    set(state => {
      const agents = new Map(state.agents);
      const workloads = new Map(state.workloads);

      agents.get(agentId)!.currentTaskId = task.id;
      agents.get(agentId)!.currentPhase = 'in_progress';
      agents.get(agentId)!.focusLevel = 100;
      agents.get(agentId)!.energyLevel = Math.max(0, agents.get(agentId)!.energyLevel - 10);
      workloads.get(agentId)!.active_tasks = (workloads.get(agentId)!.active_tasks || 0) + 1;

      return { agents, workloads };
    });

    return { success: true, assignedAgentId: agentId };
  },

  // Complete a task assignment
  completeTask: (taskId: string, agentId: string) => {
    const { assignTask, completeTask: completeTaskInternal, releaseLock } = get();

    // Release the lock
    get().releaseLock(taskId);

    // Update workload metrics (success)
    get().updateWorkloadMetrics(agentId, true);

    // Mark task as completed in queue
    get().global_queue.markCompleted(taskId, agentId);

    // Update agent state
    set(state => {
      const agents = new Map(state.agents);
      const workloads = new Map(state.workloads);

      const agent = agents.get(agentId);
      if (agent) {
        agent.currentTaskId = undefined;
        agent.currentPhase = 'idle';
        agent.focusLevel = 100;
        agent.energyLevel = Math.min(100, agent.energyLevel + 20);
      }
      workloads.get(agentId)!.active_tasks = Math.max(0, (workloads.get(agentId)!.active_tasks || 0) - 1);

      return { agents, workloads };
    });
  },

  // Get available agents matching capabilities
  getAvailableAgents: (requiredCapabilities: string[], minAvailability = 50) => {
    const agents = get().agents;
    return Array.from(agents.values()).filter(agent => {
      // Check capability match
      const capMatch = requiredCapabilities.every(cap =>
        agent.capabilities[cap as keyof AgentCapabilityProfile] === true
      );

      // Check availability
      const available = agent.availability_score >= minAvailability;

      // Check workload capacity
      const workload = get().workloads.get(agent.id);
      const hasCapacity = !workload || workload.active_tasks < get().coordination_config.max_concurrent_tasks_per_agent;

      return capMatch && available && hasCapacity;
    });
  },

  // Register a phase for priority routing
  registerPhase: (phase: string, agents: Set<string>, priority: number) => {
    const phaseRegistry = new Map(get().phase_registry);
    phaseRegistry.set(phase, { phase, agents, priority });
    set({ phase_registry: phaseRegistry });
  },

  // Get agents in a specific phase
  getAgentsInPhase: (phase: string) => {
    const phaseEntry = get().phase_registry.get(phase);
    return phaseEntry?.agents || new Set();
  },

  // Priority-based task routing
  routeTask: (task: AgentTask): string | null => {
    // First, try agents in high-priority phases
    const highPriorityPhases = Array.from(get().phase_registry.values())
      .filter(p => p.priority >= 8)
      .map(p => p.phase);

    for (const phase of highPriorityPhases) {
      const agents = get().getAgentsInPhase(phase);
      if (agents.size > 0) {
        const matchingAgent = Array.from(agents).find(agentId => {
          const agent = get().agents.get(agentId);
          if (!agent) return false;
          const capMatch = task.required_capabilities.every(cap =>
            agent.capabilities[cap as keyof AgentCapabilityProfile] === true
          );
          return capMatch;
        });
        if (matchingAgent) return matchingAgent;
      }
    }

    // Fall back to available agents
    const available = get().getAvailableAgents(task.required_capabilities);
    if (available.length > 0) {
      // Sort by availability score, then by workload
      available.sort((a, b) => {
        const aAvail = a.availability_score;
        const bAvail = b.availability_score;
        if (aAvail !== bAvail) return bAvail - aAvail; // Higher availability first

        const aWorkload = get().workloads.get(a.id)?.active_tasks || 0;
        const bWorkload = get().workloads.get(b.id)?.active_tasks || 0;
        return aWorkload - bWorkload; // Lower workload first
      });

      return available[0].id;
    }

    return null;
  },
}));