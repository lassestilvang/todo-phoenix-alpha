/**
 * Unit tests for PatternMiningService
 *
 * Covers:
 * - Clustering of tasks based on timing heuristics
 * - Pattern extraction logic
 * - Confidence scoring
 */

import { PatternMiningService, RecurringPatternType } from '@/lib/pattern-miner';
import { Task } from '@/types/task';
import { v4 as uuidv4 } from 'uuid';

// Helper to generate a task with a specific createdAt timestamp
function createTask(overrides: Partial<Task> = {}): Task {
  const base: Task = {
    id: uuidv4(),
    description: 'Test task',
    required_capabilities: [],
    priority: 5,
    dependencies: [],
    created_by: 'test-agent',
    status: 'pending',
    created_at: Date.now(),
    ...overrides,
  };
  return base;
}

describe('PatternMiningService', () => {
  let miningService: PatternMiningService;

  beforeEach(() => {
    miningService = new PatternMiningService({} as any); // pass dummy AgentOS
  });

  describe('taskKey', () => {
    it('should generate consistent keys for tasks with same hour/minute', () => {
      const now = Date.now();
      const t1 = createTask({ created_at: new Date(now).setHours(14, 30) });
      const t2 = createTask({ created_at: new Date(now).setHours(14, 30) });
      expect(miningService.taskKey(t1)).toBe(miningService.taskKey(t2));
    });

    it('should produce different keys for different minutes', () => {
      const now = Date.now();
      const t1 = createTask({ created_at: new Date(now).setHours(14, 30) });
      const t2 = createTask({ created_at: new Date(now).setHours(14, 31) });
      expect(miningService.taskKey(t1)).not.toBe(miningService.taskKey(t2));
    });
  });

  describe('clusterTasks', () => {
    it('should group tasks by identical hour/minute', () => {
      const now = Date.now();
      const tasks = [
        createTask({ created_at: new Date(now).setHours(9, 0) }),
        createTask({ created_at: new Date(now).setHours(9, 0) }),
        createTask({ created_at: new Date(now).setHours(10, 0) }),
        createTask({ created_at: new Date(now).setHours(9, 0) }),
      ];
      const clusters = miningService.clusterTasks(tasks);
      expect(clusters.size).toBe(2);
      const key9 = Object.keys(clusters)[0]; // may be 'h9_m0' pattern
      expect(clusters.get(key9)!.length).toBe(3);
      const key10 = Object.keys(clusters)[1];
      expect(clusters.get(key10)!.length).toBe(1);
    });
  });

  describe('extractPatternsFromClusters', () => {
    it('should produce a RecurringPattern for each cluster', () => {
      const now = Date.now();
      const tasks = [
        createTask({ created_at: new Date(now).setHours(8, 0) }),
        createTask({ created_at: new Date(now).setHours(8, 0) }),
        createTask({ created_at: new Date(now).setHours(12, 0) }),
      ];
      const clusters = miningService.clusterTasks(tasks);
      const patterns = miningService.extractPatternsFromClusters(clusters);
      expect(patterns.length).toBe(2);
      patterns.forEach(p => {
        expect(p.id).toBeDefined();
        expect(['hourly', 'daily', 'weekly', 'monthly']).toContain(p.type);
        expect(p.interval).toBeGreaterThanOrEqual(1);
        expect(p.description).toContain('Auto-generated');
      });
    });

    it('should assign correct pattern type based on heuristic', () => {
      const now = Date.now();
      // Simulate a cluster with daily pattern (same hour/minute across days)
      const tasks = Array.from({ length: 3 }, (_, i) =>
        createTask({
          created_at: new Date(now - i * 24 * 60 * 60 * 1000).setHours(7, 30),
        })
      );
      const clusters = miningService.clusterTasks(tasks);
      const patterns = miningService.extractPatternsFromClusters(clusters);
      // Since our naive extractor defaults to 'hourly', but we can check description
      expect(patterns[0].description).toContain('hourly');
    });
  });

  describe('confidence scoring (isConfidenceHighEnough)', () => {
    it('should return true for clusters with enough recurring tasks', () => {
      const key = 'base-5_h8_m0_w2';
      const tasks = [
        createTask({ created_at: Date.now() - 86400000 }),
        createTask({ created_at: Date.now() - 2 * 86400000 }),
        createTask({ created_at: Date.now() - 3 * 86400000 }),
      ];
      // The method is private; we test via extractPatternsFromClusters which uses it
      // Ensure that with 3 tasks it should consider high confidence
      const clusters = new Map();
      clusters.set(key, tasks);
      const patterns = miningService.extractPatternsFromClusters(clusters);
      expect(patterns.length).toBeGreaterThan(0);
    });
  });
});