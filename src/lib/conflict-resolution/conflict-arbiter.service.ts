// Conflict Resolution Service

// Gateway for conflict resolution operations
// Acts as a thin wrapper around the ConflictArbiterImpl
// for easier usage in different contexts

import { ConflictArbiterImpl, ConflictEvent, ResolutionStrategy } from '../conflict-arbiter';
import { EventEmitter } from 'events';


export class ConflictArbiterService extends EventEmitter {
  private arbiter: ConflictArbiterImpl;

  constructor() {
    super();
    // Start the arbiter by default
    this.arbiter = new ConflictArbiterImpl();
    this.arbiter.start();
  }

  /**
   * Resolve a conflict by ID using a specified strategy
   *
   * @param conflictId - Conflict ID to resolve
   * @param strategy - Optional resolution strategy
   * @returns true if resolved successfully
   */
  resolveConflict(conflictId: string, strategy?: ResolutionStrategy): boolean {
    // Check if conflict exists
    const conflict = this.arbiter.getConflict(conflictId);
    if (!conflict) {
      this.emit('conflict-not-found', { id: conflictId });
      return false;
    }

    // Delegate to core arbiter with optional strategy
    const success = this.arbiter.resolveConflict(conflictId, strategy);

    // Emit event regardless of result to keep UI informed
    this.emit('conflict-resolved', {
      id: conflictId,
      success,
      strategy
    });

    return success;
  }

  /**
   * Retrieve all active conflicts
   */
  getActiveConflicts(): ConflictEvent[] {
    return this.arbiter.getActiveConflicts();
  }

  /**
   * Get resolution history
   */
  getResolutionHistory(limit?: number): ConflictEvent[] {
    return this.arbiter.getResolutionHistory(limit);
  }

  /**
   * Start/stop the arbiter
   */
  start() {
    this.arbiter.start();
  }

  stop() {
    this.arbiter.stop();
  }
}

export const conflictArbiterService = new ConflictArbiterService();