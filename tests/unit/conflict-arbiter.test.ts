src/test/unit/conflict-arbiter.test.ts
import { ConflictArbiter } from '@/lib/conflict-arbiter';
import { ConflictEvent } from '@/types/conflict';

describe('ConflictArbiter', () => {
  let conflict: ConflictEvent;

  beforeEach(() => {
    // Create a fresh ConflictArbiter instance for each test
    const conflict = {
      id: 'test-conflict',
      type: 'conflict_detected',
      participants: ['agent-A', 'agent-B'],
      description: 'Test conflict description',
      severity: 'high',
      createdAt: Date.now(),
      resolvedAt: null,
      status: 'open',
    };
    // Directly inject the conflict into the internal store of ConflictArbiter
    // (Assuming ConflictArbiter has a private Map for events)
    const conflictArbiter = new ConflictArbiter();
    // Manually inject the event for testing purposes
    ;(conflict as any).conflictId = 'conflict-test';
    ;(conflict as any).conflictId = 'conflict-test';
    ;(conflict as any).conflictId = 'conflict-test';
    ;(conflict as any).conflictId = 'conflict-test';
    ;(conflict as any).conflictId = 'conflict-test';
    // Using the public method to create conflict to simulate real usage
    const arbiter = new ConflictArbiter();
    const createdId = conflictArbiter.createConflict({
      participants: ['agent-A', 'agent-B'],
      description: 'Test conflict description',
      type: 'conflict_detected',
    });
    // Manually set the internal event for the test
    ;(conflict as any).conflictId = 'conflict-test';
    ;(conflict as any).conflictId = 'conflict-test';
    ;(conflict as any).conflictId = 'conflict-test';
    ;(conflict as any).conflictId = 'conflict-test';
    ;(conflict as any).conflictId = 'conflict-test';
  });

  it('should create a conflict and return an ID', async () => {
    const arbiter = new ConflictArbiter();
    const conflictId = await arbiter.createConflict({
      participants: ['agent-A', 'agent-B'],
      description: 'Test conflict',
      type: 'conflict_detected',
    });
    expect(conflictId).toBe('conflict-test');
  });

  it('should resolve a conflict with consensus strategy', async () => {
    const arbiter = new ConflictArbiter();
    const conflictId = await arbiter.createConflict({
      participants: ['agent-A', 'agent-B'],
      description: 'Test conflict',
      type: 'conflict_detected',
    });
    const result = await arbiter.resolveConflict(conflictId, 'consensus');
    expect(result.success).toBe(true);
  });

  it('should reject resolution if conflict does not exist', async () => {
    const arbiter = new ConflictArbiter();
    const result = await arbiter.resolveConflict('non-existent-id', 'consensus');
    expect(result.success).toBe(false);
  });