import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the dependencies
vi.mock('@/lib/db/schema', () => ({
  default: {
    prepare: vi.fn().mockReturnThis(),
    run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
    all: vi.fn().mockReturnValue([]),
    get: vi.fn().mockReturnValue({ value: 1 }),
  },
  __esModule: true,
}));

vi.mock('@/lib/cache', () => ({
  dataCache: {
    getStats: vi.fn().mockReturnValue({ size: 100, keys: ['key1', 'key2'] }),
  },
}));

// Mock audit logger
vi.mock('./audit-logger', () => ({
  auditLogger: {
    log: vi.fn(),
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { MonitoringService } from '../monitoring';

describe('Monitoring Service', () => {
  let monitoring: MonitoringService;

  beforeEach(() => {
    vi.clearAllMocks();
    MonitoringService.resetInstance();
    monitoring = MonitoringService.getInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = MonitoringService.getInstance();
      const instance2 = MonitoringService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Request/Error Tracking', () => {
    it('should increment request count', () => {
      expect(monitoring.getSystemMetrics().totalRequests).toBe(0);

      monitoring.incrementRequest();
      expect(monitoring.getSystemMetrics().totalRequests).toBe(1);

      monitoring.incrementRequest();
      expect(monitoring.getSystemMetrics().totalRequests).toBe(2);
    });

    it('should increment error count', () => {
      expect(monitoring.getSystemMetrics().totalErrors).toBe(0);

      monitoring.incrementError();
      expect(monitoring.getSystemMetrics().totalErrors).toBe(1);

      monitoring.incrementError();
      expect(monitoring.getSystemMetrics().totalErrors).toBe(2);
    });

    it('should calculate error rate correctly', () => {
      monitoring.incrementRequest();
      monitoring.incrementRequest();
      monitoring.incrementRequest();

      monitoring.incrementError();
      const metrics = monitoring.getSystemMetrics();
      expect(metrics.totalRequests).toBe(3);
      expect(metrics.totalErrors).toBe(1);
      expect(metrics.errorRate).toBeCloseTo(33.33, 1);
    });

    it('should return 0 error rate when no errors', () => {
      monitoring.incrementRequest();
      monitoring.incrementRequest();

      expect(monitoring.getSystemMetrics().errorRate).toBe(0);
    });

    it('should return 0 error rate when no requests', () => {
      expect(monitoring.getSystemMetrics().errorRate).toBe(0);
    });
  });

  describe('Response Time Tracking', () => {
    it('should set average response time', () => {
      monitoring.setAvgResponseTime(100);
      expect(monitoring.getSystemMetrics().avgResponseTimeMs).toBe(100);

      monitoring.setAvgResponseTime(200);
      expect(monitoring.getSystemMetrics().avgResponseTimeMs).toBe(150);
    });

    it('should handle single response time', () => {
      monitoring.setAvgResponseTime(50);
      expect(monitoring.getSystemMetrics().avgResponseTimeMs).toBe(50);
    });
  });

  describe('System Metrics', () => {
    it('should return uptime in seconds', () => {
      const metrics = monitoring.getSystemMetrics();
      expect(metrics.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });

    it('should return all required metrics', () => {
      const metrics = monitoring.getSystemMetrics();

      expect(metrics).toHaveProperty('uptimeSeconds');
      expect(metrics).toHaveProperty('totalRequests');
      expect(metrics).toHaveProperty('totalErrors');
      expect(metrics).toHaveProperty('errorRate');
      expect(metrics).toHaveProperty('avgResponseTimeMs');
    });

    it('should have correct metric types', () => {
      const metrics = monitoring.getSystemMetrics();

      expect(typeof metrics.uptimeSeconds).toBe('number');
      expect(typeof metrics.totalRequests).toBe('number');
      expect(typeof metrics.totalErrors).toBe('number');
      expect(typeof metrics.errorRate).toBe('number');
      expect(typeof metrics.avgResponseTimeMs).toBe('number');
    });
  });

  describe('Database Health Check', () => {
    it('should return healthy status when DB responds', () => {
      const result = monitoring.checkDatabaseHealth();

      expect(result.status).toBe('healthy');
      expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.details).toBe('Database connection is healthy');
    });

    it('should return details about response time', () => {
      const result = monitoring.checkDatabaseHealth();

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('responseTimeMs');
      expect(result).toHaveProperty('details');
    });

    it('should return status as healthy or unhealthy string', () => {
      const result = monitoring.checkDatabaseHealth();
      expect(['healthy', 'unhealthy']).toContain(result.status);
    });
  });

  describe('API Health Check', () => {
    it('should check anthropic AI status', async () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';

      const checks = await monitoring.checkApiHealth();

      const aiCheck = checks.find((c) => c.name === 'anthropic-ai');
      expect(aiCheck).toBeDefined();
      expect(aiCheck!.status).toBe('healthy');
      expect(aiCheck!.details).toBe('API key configured');

      delete process.env.ANTHROPIC_API_KEY;
    });

    it('should report unhealthy when API key not configured', async () => {
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_API_KEY_TEST;

      const checks = await monitoring.checkApiHealth();

      const aiCheck = checks.find((c) => c.name === 'anthropic-ai');
      expect(aiCheck!.status).toBe('unhealthy');
      expect(aiCheck!.details).toBe('API key not configured');
    });

    it('should check Redis status', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';

      const checks = await monitoring.checkApiHealth();

      const redisCheck = checks.find((c) => c.name === 'redis');
      expect(redisCheck!.status).toBe('healthy');

      delete process.env.REDIS_URL;
    });

    it('should report Redis not configured when URL missing', async () => {
      delete process.env.REDIS_URL;

      const checks = await monitoring.checkApiHealth();

      const redisCheck = checks.find((c) => c.name === 'redis');
      expect(redisCheck!.status).toBe('not_configured');
    });
  });

  describe('Request Logging', () => {
    it('should log request with correct parameters', () => {
      monitoring.logRequest('GET', '/api/tasks', 200, 50, 'user123');

      expect(monitoring.getSystemMetrics().totalRequests).toBe(1);
    });

    it('should increment error on 500 status', () => {
      monitoring.logRequest('GET', '/api/error', 500, 100, 'user');

      expect(monitoring.getSystemMetrics().totalRequests).toBe(1);
      expect(monitoring.getSystemMetrics().totalErrors).toBe(1);
    });

    it('should not increment error on 400 status', () => {
      monitoring.logRequest('GET', '/api/bad-request', 400, 50, 'user');

      expect(monitoring.getSystemMetrics().totalErrors).toBe(0);
    });

    it('should update response time on log request', () => {
      monitoring.logRequest('GET', '/api/test', 200, 150);

      expect(monitoring.getSystemMetrics().avgResponseTimeMs).toBeGreaterThan(0);
    });
  });

  describe('Health Summary', () => {
    it('should return healthy summary with no errors', () => {
      monitoring.incrementRequest();

      const summary = monitoring.getHealthSummary();

      expect(summary.status).toBe('healthy');
      expect(summary.totalRequests).toBe(1);
      expect(summary.totalErrors).toBe(0);
      expect(summary.timestamp).toBeDefined();
    });

    it('should return degraded summary with errors', () => {
      monitoring.incrementRequest();
      monitoring.incrementError();

      const summary = monitoring.getHealthSummary();

      expect(summary.status).toBe('degraded');
      expect(summary.totalErrors).toBe(1);
    });

    it('should include all metrics in summary', () => {
      const summary = monitoring.getHealthSummary();

      expect(summary).toHaveProperty('status');
      expect(summary).toHaveProperty('uptimeSeconds');
      expect(summary).toHaveProperty('totalRequests');
      expect(summary).toHaveProperty('totalErrors');
      expect(summary).toHaveProperty('errorRate');
      expect(summary).toHaveProperty('avgResponseTimeMs');
      expect(summary).toHaveProperty('timestamp');
    });
  });

  describe('Cache Stats', () => {
    it('should return cache statistics', () => {
      const stats = monitoring.getCacheStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('keys');
      expect(typeof stats.size).toBe('number');
      expect(Array.isArray(stats.keys)).toBe(true);
    });

    it('should return stats from cache service', () => {
      const stats = monitoring.getCacheStats();
      expect(stats).toEqual({ size: 100, keys: ['key1', 'key2'] });
    });
  });

  describe('Edge Cases', () => {
    it('should handle high volume of requests', () => {
      for (let i = 0; i < 1000; i++) {
        monitoring.incrementRequest();
      }

      expect(monitoring.getSystemMetrics().totalRequests).toBe(1000);
    });

    it('should handle high volume of errors', () => {
      for (let i = 0; i < 100; i++) {
        monitoring.incrementError();
      }

      expect(monitoring.getSystemMetrics().totalErrors).toBe(100);
    });

    it('should calculate correct average after many requests', () => {
      monitoring.setAvgResponseTime(10);
      monitoring.setAvgResponseTime(20);
      monitoring.setAvgResponseTime(30);
      monitoring.setAvgResponseTime(40);
      monitoring.setAvgResponseTime(50);

      expect(monitoring.getSystemMetrics().avgResponseTimeMs).toBe(30);
    });

    it('should handle error rate at 100%', () => {
      monitoring.incrementRequest();
      monitoring.incrementRequest();
      monitoring.incrementRequest();

      monitoring.incrementError();
      monitoring.incrementError();
      monitoring.incrementError();

      expect(monitoring.getSystemMetrics().errorRate).toBe(100);
    });

    it('should handle 0% error rate', () => {
      monitoring.incrementRequest();
      monitoring.incrementRequest();

      expect(monitoring.getSystemMetrics().errorRate).toBe(0);
    });

    it('should handle fractional response times rounded to integer', () => {
      monitoring.setAvgResponseTime(10.5);
      expect(monitoring.getSystemMetrics().avgResponseTimeMs).toBe(11);
    });
  });
});