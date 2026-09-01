/**
 * Monitoring service for request/response tracking and health metrics
 */
import { auditLogger, AuditLogData, AuditAction } from './audit-logger';
import db from '@/lib/db/schema';
import { dataCache } from '@/lib/cache';

const systemMetrics = {
  startTime: Date.now(),
  requests: 0,
  errors: 0,
  avgResponseTime: 0,
};

export class MonitoringService {
  private static instance: MonitoringService;

  static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  static resetInstance(): void {
    MonitoringService.instance = null as any;
    systemMetrics.requests = 0;
    systemMetrics.errors = 0;
    systemMetrics.avgResponseTime = 0;
    systemMetrics.startTime = Date.now();
  }

  incrementRequest(): void {
    systemMetrics.requests++;
  }

  incrementError(): void {
    systemMetrics.errors++;
  }

  setAvgResponseTime(timeMs: number): void {
    const n = systemMetrics.requests;
    if (n === 0) {
      systemMetrics.avgResponseTime = timeMs;
    } else {
      systemMetrics.avgResponseTime = ((systemMetrics.avgResponseTime * (n - 1)) + timeMs) / n;
    }
  }

  getSystemMetrics() {
    const uptime = (Date.now() - systemMetrics.startTime) / 1000;
    return {
      uptimeSeconds: Math.round(uptime),
      totalRequests: systemMetrics.requests,
      totalErrors: systemMetrics.errors,
      errorRate: systemMetrics.requests > 0 ? (systemMetrics.errors / systemMetrics.requests) * 100 : 0,
      avgResponseTimeMs: Math.round(systemMetrics.avgResponseTime),
    };
  }

  checkDatabaseHealth() {
    try {
      const start = Date.now();
      db.prepare('SELECT 1').get();
      const responseTime = Date.now() - start;
      return {
        status: 'healthy' as const,
        responseTimeMs: responseTime,
        details: 'Database connection is healthy',
      };
    } catch (error) {
      return {
        status: 'unhealthy' as const,
        responseTimeMs: 0,
        details: error instanceof Error ? error.message : 'Database connection failed',
      };
    }
  }

  async checkApiHealth() {
    // Check critical API integrations
    const checks: Array<{ name: string; status: 'healthy' | 'unhealthy' | 'not_configured'; details?: string }> = [];

    // Check AI service
    const aiKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY_TEST;
    if (aiKey) {
      checks.push({
        name: 'anthropic-ai',
        status: 'healthy',
        details: 'API key configured',
      });
    } else {
      checks.push({
        name: 'anthropic-ai',
        status: 'unhealthy',
        details: 'API key not configured',
      });
    }

    // Check Redis (if configured)
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      // Redis availability would be checked here
      checks.push({
        name: 'redis',
        status: 'healthy',
        details: 'Redis configured, availability to be verified',
      });
    } else {
      checks.push({
        name: 'redis',
        status: 'not_configured',
        details: 'Redis not configured, caching will use memory only',
      });
    }

    return checks;
  }

  logRequest(
    method: string,
    path: string,
    statusCode: number,
    responseTimeMs: number,
    userId?: string
  ): void {
    this.incrementRequest();

    const severity = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warning' : 'info';

    auditLogger.log({
      action: 'api_request',
      tableName: 'api_requests',
      recordId: 0,
      userId,
      metadata: {
        method,
        path,
        statusCode,
        responseTimeMs,
      },
      severity,
    });

    this.incrementErrorIfNeeded(statusCode);
    this.setAvgResponseTime(responseTimeMs);
  }

  private incrementErrorIfNeeded(statusCode: number): void {
    if (statusCode >= 500) {
      this.incrementError();
    }
  }

  getHealthSummary() {
    const metrics = this.getSystemMetrics();
    return {
      status: metrics.totalErrors > 0 ? 'degraded' : 'healthy',
      ...metrics,
      timestamp: new Date().toISOString(),
    };
  }

  getCacheStats() {
    try {
      return dataCache.getStats();
    } catch (error) {
      return { size: 0, keys: [] };
    }
  }
}

export const monitoring = MonitoringService.getInstance();

// Export types for use in middleware
export type { AuditLogData, AuditAction };