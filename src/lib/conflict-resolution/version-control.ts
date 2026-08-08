/**
 * Version Control for Conflict Resolution
 * Implements version tracking and last-write-wins strategy for concurrent edits
 */
import { v4 as uuidv4 } from 'uuid';

export interface VersionEntry {
  id: string;
  entityId: string;
  entityName: string;
  version: number;
  timestamp: number;
  author: string;
  changes: Record<string, any>;
  checksum: string;
}

export interface ConflictResolution {
  conflictId: string;
  entityId: string;
  strategy: 'last-write-wins' | 'merge-changes' | 'manual-resolution';
  winnerVersionId?: string;
  mergedChanges?: Record<string, any>;
  resolvedAt: number;
  resolvedBy: string;
  notes?: string;
}

class VersionControlSystem {
  private versions: Map<string, VersionEntry[]> = new Map();
  private resolutions: Map<string, ConflictResolution[]> = new Map();

  /**
   * Record a version change
   */
  recordVersion(
    entityId: string,
    entityName: string,
    changes: Record<string, any>,
    author: string = 'system'
  ): VersionEntry {
    const versionEntry: VersionEntry = {
      id: uuidv4(),
      entityId,
      entityName,
      version: this.getVersionCount(entityId) + 1,
      timestamp: Date.now(),
      author,
      changes,
      checksum: this.calculateChecksum(changes)
    };

    if (!this.versions.has(entityId)) {
      this.versions.set(entityId, []);
    }
    this.versions.get(entityId)!.push(versionEntry);
    return versionEntry;
  }

  /**
   * Get version history for an entity
   */
  getVersions(entityId: string): VersionEntry[] {
    return this.versions.get(entityId) || [];
  }

  /**
   * Check if a change would create a conflict
   */
  wouldConflict(entityId: string, baseVersionId: string): boolean {
    const versions = this.getVersions(entityId);
    if (versions.length === 0) return false;

    // Find the base version timestamp
    const baseVersion = versions.find(v => v.id === baseVersionId);
    if (!baseVersion) return false;

    // Check if any versions exist after the base version
    return versions.some(v => v.timestamp > baseVersion.timestamp);
  }

  /**
   * Resolve a conflict using last-write-wins strategy
   */
  resolveLastWriteWins(
    entityId: string,
    versionsToResolve: VersionEntry[],
    resolvedBy: string = 'system'
  ): ConflictResolution {
    // Sort by timestamp descending - latest wins
    const sortedVersions = [...versionsToResolve].sort((a, b) => b.timestamp - a.timestamp);
    const winner = sortedVersions[0];

    const resolution: ConflictResolution = {
      conflictId: uuidv4(),
      entityId,
      strategy: 'last-write-wins',
      winnerVersionId: winner?.id,
      resolvedAt: Date.now(),
      resolvedBy,
      notes: `Resolved using last-write-wins. Winning version: ${winner?.version} by ${winner?.author}`
    };

    if (!this.resolutions.has(entityId)) {
      this.resolutions.set(entityId, []);
    }
    this.resolutions.get(entityId)!.push(resolution);

    return resolution;
  }

  /**
   * Resolve a conflict by merging changes
   */
  resolveMerge(
    entityId: string,
    versionsToMerge: VersionEntry[],
    resolvedBy: string = 'system'
  ): ConflictResolution {
    // Simple merge strategy: later values take precedence for each key
    const mergedChanges = this.mergeChanges(versionsToMerge);

    const resolution: ConflictResolution = {
      conflictId: uuidv4(),
      entityId,
      strategy: 'merge-changes',
      mergedChanges,
      resolvedAt: Date.now(),
      resolvedBy,
      notes: `Resolved by merging ${versionsToMerge.length} versions`
    };

    if (!this.resolutions.has(entityId)) {
      this.resolutions.set(entityId, []);
    }
    this.resolutions.get(entityId)!.push(resolution);

    return resolution;
  }

  /**
   * Merge changes from multiple versions
   */
  private mergeChanges(versions: VersionEntry[]): Record<string, any> {
    // Sort by timestamp ascending to apply oldest first
    const sortedVersions = [...versions].sort((a, b) => a.timestamp - b.timestamp);
    const merged: Record<string, any> = {};

    for (const version of sortedVersions) {
      for (const [key, value] of Object.entries(version.changes)) {
        merged[key] = value;
      }
    }

    return merged;
  }

  /**
   * Calculate checksum for change verification
   */
  private calculateChecksum(data: Record<string, any>): string {
    const content = JSON.stringify(data, Object.keys(data).sort());
    // Simple checksum - in production, use crypto.subtle
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get resolution history for an entity
   */
  getResolutions(entityId: string): ConflictResolution[] {
    return this.resolutions.get(entityId) || [];
  }

  /**
   * Get count of versions for entity
   */
  private getVersionCount(entityId: string): number {
    return this.getVersions(entityId).length;
  }
}

export const versionControl = new VersionControlSystem();