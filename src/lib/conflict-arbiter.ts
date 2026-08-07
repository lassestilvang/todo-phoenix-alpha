/**
 * Conflict Arbiter - Distributed conflict resolution system for agents
 *
 * Core Responsibilities:
 * - Detect and resolve conflicting agent actions
 * - Implement distributed locking with priority-based resolution
 * - Context merging for parallel edits
 * - Escalation mechanisms for unresolved conflicts
 */

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { AgentCapabilityProfile } from './agent-os';

export type ConflictType =
  | 'TASK_LOCK_CONTENTION'
  | 'CONTEXT_MERGE_CONFLICT'
  | 'PRIORITY_ESCALATION'
  | 'RESOURCE_CONTENTION'
  | 'PHASE_TRANSITION_CONFLICT'
  | 'DATA_INCONSISTENCY'
  | 'DEADLINE_CONFLICT';

export type ResolutionStrategy =
  | 'LOCK_WINNER'
  | 'CONTEXT_MERGE'
  | 'PRIORITY_ESCALATION'
  | 'TIMESTAMP_ORDERING'
  | 'CONSENSUS'
  | 'EXTERNAL_INTERVENTION';

export interface ConflictEvent {
  id: string;
  type: ConflictType;
  participants: string[]; // agent IDs involved
  description: string;
  context: {
    taskId?: string;
    resourceId?: string;
    phase?: string;
    timestamp: number;
    metadata?: Record<string, any>;
  };
  priority: number; // 1-10, higher = more urgent
  severity: 'low' | 'medium' | 'high' | 'critical';
  detected_at: number;
  resolved_at?: number;
  resolved_by?: string;
  resolution?: {
    strategy: ResolutionStrategy;
    outcome: 'success' | 'partial' | 'failure';
    details?: any;
    winner?: string; // for lock_winner strategy
    merged_data?: any; // for context_merge strategy
  };
}

export interface ConflictArbiterConfig {
  detection_interval_ms: number;
  resolution_timeout_ms: number;
  escalation_threshold_ms: number;
  max_concurrent_conflicts: number;
  consensus_threshold: number; // percentage of agents needed to agree
}

const defaultConfig: ConflictArbiterConfig = {
  detection_interval_ms: 10000, // 10 seconds
  resolution_timeout_ms: 60000, // 1 minute
  escalation_threshold_ms: 300000, // 5 minutes
  max_concurrent_conflicts: 50,
  consensus_threshold: 0.6, // 60%
};

export interface ConflictArbiterState {
  active_conflicts: Map<string, ConflictEvent>;
  resolution_history: ConflictEvent[];
  config: ConflictArbiterConfig;
  is_running: boolean;
  detection_interval?: NodeJS.Timeout;
  listeners: EventEmitter;
}

class ConflictArbiterImpl {
  private state: ConflictArbiterState = {
    active_conflicts: new Map(),
    resolution_history: [],
    config: defaultConfig,
    is_running: false,
    detection_interval: undefined,
    listeners: new EventEmitter(),
  };

  /**
   * Start the conflict arbiter
   */
  start(): void {
    if (this.state.is_running) return;
    this.state.is_running = true;

    // Start periodic detection
    this.state.detection_interval = setInterval(() => {
      if (this.state.is_running) {
        this.detectConflicts();
      }
    }, this.state.config.detection_interval_ms);

    // Setup event listeners
    this.setupEventListeners();
  }

  /**
   * Stop the conflict arbiter
   */
  stop(): void {
    this.state.is_running = false;
    if (this.state.detection_interval) {
      clearInterval(this.state.detection_interval);
      this.state.detection_interval = undefined;
    }
    this.state.listeners.removeAllListeners();
  }

  /**
   * Report a potential conflict
   */
  reportConflict(conflict: Omit<ConflictEvent, 'id' | 'detected_at'>): string {
    const conflictId = uuidv4();
    const fullConflict: ConflictEvent = {
      ...conflict,
      id: conflictId,
      detected_at: Date.now(),
    };

    this.state.active_conflicts.set(conflictId, fullConflict);
    this.emit('conflict_detected', fullConflict);

    return conflictId;
  }

  /**
   * Detect conflicts from agent states
   */
  private detectConflicts(): void {
    // This would typically query the agent OS for current states
    // For now, we'll implement a basic version that can be extended
    // In practice, this would integrate with the AgentOS and backchannel
  }

