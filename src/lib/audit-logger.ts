import db from './db/schema';

export type AuditAction =
  | 'task_created'
  | 'task_updated'
  | 'task_deleted'
  | 'task_completed'
  | 'list_created'
  | 'list_updated'
  | 'list_deleted'
  | 'project_created'
  | 'project_updated'
  | 'project_deleted'
  | 'time_entry_started'
  | 'time_entry_stopped'
  | 'time_entry_updated'
  | 'attachment_added'
  | 'attachment_removed'
  | 'reminder_created'
  | 'reminder_sent'
  | 'user_login'
  | 'user_logout'
  | 'ai_suggestion_accepted'
  | 'ai_suggestion_dismissed'
  | 'conflict_resolved'
  | 'agent_assigned'
  | 'agent_unavailable'
  | 'pattern_detected'
  | 'anomaly_detected'
  | 'export_created'
  | 'import_completed'
  | 'reminder_set'
  | 'reminder_edited'
  | 'reminder_removed'
  | 'backup_created'
  | 'backup_restored'
  | 'export_database'
  | 'password_changed'
  | 'role_assigned'
  | 'permission_granted'
  | 'security_setting_changed'
  | 'mobile_device_detected'
  | 'offline_mode_activated'
  | 'sync_completed'
  | 'cache_cleared'
  | 'theme_changed'
  | 'notification_sent'
  | 'notification_dismissed'
  | 'shortcut_created'
  | 'shortcut_deleted'
  | 'task_keyed'
  | 'task_exported'
  | 'task_imported'
  | 'task_duplicated'
  | 'task_archived'
  | 'task_restored'
  | 'task_comment_added'
  | 'task_comment_deleted'
  | 'tag_added'
  | 'tag_removed'
  | 'label_assigned'
  | 'label_removed'
  | 'workflow_started'
  | 'workflow_completed'
  | 'workflow_aborted'
  | 'validation_error'
  | 'rate_limit_exceeded'
  | 'api_request'
  | 'api_response'
  | 'database_query'
  | 'file_upload'
  | 'file_download'
  | 'error_occurred'
  | 'debug_log'
  | 'performance_metric'
  | 'memory_usage'
  | 'cpu_usage'
  | 'network_status'
  | 'browser_info'
  | 'operating_system'
  | 'timezone_change'
  | 'language_change'
  | 'accessibility_mode_changed'
  | 'privacy_setting_changed'
  | 'data_exported';

export interface AuditLogData {
  action: AuditAction;
  tableName: string;
  recordId: number;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  correlationId?: string;
  sessionId?: string;
}

export interface AuditLogEntry {
  id: number;
  user_id: string;
  action: AuditAction;
  table_name: string;
  record_id: number;
  old_values: string | null;
  new_values: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: string | null;
  severity: string;
  correlation_id: string | null;
  session_id: string | null;
  created_at: string;
}

export interface AnomalyDetectionResult {
  isAnomaly: boolean;
  anomalyScore: number;
  anomalyType?: string;
  details?: string;
}

export interface ExternalIntegrationConfig {
  webhookUrl?: string;
  apiKey?: string;
  batchSize?: number;
  flushIntervalMs?: number;
}

