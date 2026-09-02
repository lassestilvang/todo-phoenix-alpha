import { describe, it, expect, beforeEach } from 'vitest';
import { PatternMiningService } from '@/lib/pattern-miner';

describe('PatternMiningService', () => {
  let service: PatternMiningService;

  beforeEach(() => {
    service = new PatternMiningService();
  });

  describe('taskKey', () => {
    it('should generate correct key format', () => {
      // Use UTC to avoid timezone issues
      const task = { created_at: Date.UTC(2023, 0, 15, 14, 30, 0) };
      const key = service.taskKey(task);
      // Jan 15 is week 3 of month, 14:30 UTC
      expect(key).toBe('h_14_m_30_w_3');
    });

    it('should not pad with leading zeros for simple format', () => {
      const task = { created_at: Date.UTC(2023, 0, 5, 9, 5, 0) };
      const key = service.taskKey(task);
      // Jan 5 is week 1 of month, 09:05 UTC
      expect(key).toBe('h_9_m_5_w_1');
    });
  });

  describe('clusterTasks', () => {
    it('should group tasks by same key', () => {
      const tasks = [
        { created_at: Date.UTC(2023, 0, 15, 14, 30, 0) },
        { created_at: Date.UTC(2023, 0, 15, 14, 30, 0) }, // Same key
        { created_at: Date.UTC(2023, 0, 15, 15, 45, 0) }, // Different key
      ];

      const clusters = service.clusterTasks(tasks);
      expect(clusters.size).toBe(2);

      const key1 = 'h_14_m_30_w_3';
      const key2 = 'h_15_m_45_w_3';

      expect(clusters.has(key1)).toBe(true);
      expect(clusters.get(key1)?.length).toBe(2);

      expect(clusters.has(key2)).toBe(true);
      expect(clusters.get(key2)?.length).toBe(1);
    });

    it('should return empty map for empty array', () => {
      const clusters = service.clusterTasks([]);
      expect(clusters.size).toBe(0);
    });
  });

  describe('extractPatternsFromClusters', () => {
    it('should extract daily patterns for week 1', () => {
      const clusters = new Map<string, Array<{ created_at: number }>>();
      clusters.set('h_09_m_00_w_1', [
        { created_at: Date.UTC(2023, 0, 15, 9, 0, 0) },
        { created_at: Date.UTC(2023, 0, 22, 9, 0, 0) },
        { created_at: Date.UTC(2023, 0, 29, 9, 0, 0) },
      ]);

      const patterns = service.extractPatternsFromClusters(clusters);
      expect(patterns.length).toBe(1);
      expect(patterns[0].type).toBe('daily');
      expect(patterns[0].interval).toBe(1);
      expect(patterns[0].description).toBe('Auto-pattern: daily every 1 day');
    });

    it('should extract monthly patterns for week 2+', () => {
      const clusters = new Map<string, Array<{ created_at: number }>>();
      clusters.set('h_10_m_15_w_2', [
        { created_at: Date.UTC(2023, 0, 15, 10, 15, 0) },
        { created_at: Date.UTC(2023, 1, 15, 10, 15, 0) },
        { created_at: Date.UTC(2023, 2, 15, 10, 15, 0) },
      ]);

      const patterns = service.extractPatternsFromClusters(clusters);
      expect(patterns.length).toBe(1);
      expect(patterns[0].type).toBe('monthly');
      expect(patterns[0].interval).toBe(1);
      expect(patterns[0].description).toBe('Auto-pattern: monthly every 1 month');
    });

    it('should extract weekly patterns for week 0 (edge case)', () => {
      const clusters = new Map<string, Array<{ created_at: number }>>();
      clusters.set('h_14_m_30_w_0', [
        { created_at: Date.UTC(2023, 0, 15, 14, 30, 0) },
      ]);

      const patterns = service.extractPatternsFromClusters(clusters);
      expect(patterns.length).toBe(1);
      expect(patterns[0].type).toBe('weekly');
      expect(patterns[0].interval).toBe(1);
      expect(patterns[0].description).toBe('Auto-pattern: weekly every 1 week');
    });

    it('should handle multiple clusters', () => {
      const clusters = new Map<string, Array<{ created_at: number }>>();
      clusters.set('h_09_m_00_w_1', [{ created_at: Date.UTC(2023, 0, 15, 9, 0, 0) }]);
      clusters.set('h_10_m_15_w_2', [{ created_at: Date.UTC(2023, 0, 15, 10, 15, 0) }]);
      clusters.set('h_14_m_30_w_0', [{ created_at: Date.UTC(2023, 0, 15, 14, 30, 0) }]);

      const patterns = service.extractPatternsFromClusters(clusters);
      expect(patterns.length).toBe(3);

      const types = patterns.map(p => p.type).sort();
      expect(types).toEqual(['daily', 'monthly', 'weekly']);
    });
  });

  describe('isConfidenceHighEnough', () => {
    it('should return true for cluster size >= 3', () => {
      expect(service.isConfidenceHighEnough(3)).toBe(true);
      expect(service.isConfidenceHighEnough(5)).toBe(true);
    });

    it('should return false for cluster size < 3', () => {
      expect(service.isConfidenceHighEnough(2)).toBe(false);
      expect(service.isConfidenceHighEnough(1)).toBe(false);
      expect(service.isConfidenceHighEnough(0)).toBe(false);
    });
  });
});