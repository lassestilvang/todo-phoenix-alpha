/**
 * Agent Registry - Centralized management of micro-agents
 *
 * Responsibilities:
 * - Agent lifecycle (register, status, heartbeat)
 * - Agent capability discovery
 * - Workload distribution tracking
 */

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export interface AgentCapabilities {
  deep_work?: boolean;
  creative?: boolean;
  interrupt_handling?: boolean;
  context_sharing?: boolean;
  data_analysis?: boolean;
  [key: string]: boolean;
}

export interface AgentContext {
  agentId: string;
  currentPhase: 'idle' | 'deep_work' | 'interrupt_handling' | 'paused';
  focusLevel: number; // 0-100
  energyLevel: number; // 0-100
  currentTaskId?: string;
  availableSince: number; // timestamp
  lastHeartbeat: number;
  workField: string; // 'creative', 'analysis', 'coding', etc.
}

export interface AgentInfo {
  id: string;
  name: string;
  version: string;
  capabilities: AgentCapabilities;
  lastSeen: number;
  totalTasksCompleted: number;
  avgTaskDuration: number;
}

export type AgentStatus = 'online' | 'offline' | 'away' | 'busy';

export interface AgentRegistration {
  agentId?: string;
  name: string;
  capabilities: AgentCapabilities;
  workField: string;
}

/**
 * Agent Registry Store - Zustand-based state management
 */
export const useAgentRegistry = create<{
  agents: Map<string, AgentInfo>;
  contexts: Map<string, AgentContext>;
  registeredAgents: Map<string, AgentRegistration>;
  registerAgent: (registration: AgentRegistration) => void;
  updateContext: (agentId: string, contextUpdate: Partial<AgentContext>) => void;
  unregisterAgent: (agentId: string) => void;
  getAgent: (agentId: string) => AgentInfo | undefined;
  getContext: (agentId: string) => AgentContext | undefined;
  getAvailableAgents: (capabilities: Partial<AgentCapabilities>) => AgentInfo[];
  incrementTaskCount: (agentId: string) => void;
  resetTaskCount: (agentId: string) => void;
}>((set, get) => ({
  agents: new Map(),
  contexts: new Map(),
  registeredAgents: new Map(),

  registerAgent: (registration) => {
    const agentId = registration.agentId || uuidv4();
    const now = Date.now();

    const agentInfo: AgentInfo = {
      id: agentId,
      name: registration.name,
      version: '1.0.0',
      lastSeen: now,
      totalTasksCompleted: 0,
      avgTaskDuration: 0,
    };

    const registrationObj: AgentRegistration = {
      agentId,
      name: registration.name,
      capabilities: registration.capabilities,
      workField: registration.workField,
    };

    const defaultContext: AgentContext = {
      agentId,
      currentPhase: 'idle',
      focusLevel: 100,
      energyLevel: 100,
      availableSince: now,
      lastHeartbeat: now,
      workField: registration.workField,
    };

    set(state => ({
      agents: new Map(state.agents).set(agentId, agentInfo),
      contexts: new Map(state.contexts).set(agentId, defaultContext),
      registeredAgents: new Map(state.registeredAgents).set(agentId, registrationObj),
    }));

    return agentId;
  },

  updateContext: (agentId, contextUpdate) => {
    set(state => {
      const context = state.contexts.get(agentId);
      if (!context) return state;

      const updatedContext = {
        ...context,
        ...contextUpdate,
        lastHeartbeat: Date.now(),
      };

      return {
        contexts: new Map(state.contexts).set(agentId, updatedContext),
      };
    });
  },

  unregisterAgent: (agentId) => {
    set(state => {
      const newAgents = new Map(state.agents);
      const newContexts = new Map(state.contexts);
      const newRegistered = new Map(state.registeredAgents);

      newAgents.delete(agentId);
      newContexts.delete(agentId);
      newRegistered.delete(agentId);

      return { agents: newAgents, contexts: newContexts, registeredAgents: newRegistered };
    });
  },

  getAgent: (agentId) => {
    return get().agents.get(agentId);
  },

  getContext: (agentId) => {
    return get().contexts.get(agentId);
  },

  getAvailableAgents: (capabilities) => {
    const { agents } = get();
    return Array.from(agents.values()).filter(agent => {
      return Object.entries(capabilities).every(([key, value]) => {
        if (value === undefined) return true;
        return agent.capabilities[key as keyof AgentCapabilities] === value;
      });
    });
  },

  incrementTaskCount: (agentId) => {
    set(state => {
      const agent = state.agents.get(agentId);
      if (!agent) return state;

      return {
        agents: new Map(state.agents).set(agentId, {
          ...agent,
          totalTasksCompleted: agent.totalTasksCompleted + 1,
        }),
      };
    });
  },

  resetTaskCount: (agentId) => {
    set(state => {
      const agent = state.agents.get(agentId);
      if (!agent) return state;

      return {
        agents: new Map(state.agents).set(agentId, {
          ...agent,
          totalTasksCompleted: 0,
        }),
      };
    });
  },
}));