  /**
   * Resolve a conflict using the appropriate strategy
   */
  resolveConflict(conflictId: string, strategy?: ResolutionStrategy): boolean {
    const conflict = this.state.active_conflicts.get(conflictId);
    if (!conflict) return false;

    // Determine resolution strategy if not provided
    const resolutionStrategy = strategy || this.determineResolutionStrategy(conflict);

    let success = false;
    let outcome: 'success' | 'partial' | 'failure' = 'failure';
    let details: any = null;
    let winner: string | undefined;
    let mergedData: any = undefined;

    switch (resolutionStrategy) {
      case 'LOCK_WINNER':
        ({ success, outcome, winner } = this.resolveLockContention(conflict));
        break;
      case 'CONTEXT_MERGE':
        ({ success, outcome, mergedData } = this.resolveContextMerge(conflict));
        break;
      case 'PRIORITY_ESCALATION':
        ({ success, outcome } = this.resolvePriorityEscalation(conflict));
        break;
      case 'TIMESTAMP_ORDERING':
        ({ success, outcome } = this.resolveTimestampOrdering(conflict));
        break;
      case 'CONSENSUS':
        ({ success, outcome } = this.resolveConsensus(conflict));
        break;
      case 'EXTERNAL_INTERVENTION':
        ({ success, outcome } = this.resolveExternalIntervention(conflict));
        break;
    }

    // Update conflict with resolution
    const resolvedConflict: ConflictEvent = {
      ...conflict,
      resolved_at: Date.now(),
      resolution: {
        strategy: resolutionStrategy,
        outcome,
        details,
        winner,
        merged_data: mergedData,
      },
    };

    this.state.active_conflicts.delete(conflictId);
    this.state.resolution_history.push(resolvedConflict);

    // Keep history manageable
    if (this.state.resolution_history.length > 1000) {
      this.state.resolution_history = this.state.resolution_history.slice(-500);
    }

    this.emit('conflict_resolved', resolvedConflict);
    return success;
  }

  /**
   * Determine the best resolution strategy for a conflict
   */
  private determineResolutionStrategy(conflict: ConflictEvent): ResolutionStrategy {
    switch (conflict.type) {
      case 'TASK_LOCK_CONTENTION':
        return 'LOCK_WINNER';
      case 'CONTEXT_MERGE_CONFLICT':
        return 'CONTEXT_MERGE';
      case 'PRIORITY_ESCALATION':
        return 'PRIORITY_ESCALATION';
      case 'RESOURCE_CONTENTION':
        return 'TIMESTAMP_ORDERING';
      case 'PHASE_TRANSITION_CONFLICT':
        return 'CONSENSUS';
      case 'DATA_INCONSISTENCY':
        return 'CONTEXT_MERGE';
      case 'DEADLINE_CONFLICT':
        return 'PRIORITY_ESCALATION';
      default:
        return 'EXTERNAL_INTERVENTION';
    }
  }

  /**
   * Resolve lock contention using priority-based approach
   */
  private resolveLockContention(conflict: ConflictEvent): {
    success: boolean;
    outcome: 'success' | 'partial' | 'failure';
    winner?: string;
  } {
    // For lock contention, we look at the agents' priorities and availability
    const participants = conflict.participants;
    if (participants.length < 2) {
      return { success: false, outcome: 'failure' };
    }

    // Get agent profiles (would come from AgentOS in practice)
    const agentPriorities: { agentId: string; priority: number }[] = participants.map(agentId => {
      // In reality, this would fetch from AgentOS
      // For simulation, we'll use a hash-based priority
      let hash = 0;
      for (let i = 0; i < agentId.length; i++) {
        hash = agentId.charCodeAt(i) + ((hash << 5) - hash);
      }
      const priority = Math.abs(hash) % 100;
      return { agentId, priority };
    });

    // Sort by priority (highest first)
    agentPriorities.sort((a, b) => b.priority - a.priority);
    const winner = agentPriorities[0].agentId;

    return {
      success: true,
      outcome: 'success',
      winner,
    };
  }

  /**
   * Resolve context merge conflict by combining contexts
   */
  private resolveContextMerge(conflict: ConflictEvent): {
    success: boolean;
    outcome: 'success' | 'partial' | 'failure';
    mergedData?: any;
  } {
    // Context merging - combine data from all participants
    // This is a simplified version - real implementation would depend on data types
    const participants = conflict.participants;

    // Simulate merging context data
    const mergedData = {
      merged_from: participants,
      merge_timestamp: Date.now(),
      data_sources: participants.map(id => ({ agentId: id, timestamp: Date.now() })),
      strategy: 'weighted_average', // or could be 'concatenate', 'override_latest', etc.
    };

    return {
      success: true,
      outcome: participants.length > 0 ? 'success' : 'failure',
      mergedData,
    };
  }

  /**
   * Resolve by escalating to higher priority authority
   */
  private resolvePriorityEscalation(conflict: ConflictEvent): {
    success: boolean;
    outcome: 'success' | 'partial' | 'failure';
  } {
    // Priority escalation - look for agents with authority to decide
    // For now, we'll simulate by checking if any participant has high priority
    const hasHighPriorityAgent = conflict.participants.some(id => {
      // Simulate priority check
      return Math.random() > 0.7; // 30% chance of having authority
    });

    return {
      success: hasHighPriorityAgent,
      outcome: hasHighPriorityAgent ? 'success' : 'failure',
    };
  }

