import { describe, it, expect, vi } from 'vitest';
import { ConflictArbiter } from '@/lib/conflict-arbiter';

describe('ConflictArbiter', () => {
  it('should create a conflict and return an ID', async () => {
    const arbiter = new ConflictArbiter();
    const conflictId = await arbiter.createConflict({
      participants: ['agent-A', 'agent-B'],
      description: 'Test conflict',
      type: 'TASK_LOCK_CONTENTION',
      priority: 5,
      severity: 'medium' as const,
      context: {
        taskId: 'test-task-123',
        timestamp: Date.now(),
      },
    });
    expect(typeof conflictId).toBe('string');
    expect(conflictId.length).toBeGreaterThan(0);
  });

  it('should resolve a conflict with lock winner strategy', async () => {
    const arbiter = new ConflictArbiter();
    const conflictId = await arbiter.createConflict({
      participants: ['agent-A', 'agent-B'],
      description: 'Test lock conflict',
      type: 'TASK_LOCK_CONTENTION',
      priority: 5,
      severity: 'medium' as const,
      context: {
        taskId: 'test-task-123',
        timestamp: Date.now(),
      },
    });
    const result = await arbiter.resolveConflict(conflictId, 'LOCK_WINNER');
    expect(result).toBe(true);
  });

  it('should resolve a conflict with consensus strategy', async () => {
    const arbiter = new ConflictArbiter();
    const conflictId = await arbiter.createConflict({
      participants: ['agent-A', 'agent-B'],
      description: 'Test consensus conflict',
      type: 'PHASE_TRANSITION_CONFLICT',
      priority: 5,
      severity: 'low' as const,
      context: {
        taskId: 'test-task-123',
        timestamp: Date.now(),
      },
    });
    const result = await arbiter.resolveConflict(conflictId, 'CONSENSUS');
    expect(typeof result).toBe('boolean');
  });

  it('should reject resolution if conflict does not exist', async () => {
    const arbiter = new ConflictArbiter();
    const result = await arbiter.resolveConflict('non-existent-id', 'CONSENSUS');
    expect(result).toBe(false);
  });

  it('should get active conflicts', () => {
    const arbiter = new ConflictArbiter();
    const initial = arbiter.getActiveConflicts();
    expect(Array.isArray(initial)).toBe(true);
    expect(initial.length).toBe(0);
  });

  it('should get resolution history', () => {
    const arbiter = new ConflictArbiter();
    const history = arbiter.getResolutionHistory();
    expect(Array.isArray(history)).toBe(true);
  });

  it('should get conflict by ID', async () => {
    const arbiter = new ConflictArbiter();
    const conflictId = await arbiter.createConflict({
      participants: ['agent-A', 'agent-B'],
      description: 'Test conflict',
      type: 'TASK_LOCK_CONTENTION',
      priority: 5,
      severity: 'medium' as const,
      context: {
        taskId: 'test-task-123',
        timestamp: Date.now(),
      },
    });

    const conflict = arbiter.getConflict(conflictId);
    expect(conflict).toBeDefined();
    expect(conflict?.id).toBe(conflictId);
    expect(conflict?.description).toBe('Test conflict');
  });

  it('should return undefined for non-existent conflict ID', () => {
    const arbiter = new ConflictArbiter();
    const conflict = arbiter.getConflict('non-existent-id');
    expect(conflict).toBeUndefined();
  });

  it('should resolve a conflict with context merge strategy', async () => {
    const arbiter = new ConflictArbiter();
    const conflictId = await arbiter.createConflict({
      participants: ['agent-A', 'agent-B'],
      description: 'Test merge conflict',
      type: 'CONTEXT_MERGE_CONFLICT',
      priority: 5,
      severity: 'medium' as const,
      context: {
        taskId: 'test-task-123',
        timestamp: Date.now(),
      },
    });
    const result = await arbiter.resolveConflict(conflictId, 'CONTEXT_MERGE');
    expect(result).toBe(true);
  });

  it('should resolve a conflict with priority escalation strategy', async () => {
    const arbiter = new ConflictArbiter();
    const conflictId = await arbiter.createConflict({
      participants: ['agent-A', 'agent-B'],
      description: 'Test priority conflict',
      type: 'PRIORITY_ESCALATION',
      priority: 5,
      severity: 'high' as const,
      context: {
        taskId: 'test-task-123',
        timestamp: Date.now(),
      },
    });
    const result = await arbiter.resolveConflict(conflictId, 'PRIORITY_ESCALATION');
    expect(typeof result).toBe('boolean');
  });

  it('should resolve a conflict with timestamp ordering strategy', async () => {
    const arbiter = new ConflictArbiter();
    const conflictId = await arbiter.createConflict({
      participants: ['agent-A', 'agent-B'],
      description: 'Test timestamp conflict',
      type: 'RESOURCE_CONTENTION',
      priority: 5,
      severity: 'low' as const,
      context: {
        taskId: 'test-task-123',
        timestamp: Date.now(),
      },
    });
    const result = await arbiter.resolveConflict(conflictId, 'TIMESTAMP_ORDERING');
    expect(result).toBe(true);
  });

  it('should resolve a conflict with external intervention strategy', async () => {
    const arbiter = new ConflictArbiter();
    const conflictId = await arbiter.createConflict({
      participants: ['agent-A', 'agent-B'],
      description: 'Test external conflict',
      type: 'DATA_INCONSISTENCY',
      priority: 5,
      severity: 'critical' as const,
      context: {
        taskId: 'test-task-123',
        timestamp: Date.now(),
      },
    });
    const result = await arbiter.resolveConflict(conflictId, 'EXTERNAL_INTERVENTION');
    expect(typeof result).toBe('boolean');
  });

  it('should return statistics', () => {
    const arbiter = new ConflictArbiter();
    const stats = arbiter.getStatistics();
    expect(stats).toHaveProperty('active_conflicts');
    expect(stats).toHaveProperty('resolved_conflicts');
    expect(stats).toHaveProperty('avg_resolution_time_ms');
    expect(stats).toHaveProperty('conflictTypes');
    expect(stats).toHaveProperty('resolutionStrategies');
    expect(stats.active_conflicts).toBe(0);
    expect(stats.resolved_conflicts).toBe(0);
  });

  it('should track resolution history after resolving a conflict', async () => {
    const arbiter = new ConflictArbiter();
    const conflictId = await arbiter.createConflict({
      participants: ['agent-A', 'agent-B'],
      description: 'Test tracking',
      type: 'TASK_LOCK_CONTENTION',
      priority: 5,
      severity: 'medium' as const,
      context: {
        taskId: 'test-task-123',
        timestamp: Date.now(),
      },
    });

    expect(arbiter.getResolutionHistory().length).toBe(0);

    await arbiter.resolveConflict(conflictId, 'LOCK_WINNER');

    const history = arbiter.getResolutionHistory();
    expect(history.length).toBe(1);
    expect(history[0].resolution).toBeDefined();
    expect(history[0].resolution?.strategy).toBe('LOCK_WINNER');
    expect(history[0].resolved_at).toBeDefined();
  });

  it('should remove conflict from active list after resolution', async () => {
    const arbiter = new ConflictArbiter();
    const conflictId = await arbiter.createConflict({
      participants: ['agent-A', 'agent-B'],
      description: 'Test removal',
      type: 'TASK_LOCK_CONTENTION',
      priority: 5,
      severity: 'medium' as const,
      context: {
        taskId: 'test-task-123',
        timestamp: Date.now(),
      },
    });

    expect(arbiter.getActiveConflicts().length).toBe(1);

    await arbiter.resolveConflict(conflictId, 'LOCK_WINNER');

    expect(arbiter.getActiveConflicts().length).toBe(0);
  });

  it('should resolve lock contention and pick a winner', async () => {
    const arbiter = new ConflictArbiter();
    const conflictId = await arbiter.createConflict({
      participants: ['agent-A', 'agent-B'],
      description: 'Test lock winner',
      type: 'TASK_LOCK_CONTENTION',
      priority: 5,
      severity: 'medium' as const,
      context: {
        taskId: 'test-task-123',
        timestamp: Date.now(),
      },
    });

    await arbiter.resolveConflict(conflictId, 'LOCK_WINNER');

    const history = arbiter.getResolutionHistory();
    expect(history[0].resolution?.winner).toBeDefined();
    expect(['agent-A', 'agent-B']).toContain(history[0].resolution?.winner);
  });
});