export class AuditLogger {
  private static instance: AuditLogger;
  private userId: string = 'default';
  private sessionId: string;
  private externalConfig: ExternalIntegrationConfig | null = null;
  private pendingLogs: AuditLogData[] = [];
  private flushTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.startPeriodicFlush();
  }

  static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  setUserId(userId: string): void {
    this.userId = userId;
  }

  getUserId(): string {
    return this.userId;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  setExternalIntegration(config: ExternalIntegrationConfig): void {
    this.externalConfig = config;
  }

  log(data: AuditLogData): void {
    const enrichedData: AuditLogData = {
      ...data,
      userId: data.userId || this.userId,
      sessionId: data.sessionId || this.sessionId,
      severity: data.severity || 'info',
      correlationId: data.correlationId || this.generateCorrelationId(),
      metadata: {
        ...data.metadata,
        userAgent: data.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : 'server'),
        ipAddress: data.ipAddress || 'unknown',
        timestamp: new Date().toISOString(),
      },
    };

    try {
      const stmt = db.prepare(`
        INSERT INTO audit_logs
          (user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent, metadata, severity, correlation_id, session_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        enrichedData.userId,
        enrichedData.action,
        enrichedData.tableName,
        enrichedData.recordId,
        enrichedData.oldValues ? JSON.stringify(enrichedData.oldValues) : null,
        enrichedData.newValues ? JSON.stringify(enrichedData.newValues) : null,
        enrichedData.ipAddress || null,
        enrichedData.userAgent || null,
        enrichedData.metadata ? JSON.stringify(enrichedData.metadata) : null,
        enrichedData.severity,
        enrichedData.correlationId,
        enrichedData.sessionId
      );
    } catch (error) {
      console.error('Failed to write audit log:', error);
    }

    // Queue for external integration
    if (this.externalConfig) {
      this.queueForExternal(enrichedData);
    }

    // Check for anomalies
    this.detectAnomalies(enrichedData);
  }

  logBatch(entries: AuditLogData[]): void {
    const insertStmt = db.prepare(`
      INSERT INTO audit_logs
        (user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent, metadata, severity, correlation_id, session_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((logs: AuditLogData[]) => {
      for (const entry of logs) {
        const enriched = {
          ...entry,
          userId: entry.userId || this.userId,
          sessionId: entry.sessionId || this.sessionId,
          severity: entry.severity || 'info',
          correlationId: entry.correlationId || this.generateCorrelationId(),
          metadata: entry.metadata ? {
            ...entry.metadata,
            userAgent: entry.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : 'server'),
            timestamp: new Date().toISOString(),
          } : {
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
            timestamp: new Date().toISOString(),
          },
        };

        insertStmt.run(
          enriched.userId,
          enriched.action,
          enriched.tableName,
          enriched.recordId,
          enriched.oldValues ? JSON.stringify(enriched.oldValues) : null,
          enriched.newValues ? JSON.stringify(enriched.newValues) : null,
          enriched.ipAddress || null,
          enriched.userAgent || null,
          enriched.metadata ? JSON.stringify(enriched.metadata) : null,
          enriched.severity,
          enriched.correlationId,
          enriched.sessionId
        );
      }
    });

    try {
      insertMany(entries);
    } catch (error) {
      console.error('Failed to write batch audit logs:', error);
    }
  }

  // Anomaly detection
  private async detectAnomalies(data: AuditLogData): Promise<AnomalyDetectionResult | null> {
    // Simple anomaly detection based on patterns
    const recentLogs = this.getLogs({
      userId: data.userId,
      limit: 100,
      dateFrom: new Date(Date.now() - 3600000).toISOString() // Last hour
    });

    const actionCount = recentLogs.filter(l => l.action === data.action).length;
    const threshold = 50; // More than 50 same actions in an hour is anomalous

    if (actionCount > threshold) {
      // Log the anomaly
      this.log({
        action: 'anomaly_detected',
        tableName: 'audit_logs',
        recordId: 0,
        userId: data.userId,
        severity: 'warning',
        metadata: {
          anomalyType: 'high_frequency_action',
          action: data.action,
          count: actionCount,
          threshold,
          timeWindow: '1h',
        },
      });

      return {
        isAnomaly: true,
        anomalyScore: actionCount / threshold,
        anomalyType: 'high_frequency_action',
        details: `User performed ${actionCount} ${data.action} actions in the last hour (threshold: ${threshold})`,
      };
    }

    return { isAnomaly: false, anomalyScore: 0 };
  }

  private queueForExternal(data: AuditLogData): void {
    this.pendingLogs.push(data);

    if (this.pendingLogs.length >= (this.externalConfig?.batchSize || 10)) {
      this.flushExternal();
    }
  }

  private flushExternal(): void {
    if (this.pendingLogs.length === 0 || !this.externalConfig?.webhookUrl) return;

    const logs = [...this.pendingLogs];
    this.pendingLogs = [];

    // In a real implementation, this would send to an external service
    // For now, we'll just log it
    console.log('Flushing audit logs to external service:', logs.length);
  }

  private startPeriodicFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.flushExternal();
    }, this.externalConfig?.flushIntervalMs || 300000); // 5 minutes
  }

  // Query methods
  getLogs(
    options: {
      userId?: string;
      tableName?: string;
      action?: AuditAction;
      limit?: number;
      offset?: number;
      dateFrom?: string;
      dateTo?: string;
      severity?: string;
      correlationId?: string;
      sessionId?: string;
    } = {}
  ): AuditLogEntry[] {
    const conditions: string[] = [];
    const params: any[] = [];

    if (options.userId) {
      conditions.push('user_id = ?');
      params.push(options.userId);
    }
    if (options.tableName) {
      conditions.push('table_name = ?');
      params.push(options.tableName);
    }
    if (options.action) {
      conditions.push('action = ?');
      params.push(options.action);
    }
    if (options.dateFrom) {
      conditions.push('created_at >= ?');
      params.push(options.dateFrom);
    }
    if (options.dateTo) {
      conditions.push('created_at <= ?');
      params.push(options.dateTo);
    }
    if (options.severity) {
      conditions.push('severity = ?');
      params.push(options.severity);
    }
    if (options.correlationId) {
      conditions.push('correlation_id = ?');
      params.push(options.correlationId);
    }
    if (options.sessionId) {
      conditions.push('session_id = ?');
      params.push(options.sessionId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limitClause = options.limit ? `LIMIT ? OFFSET ?` : '';

    if (limitClause) {
      params.push(options.limit!, options.offset || 0);
    }

    return db.prepare(`
      SELECT * FROM audit_logs
      ${whereClause}
      ORDER BY created_at DESC
      ${limitClause}
    `).all(...params) as AuditLogEntry[];
  }

  // Get statistics
  getStatistics(options: {
    dateFrom?: string;
    dateTo?: string;
    userId?: string;
  } = {}): {
    totalLogs: number;
    byAction: Record<string, number>;
    bySeverity: Record<string, number>;
    byUser: Record<string, number>;
    anomalies: number;
  } {
    const conditions: string[] = [];
    const params: any[] = [];

    if (options.userId) {
      conditions.push('user_id = ?');
      params.push(options.userId);
    }
    if (options.dateFrom) {
      conditions.push('created_at >= ?');
      params.push(options.dateFrom);
    }
    if (options.dateTo) {
      conditions.push('created_at <= ?');
      params.push(options.dateTo);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Total logs
    const totalLogs = db.prepare(`
      SELECT COUNT(*) as count FROM audit_logs ${whereClause}
    `).get(...params) as { count: number };

    // By action
    const byActionRaw = db.prepare(`
      SELECT action, COUNT(*) as count FROM audit_logs ${whereClause} GROUP BY action
    `).all(...params) as { action: string; count: number }[];

    const byAction: Record<string, number> = {};
    byActionRaw.forEach(r => { byAction[r.action] = r.count; });

    // By severity
    const bySeverityRaw = db.prepare(`
      SELECT severity, COUNT(*) as count FROM audit_logs ${whereClause} GROUP BY severity
    `).all(...params) as { severity: string; count: number }[];

    const bySeverity: Record<string, number> = {};
    bySeverityRaw.forEach(r => { bySeverity[r.severity] = r.count; });

    // By user
    const byUserRaw = db.prepare(`
      SELECT user_id, COUNT(*) as count FROM audit_logs ${whereClause} GROUP BY user_id
    `).all(...params) as { user_id: string; count: number }[];

    const byUser: Record<string, number> = {};
    byUserRaw.forEach(r => { byUser[r.user_id] = r.count; });

    // Anomalies
    const anomalies = db.prepare(`
      SELECT COUNT(*) as count FROM audit_logs ${whereClause} AND action = 'anomaly_detected'
    `).get(...params) as { count: number };

    return {
      totalLogs: totalLogs.count,
      byAction,
      bySeverity,
      byUser,
      anomalies: anomalies.count,
    };
  }

  // Export logs in various formats
  exportLogs(
    format: 'json' | 'csv' | 'syslog',
    options: {
      dateFrom?: string;
      dateTo?: string;
      userId?: string;
    } = {}
  ): string {
    const logs = this.getLogs({
      ...options,
      limit: 10000,
    });

    switch (format) {
      case 'json':
        return JSON.stringify(logs, null, 2);
      case 'csv':
        return this.convertToCSV(logs);
      case 'syslog':
        return this.convertToSyslog(logs);
      default:
        return JSON.stringify(logs, null, 2);
    }
  }

  private convertToCSV(logs: AuditLogEntry[]): string {
    if (logs.length === 0) return '';

    const headers = ['id', 'user_id', 'action', 'table_name', 'record_id', 'old_values', 'new_values', 'ip_address', 'user_agent', 'metadata', 'severity', 'correlation_id', 'session_id', 'created_at'];
    const rows = logs.map(log => [
      log.id,
      log.user_id,
      log.action,
      log.table_name,
      log.record_id,
      log.old_values || '',
      log.new_values || '',
      log.ip_address || '',
      log.user_agent || '',
      log.metadata || '',
      log.severity,
      log.correlation_id || '',
      log.session_id || '',
      log.created_at,
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));

    return [headers.join(','), ...rows].join('\n');
  }

  private convertToSyslog(logs: AuditLogEntry[]): string {
    return logs.map(log => {
      const priority = this.getSyslogPriority(log.severity);
      const timestamp = new Date(log.created_at).toISOString();
      return `<${priority}>${timestamp} audit-logger[${log.id}]: user=${log.user_id} action=${log.action} table=${log.table_name} record=${log.record_id} severity=${log.severity} session=${log.session_id || '-'}`;
    }).join('\n');
  }

  private getSyslogPriority(severity: string): number {
    // Facility 16 (local0) + severity
    const severityMap: Record<string, number> = {
      debug: 7,
      info: 6,
      notice: 5,
      warning: 4,
      error: 3,
      critical: 2,
      alert: 1,
      emergency: 0,
    };
    const facility = 16 * 8; // local0
    return facility + (severityMap[severity] || 6);
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flushExternal();
  }
}

export const auditLogger = AuditLogger.getInstance();

// Helper functions for common logging patterns
export function logTaskCreated(taskId: number, taskData: any, userId?: string): void {
  auditLogger.log({
    action: 'task_created',
    tableName: 'tasks',
    recordId: taskId,
    newValues: taskData,
    userId,
    severity: 'info',
  });
}

export function logTaskUpdated(taskId: number, oldData: any, newData: any, userId?: string): void {
  auditLogger.log({
    action: 'task_updated',
    tableName: 'tasks',
    recordId: taskId,
    oldValues: oldData,
    newValues: newData,
    userId,
    severity: 'info',
  });
}

export function logTaskDeleted(taskId: number, taskData: any, userId?: string): void {
  auditLogger.log({
    action: 'task_deleted',
    tableName: 'tasks',
    recordId: taskId,
    oldValues: taskData,
    userId,
    severity: 'warning',
  });
}

export function logAnomaly(anomalyType: string, details: string, userId?: string): void {
  auditLogger.log({
    action: 'anomaly_detected',
    tableName: 'audit_logs',
    recordId: 0,
    userId,
    severity: 'warning',
    metadata: { anomalyType, details },
  });
}

export function logSecurityEvent(action: string, details: any, userId?: string): void {
  auditLogger.log({
    action: action as AuditAction,
    tableName: 'security_events',
    recordId: 0,
    userId,
    severity: 'critical',
    newValues: details,
  });
}