  /**
   * Resolve using timestamp ordering (last write wins)
   */
  private resolveTimestampOrdering(conflict: ConflictEvent): {
    success: boolean;
    outcome: 'success' | 'partial' | 'failure';
  } {
    // Timestamp ordering - most recent action wins
    // In a real system, each action would have a timestamp
    // We'll simulate by using the conflict detection time
    return {
      success: true,
      outcome: 'success',
    };
  }

  /**
   * Resolve using consensus among participants
   */
  private resolveConsensus(conflict: ConflictEvent): {
    success: boolean;
    outcome: 'success' | 'partial' | 'failure';
  } {
    // Consensus - need agreement from majority of participants
    const participantCount = conflict.participants.length;
    if (participantCount === 0) return { success: false, outcome: 'failure' };

    // For simulation, assume we can get consensus if > threshold% agree
    const requiredAgreement = Math.ceil(participantCount * this.state.config.consensus_threshold);
    const agreeingParticipants = Math.floor(Math.random() * participantCount); // Simulate agreement

    const success = agreeingParticipants >= requiredAgreement;
    return {
      success,
      outcome: success ? 'success' : 'partial',
    };
  }

  /**
   * Resolve by requiring external intervention
   */
  private resolveExternalIntervention(conflict: ConflictEvent): {
    success: boolean;
    outcome: 'success' | 'partial' | 'failure';
  } {
    // External intervention - requires human or system administrator
    // For now, we'll simulate as partially successful
    return {
      success: Math.random() > 0.5,
      outcome: Math.random() > 0.3 ? 'partial' : 'failure',
    };
  }

  /**
   * Get active conflicts
   */
  getActiveConflicts(): ConflictEvent[] {
    return Array.from(this.state.active_conflicts.values());
  }

  /**
   * Get conflict by ID
   */
  getConflict(id: string): ConflictEvent | undefined {
    return this.state.active_conflicts.get(id);
  }

  /**
   * Get resolution history
   */
  getResolutionHistory(limit?: number): ConflictEvent[] {
    return this.state.resolution_history.slice(-(limit || 50));
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen for conflict reports from other systems
    this.state.listeners.on('report_conflict', (conflict: Omit<ConflictEvent, 'id' | 'detected_at'>) => {
      this.reportConflict(conflict);
    });

    // Listen for manual resolution requests
    this.state.listeners.on('resolve_conflict', (data: { conflictId: string; strategy?: ResolutionStrategy }) => {
      this.resolveConflict(data.conflictId, data.strategy);
    });
  }

  /**
   * Emit event
   */
  emit(event: string, data?: any): void {
    this.state.listeners.emit(event, data);
  }

  /**
   * Get arbiter statistics
   */
  getStatistics(): {
    active_conflicts: number;
    resolved_conflicts: number;
    avg_resolution_time_ms: number;
    conflict_types: Record<string, number>;
    resolution_strategies: Record<string, number>;
  } {
    const active = this.state.active_conflicts.size;
    const resolved = this.state.resolution_history.length;
    const resolvedWithTime = this.state.resolution_history.filter(c => c.resolved_at && c.detected_at);
    const avgTime = resolvedWithTime.length > 0
      ? resolvedWithTime.reduce((sum, c) => sum + (c.resolved_at! - c.detected_at), 0) / resolvedWithTime.length
      : 0;

    const conflictTypes: Record<string, number> = {};
    this.state.active_conflicts.forEach(c => {
      conflictTypes[c.type] = (conflictTypes[c.type] || 0) + 1;
    });

    const resolutionStrategies: Record<string, number> = {};
    this.state.resolution_history.forEach(c => {
      if (c.resolution) {
        resolutionStrategies[c.resolution.strategy] = (resolutionStrategies[c.resolution.strategy] || 0) + 1;
      }
    });

    return {
      active_conflicts: active,
      resolved_conflicts: resolved,
      avg_resolution_time_ms: avgTime,
      conflict_types,
      resolution_strategies,
    };
  }
}

// Export singleton instance
let conflictArbiter: ConflictArbiterImpl | null = null;

export function getConflictArbiter(): ConflictArbiterImpl {
  if (!conflictArbiter) {
    conflictArbiter = new ConflictArbiterImpl();
  }
  return conflictArbiter;
}

export function createConflictArbiter(): ConflictArbiterImpl {
  return new ConflictArbiterImpl();
}

export { ConflictArbiterImpl };
export type {
  ConflictEvent,
  ConflictType,
  ResolutionStrategy,
  ConflictArbiterConfig,
  ConflictArbiterState,
};