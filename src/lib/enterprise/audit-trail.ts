/**
 * Enterprise Audit Trail - Comprehensive logging for compliance reporting
 * Supports GDPR, HIPAA, SOX, and other regulatory compliance requirements
 */

import db from '@/lib/db/schema';
import { v4 as uuidv4 } from 'uuid';
import { auditLogger } from '@/lib/audit-logger';
import { auditLogger as enterpriseLogger } from '@/lib/audit-logger';

export type ComplianceEventType =
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'password_change'
  | 'role_assignment'
  | 'permission_grant'
  | 'data_export'
  | 'data_deletion'
  | 'access_request'
  | 'compliance_violation'
  | 'security_event'
  | 'audit_accessed'
  | 'report_generated';

export interface ComplianceEvent {
  id: string;
  eventType: ComplianceEventType;
  userId: string;
  username?: string;
  role?: string;
  resource?: string;
  resourceId?: string;
  action?: string;
  ipAddress: string;
  userAgent: string;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'success' | 'failure' | 'pending';
  details?: Record<string, unknown>;
  complianceRelevance: {
    gdpr: boolean;
    hipaa: boolean;
    sox: boolean;
    pci: boolean;
    scope: 'global' | 'regional' | 'local';
  };
  retentionPeriodMonths: number;
}

export interface AuditReport {
  id: string;
  reportType: 'access_log' | 'security_audit' | 'compliance_summary' | 'incident_report';
  timeRange: {
    from: number;
    to: number;
  };
  filters: {
    userId?: string;
    resource?: string;
    eventTypes?: ComplianceEventType[];
    severity?: string[];
  };
  generatedBy: string;
  generatedAt: number;
  report: ComplianceEvent[];
  statistics: {
    totalEvents: number;
    eventsByType: Record<ComplianceEventType, number>;
    eventsBySeverity: Record<string, number>;
    uniqueUsers: number;
    uniqueResources: number;
    successRate: number;
  };
  retentionDays: number;
}

export class EnterpriseAuditTrail {
  private retentionMonths = 120; // Default 10 years

