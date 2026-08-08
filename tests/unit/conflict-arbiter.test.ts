import { describe, it, expect, vi } from 'vitest';
import { ConflictArbiter } from '@/lib/conflict-arbiter';

describe('ConflictArbiter', () => {
  it('should create a conflict and return an ID', async () => {
    const arbiter = new ConflictArbiter();
    const conflictId = await arbiter.createConflict({
      participants: ['agent-A', 'agent-B'],
      description: 'Test conflict',
      type: 'TASK_LOCK_CONTENTION',
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
    });
    const result = await arbiter.resolveConflict(conflictId, 'consensus');
    expect(typeof result).toBe('boolean');
  });

  it('should reject resolution if conflict does not exist', async () => {
    const arbiter = new ConflictArbiter();
    const result = await arbiter.resolveConflict('non-existent-id', 'consensus');
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
});