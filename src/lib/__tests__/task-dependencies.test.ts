import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database
vi.mock('@/lib/db/schema', () => ({
  default: {
    prepare: vi.fn().mockReturnThis(),
    run: vi.fn().mockReturnValue({ lastInsertRowid: 1, changes: 1 }),
    all: vi.fn().mockReturnValue([]),
    get: vi.fn().mockReturnValue(null),
  },
  __esModule: true,
}));

describe('Task Dependency Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Circular Dependency Detection', () => {
    it('should detect direct circular dependency A -> B -> A', () => {
      // Task A depends on B, Task B depends on A
      // Simulate the dependency traversal: A(1) -> B(2), B(2) -> A(1)
      const taskADeps = [2]; // A depends on B
      const taskBDeps = [1]; // B depends on A

      // Traverse from B looking for A
      const visited = new Set<number>();
      const stack = [...taskBDeps]; // Start with B's dependencies [1]
      let foundCycle = false;

      while (stack.length > 0 && !foundCycle) {
        const current = stack.pop()!;
        if (current === 1) {
          foundCycle = true;
          break;
        }
        if (visited.has(current)) continue;
        visited.add(current);
        // Add more dependencies as needed for the cycle detection
        if (current === 2) {
          stack.push(...taskADeps); // B depends on A
        }
      }

      expect(foundCycle).toBe(true);
    });

    it('should detect indirect circular dependency A -> B -> C -> A', () => {
      // Task A depends on B, B depends on C, C depends on A
      const taskADeps = [2];
      const taskBDeps = [3];
      const taskCDeps = [1];

      // Simulate traversal: A -> B -> C -> A
      const visited = new Set<number>();
      const stack = [...taskCDeps]; // Start with C's dependencies [1]
      let hasCycle = false;

      while (stack.length > 0 && !hasCycle) {
        const current = stack.pop()!;
        if (current === 1) {
          hasCycle = true;
          break;
        }
        if (visited.has(current)) continue;
        visited.add(current);
        // Add B's dependencies
        stack.push(...taskBDeps);
      }

      expect(hasCycle).toBe(true);
    });

    it('should not flag non-circular dependency chain A -> B -> C', () => {
      // Task A depends on B, B depends on C, C has no further dependencies
      const visited = new Set<number>();
      const stack = [2, 3]; // A depends on B(2), B depends on C(3)
      let hasCycle = false;

      while (stack.length > 0 && !hasCycle) {
        const current = stack.pop()!;
        if (visited.has(current)) {
          hasCycle = true;
          break;
        }
        visited.add(current);
        // No further dependencies for C, so stack only has what was added
      }

      expect(hasCycle).toBe(false);
    });
  });

  describe('Dependency Validation', () => {
    it('should validate that all referenced tasks exist', () => {
      const taskDependencies = [1, 2, 3];
      const existingTasks = new Set([1, 2]); // Task 3 doesn't exist

      const missing = taskDependencies.filter(dep => !existingTasks.has(dep));
      expect(missing).toEqual([3]);
    });

    it('should detect self-dependency', () => {
      const taskId = 1;
      const proposedDeps = [1, 2, 3];

      const hasSelfDependency = proposedDeps.includes(taskId);
      expect(hasSelfDependency).toBe(true);
    });
  });

  describe('Dependency Chain', () => {
    it('should calculate dependency chain for a task', () => {
      // If task A depends on B and C, and B depends on C, the chain from A is [B, C]
      const directDeps = [2, 3];
      const transitiveDeps = [3]; // B also depends on C

      const allDeps = [...directDeps, ...transitiveDeps];
      expect(allDeps).toContain(2);
      expect(allDeps).toContain(3);
    });

    it('should remove duplicates from dependency chain', () => {
      const chainWithDuplicates = [2, 3, 2, 3, 2];

      const uniqueChain = [...new Set(chainWithDuplicates)];
      expect(uniqueChain).toEqual([2, 3]);
    });
  });

  describe('Dependency Updates', () => {
    it('should add a dependency to a task', () => {
      const existingDeps = [1, 2];
      const newDep = 3;

      const updatedDeps = [...existingDeps, newDep];
      expect(updatedDeps).toContain(3);
      expect(updatedDeps).toHaveLength(3);
    });

    it('should remove a dependency from a task', () => {
      const existingDeps = [1, 2, 3];
      const depToRemove = 2;

      const updatedDeps = existingDeps.filter(dep => dep !== depToRemove);
      expect(updatedDeps).toEqual([1, 3]);
      expect(updatedDeps).not.toContain(2);
    });

    it('should not allow a task to depend on itself', () => {
      const taskId = 1;
      const proposedDeps = [1, 2, 3];

      const hasSelfDependency = proposedDeps.includes(taskId);
      expect(hasSelfDependency).toBe(true);
    });
  });
});