  async logEvent(event: Omit<ComplianceEvent, 'id'>): Promise<string> {
    const eventId = uuidv4();
    const correlationId = uuidv4();
    const sessionId = 'session_' + uuidv4();

    // Use event properties directly, let spread handle rest
    const fullEvent: ComplianceEvent = {
      id: eventId,
      ...event,
    };

    // Log to both systems
    auditLogger.log(fullEvent as any);
    enterpriseLogger.log(fullEvent as any);

    // Store in database for long-term retention
    db.prepare(
      `INSERT INTO audit_logs
         (id, user_id, action, table_name, record_id, old_values, new_values,
          ip_address, user_agent, metadata, severity, correlation_id,
          session_id, created_at, event_type, compliance_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      eventId,
      event.userId,
      event.eventType,
      this.mapToTableName(event.resource),
      event.resourceId || null,
      null, // old_values
      null, // new_values
      event.ipAddress || 'unknown',
      event.userAgent || 'unknown',
      JSON.stringify({
        severity: fullEvent.severity,
        status: fullEvent.status,
        compliance: fullEvent.complianceRelevance,
        retention: fullEvent.retentionPeriodMonths,
        ...fullEvent.details,
      }),
      fullEvent.severity,
      correlationId, // correlation_id
      sessionId, // session_id
      new Date().toISOString(),
      event.eventType,
      JSON.stringify(fullEvent.complianceRelevance)
    );

    return eventId;
  }

  async generateReport(filters: AuditReport['filters'], requesterId: string): Promise<AuditReport> {
    // Determine time range (last 30 days by default)
    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

    // Build parameterized query
    let querySql = `SELECT * FROM audit_logs WHERE created_at >= ? ORDER BY created_at DESC`;
    const params: unknown[] = [new Date(thirtyDaysAgo).toISOString()];

    // Build filter conditions safely
    if (filters.userId) {
      querySql += ' AND user_id = ?';
      params.push(filters.userId);
    }
    if (filters.resource) {
      querySql += ' AND table_name = ?';
      params.push(filters.resource);
    }
    if (filters.eventTypes && filters.eventTypes.length > 0) {
      const placeholders = filters.eventTypes.map(() => '?').join(', ');
      querySql += ` AND action IN (${placeholders})`;
      params.push(...filters.eventTypes);
    }
    if (filters.severity && filters.severity.length > 0) {
      const placeholders = filters.severity.map(() => '?').join(', ');
      querySql += ` AND severity IN (${placeholders})`;
      params.push(...filters.severity);
    }

    const results = db.prepare(querySql).all(...params);

    const report: AuditReport = {
      id: uuidv4(),
      reportType: 'access_log',
      timeRange: {
        from: thirtyDaysAgo,
        to: now,
      },
      filters,
      generatedBy: requesterId,
      generatedAt: now,
      report: (results || []) as ComplianceEvent[],
      statistics: this.calculateStatistics(results || []),
      retentionDays: this.retentionMonths * 30,
    };

    return report;
  }

  private buildFilterClause(filters: AuditReport['filters']): string {
    const conditions = [];

    if (filters.userId) {
      conditions.push('user_id = ?');
    }

    if (filters.resource) {
      conditions.push('table_name = ?');
    }

    if (filters.eventTypes && filters.eventTypes.length > 0) {
      const placeholders = filters.eventTypes.map(() => '?').join(', ');
      conditions.push(`action IN (${placeholders})`);
    }

    if (filters.severity && filters.severity.length > 0) {
      const placeholders = filters.severity.map(() => '?').join(', ');
      conditions.push(`severity IN (${placeholders})`);
    }

    return conditions.length > 0 ? conditions.join(' AND ') : '';
  }

  private calculateStatistics(events: ComplianceEvent[]): AuditReport['statistics'] {
    // Initialize all event types to 0
    const eventTypes: ComplianceEventType[] = [
      'login_success', 'login_failed', 'logout', 'password_change',
      'role_assignment', 'permission_grant', 'data_export', 'data_deletion',
      'access_request', 'compliance_violation', 'security_event',
      'audit_accessed', 'report_generated'
    ];

    const eventsByType: Record<ComplianceEventType, number> = {} as Record<ComplianceEventType, number>;
    eventTypes.forEach(t => { eventsByType[t] = 0; });

    const eventsBySeverity: Record<string, number> = {};

    for (const event of events) {
      eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;
      eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;
    }

    return {
      totalEvents: events.length,
      eventsByType,
      eventsBySeverity,
      uniqueUsers: new Set(events.map(e => e.userId)).size,
      uniqueResources: new Set(events.map(e => e.resource)).size,
      successRate: events.length > 0 ? events.filter(e => e.status === 'success').length / events.length : 0,
    };
  }

  private mapToTableName(resource?: string): string {
    if (!resource) return 'unknown';

    switch (resource) {
      case 'task':
        return 'tasks';
      case 'project':
        return 'projects';
      case 'user':
        return 'users';
      case 'list':
        return 'lists';
      case 'attachment':
        return 'attachments';
      case 'reminder':
        return 'reminders';
      default:
        return resource;
    }
  }

  async cleanupExpiredEvents(): Promise<number> {
    const now = Date.now();
    const cutoff = now - (this.retentionMonths * 30 * 24 * 60 * 60 * 1000);

    const result = db.prepare(
      'DELETE FROM audit_logs WHERE created_at < ?'
    ).run(new Date(cutoff).toISOString());

    return result.changes;
  }

  async getComplianceStats(complianceType: string): Promise<Record<string, number>> {
    // Return statistics for specific compliance requirements
    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

    const result = db.prepare(
      `SELECT
         COUNT(*) as total,
         COUNT(CASE WHEN action IN ('login_success', 'logout') THEN 1 END) as accessEvents,
         COUNT(CASE WHEN action IN ('password_change', 'role_assignment') THEN 1 END) as securityEvents,
         COUNT(CASE WHEN action IN ('data_export', 'data_deletion') THEN 1 END) as dataEvents
       FROM audit_logs
       WHERE created_at >= ?
         AND metadata LIKE ?`
    ).get(
      new Date(thirtyDaysAgo).toISOString(),
      `%"compliance\":%{" + complianceType + ": true}%`
    ) as { total: number; accessEvents: number; securityEvents: number; dataEvents: number };

    return {
      total: result.total,
      accessEvents: result.accessEvents,
      securityEvents: result.securityEvents,
      dataEvents: result.dataEvents,
    };
  }
}

// Export singleton instance
export const enterpriseAuditTrail = new EnterpriseAuditTrail();

// Helper function for easy logging
export async function logComplianceEvent(event: Omit<ComplianceEvent, 'id'>): Promise<string> {
  return enterpriseAuditTrail.logEvent(event);
}