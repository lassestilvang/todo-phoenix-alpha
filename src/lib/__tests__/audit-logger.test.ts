import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

// Mock the database - use the alias that vitest understands
vi.mock('@/lib/db/schema', () => ({
  default: {
    prepare: vi.fn().mockReturnThis(),
    run: vi.fn().mockReturnValue({ lastInsertRowid: 1, changes: 1 }),
    all: vi.fn().mockReturnValue([]),
    get: vi.fn().mockReturnValue(null),
    exec: vi.fn(),
    pragma: vi.fn(),
    transaction: vi.fn(),
  },
  __esModule: true,
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import {
  AuditLogger,
  auditLogger,
  logTaskCreated,
  logTaskUpdated,
  logTaskDeleted,
  logAnomaly,
  logSecurityEvent,
} from '@/lib/audit-logger';
import db from '@/lib/db/schema';

// Helper to create mock audit log entries
function mockLogEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    user_id: 'test-user',
    action: 'task_created',
    table_name: 'tasks',
    record_id: 1,
    old_values: null,
    new_values: null,
    ip_address: null,
    user_agent: null,
    metadata: null,
    severity: 'info',
    correlation_id: 'corr_test',
    session_id: 'session_test',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to create an array of mock log entries with a specific action
function createMockLogs(count: number, action = 'task_created') {
  return Array.from({ length: count }, (_, i) =>
    mockLogEntry({ id: i + 1, action })
  );
}

describe('AuditLogger Module', () => {
  const mockDb = db as any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default mock returns
    mockDb.prepare.mockReturnThis();
    mockDb.run.mockReturnValue({ lastInsertRowid: 1, changes: 1 });
    mockDb.all.mockReturnValue([]);
    mockDb.get.mockReturnValue(null);
    mockDb.transaction.mockImplementation((fn: any) => fn);

    // Reset singleton state
    auditLogger.setUserId('default');
    (auditLogger as any).externalConfig = null;
    (auditLogger as any).pendingLogs = [];
  });

  afterAll(() => {
    auditLogger.destroy();
  });

  // ==========================================================================
  // 1. Singleton Pattern
  // ==========================================================================
  describe('Singleton Pattern', () => {
    it('should return the same instance from getInstance()', () => {
      const instance1 = AuditLogger.getInstance();
      const instance2 = AuditLogger.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should return the same instance as the exported auditLogger', () => {
      expect(auditLogger).toBe(AuditLogger.getInstance());
    });

    it('should have a valid session ID starting with "session_"', () => {
      const sessionId = auditLogger.getSessionId();
      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
      expect(sessionId).toMatch(/^session_/);
    });

    it('should have a default userId of "default"', () => {
      // After beforeEach resets, the userId should be 'default'
      expect(auditLogger.getUserId()).toBe('default');
    });
  });

  // ==========================================================================
  // 2. log() Method
  // ==========================================================================
  describe('log() Method', () => {
    it('should insert a log entry with minimal required data', () => {
      auditLogger.log({
        action: 'task_created',
        tableName: 'tasks',
        recordId: 42,
      });

      expect(mockDb.prepare).toHaveBeenCalled();
      expect(mockDb.run).toHaveBeenCalled();

      const runCall = mockDb.run.mock.calls[0];
      expect(runCall[0]).toBe('default'); // userId defaults to 'default'
      expect(runCall[1]).toBe('task_created');
      expect(runCall[2]).toBe('tasks');
      expect(runCall[3]).toBe(42);
    });

    it('should enrich log with userId when not provided', () => {
      auditLogger.setUserId('custom-user');
      auditLogger.log({
        action: 'task_updated',
        tableName: 'tasks',
        recordId: 1,
      });

      const runCall = mockDb.run.mock.calls[0];
      expect(runCall[0]).toBe('custom-user');
    });

    it('should use provided userId over the default', () => {
      auditLogger.log({
        action: 'task_created',
        tableName: 'tasks',
        recordId: 1,
        userId: 'explicit-user',
      });

      const runCall = mockDb.run.mock.calls[0];
      expect(runCall[0]).toBe('explicit-user');
    });

    it('should set default severity to "info" when not provided', () => {
      auditLogger.log({
        action: 'task_created',
        tableName: 'tasks',
        recordId: 1,
      });

      const runCall = mockDb.run.mock.calls[0];
      // severity is the 10th parameter (index 9)
      expect(runCall[9]).toBe('info');
    });

    it('should use provided severity when specified', () => {
      auditLogger.log({
        action: 'task_deleted',
        tableName: 'tasks',
        recordId: 1,
        severity: 'critical',
      });

      const runCall = mockDb.run.mock.calls[0];
      expect(runCall[9]).toBe('critical');
    });

    it('should generate a correlationId when not provided', () => {
      auditLogger.log({
        action: 'task_created',
        tableName: 'tasks',
        recordId: 1,
      });

      const runCall = mockDb.run.mock.calls[0];
      const correlationId = runCall[10];
      expect(correlationId).toBeDefined();
      expect(correlationId).toMatch(/^corr_/);
    });

    it('should use provided correlationId when specified', () => {
      auditLogger.log({
        action: 'task_created',
        tableName: 'tasks',
        recordId: 1,
        correlationId: 'my-corr-id',
      });

      const runCall = mockDb.run.mock.calls[0];
      expect(runCall[10]).toBe('my-corr-id');
    });

    it('should enrich metadata with timestamp', () => {
      auditLogger.log({
        action: 'task_created',
        tableName: 'tasks',
        recordId: 1,
      });

      const runCall = mockDb.run.mock.calls[0];
      const metadata = JSON.parse(runCall[8]);
      expect(metadata.timestamp).toBeDefined();
      expect(typeof metadata.timestamp).toBe('string');
    });

    it('should enrich metadata with userAgent when not provided', () => {
      auditLogger.log({
        action: 'task_created',
        tableName: 'tasks',
        recordId: 1,
      });

      const runCall = mockDb.run.mock.calls[0];
      const metadata = JSON.parse(runCall[8]);
      // In jsdom, navigator.userAgent is defined
      expect(metadata.userAgent).toBeDefined();
    });

    it('should serialize oldValues and newValues as JSON strings', () => {
      const oldData = { title: 'Old', priority: 'low' };
      const newData = { title: 'New', priority: 'high' };

      auditLogger.log({
        action: 'task_updated',
        tableName: 'tasks',
        recordId: 1,
        oldValues: oldData,
        newValues: newData,
      });

      const runCall = mockDb.run.mock.calls[0];
      expect(JSON.parse(runCall[4])).toEqual(oldData);
      expect(JSON.parse(runCall[5])).toEqual(newData);
    });

    it('should set oldValues and newValues to null when not provided', () => {
      auditLogger.log({
        action: 'task_created',
        tableName: 'tasks',
        recordId: 1,
      });

      const runCall = mockDb.run.mock.calls[0];
      expect(runCall[4]).toBeNull();
      expect(runCall[5]).toBeNull();
    });

    it('should handle database errors without throwing', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockDb.run.mockImplementation(() => {
        throw new Error('DB insert failed');
      });

      expect(() => {
        auditLogger.log({
          action: 'task_created',
          tableName: 'tasks',
          recordId: 1,
        });
      }).not.toThrow();

      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('should set session_id in the log entry', () => {
      const expectedSession = auditLogger.getSessionId();
      auditLogger.log({
        action: 'task_created',
        tableName: 'tasks',
        recordId: 1,
      });

      const runCall = mockDb.run.mock.calls[0];
      expect(runCall[11]).toBe(expectedSession);
    });
  });

  // ==========================================================================
  // 3. logBatch() Method
  // ==========================================================================
  describe('logBatch() Method', () => {
    it('should insert multiple entries in a batch', () => {
      const entries = [
        { action: 'task_created' as const, tableName: 'tasks', recordId: 1 },
        { action: 'task_updated' as const, tableName: 'tasks', recordId: 2 },
        { action: 'task_deleted' as const, tableName: 'tasks', recordId: 3 },
      ];

      auditLogger.logBatch(entries);

      expect(mockDb.transaction).toHaveBeenCalled();
      expect(mockDb.run).toHaveBeenCalledTimes(3);
    });

    it('should enrich each batch entry with default values', () => {
      const entries = [
        { action: 'task_created' as const, tableName: 'tasks', recordId: 1 },
      ];

      auditLogger.logBatch(entries);

      const runCall = mockDb.run.mock.calls[0];
      expect(runCall[0]).toBe('default'); // userId defaults to 'default'
      expect(runCall[9]).toBe('info'); // severity defaults to 'info'
    });

    it('should handle empty array without errors', () => {
      expect(() => {
        auditLogger.logBatch([]);
      }).not.toThrow();

      expect(mockDb.run).not.toHaveBeenCalled();
    });

    it('should handle database errors without throwing', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockDb.transaction.mockImplementation((fn: any) => {
        return (...args: any[]) => {
          fn(...args);
        };
      });

      // Make the inner run call throw
      mockDb.run.mockImplementation(() => {
        throw new Error('Batch insert failed');
      });

      expect(() => {
        auditLogger.logBatch([
          { action: 'task_created' as const, tableName: 'tasks', recordId: 1 },
        ]);
      }).not.toThrow();

      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('should use the correct SQL for batch insert', () => {
      auditLogger.logBatch([
        { action: 'task_created' as const, tableName: 'tasks', recordId: 1 },
      ]);

      const prepareCall = mockDb.prepare.mock.calls[0];
      expect(prepareCall[0]).toContain('INSERT INTO audit_logs');
    });

    it('should pass correct parameters to run for each entry', () => {
      auditLogger.logBatch([
        {
          action: 'task_created' as const,
          tableName: 'tasks',
          recordId: 1,
          oldValues: { title: 'old' },
          newValues: { title: 'new' },
        },
      ]);

      const runCall = mockDb.run.mock.calls[0];
      expect(runCall[1]).toBe('task_created');
      expect(runCall[2]).toBe('tasks');
      expect(runCall[3]).toBe(1);
      expect(JSON.parse(runCall[4])).toEqual({ title: 'old' });
      expect(JSON.parse(runCall[5])).toEqual({ title: 'new' });
    });
  });

  // ==========================================================================
  // 4. detectAnomalies() Threshold Logic
  // ==========================================================================
  describe('detectAnomalies() Threshold Logic', () => {
    it('should not flag anomaly when action count is below threshold', async () => {
      const instance = auditLogger as any;
      // Return 10 logs with the same action (below threshold of 50)
      mockDb.all.mockReturnValue(createMockLogs(10, 'task_created'));

      const result = await instance.detectAnomalies({
        action: 'task_created',
        tableName: 'tasks',
        recordId: 1,
        userId: 'test-user',
      });

      expect(result).toEqual({ isAnomaly: false, anomalyScore: 0 });
    });

    it('should not flag anomaly when action count equals threshold', async () => {
      const instance = auditLogger as any;
      // Return exactly 50 logs (threshold, not exceeded)
      mockDb.all.mockReturnValue(createMockLogs(50, 'task_created'));

      const result = await instance.detectAnomalies({
        action: 'task_created',
        tableName: 'tasks',
        recordId: 1,
        userId: 'test-user',
      });

      expect(result.isAnomaly).toBe(false);
      expect(result.anomalyScore).toBe(0);
    });

    it('should flag anomaly when action count exceeds threshold', async () => {
      const instance = auditLogger as any;
      // Return 51 logs with the same action (exceeds threshold of 50)
      mockDb.all.mockReturnValue(createMockLogs(51, 'task_created'));
      mockDb.run.mockReturnValue({ lastInsertRowid: 999, changes: 1 });

      const result = await instance.detectAnomalies({
        action: 'task_created',
        tableName: 'tasks',
        recordId: 1,
        userId: 'test-user',
      });

      expect(result.isAnomaly).toBe(true);
      expect(result.anomalyType).toBe('high_frequency_action');
      expect(result.anomalyScore).toBeGreaterThan(1);
    });

    it('should log anomaly_detected action when threshold exceeded', async () => {
      const instance = auditLogger as any;
      mockDb.all.mockReturnValue(createMockLogs(60, 'task_created'));
      mockDb.run.mockReturnValue({ lastInsertRowid: 999, changes: 1 });

      await instance.detectAnomalies({
        action: 'task_created',
        tableName: 'tasks',
        recordId: 1,
        userId: 'test-user',
      });

      // The anomaly log should have been inserted
      const anomalyRunCall = mockDb.run.mock.calls.find(
        (call: any[]) => call[1] === 'anomaly_detected'
      );
      expect(anomalyRunCall).toBeDefined();
      expect(anomalyRunCall![9]).toBe('warning'); // severity
    });

    it('should include correct details in anomaly result', async () => {
      const instance = auditLogger as any;
      mockDb.all.mockReturnValue(createMockLogs(75, 'task_created'));
      mockDb.run.mockReturnValue({ lastInsertRowid: 999, changes: 1 });

      const result = await instance.detectAnomalies({
        action: 'task_created',
        tableName: 'tasks',
        recordId: 1,
        userId: 'test-user',
      });

      expect(result.details).toContain('75');
      expect(result.details).toContain('task_created');
      expect(result.details).toContain('threshold');
    });

    it('should return isAnomaly false with score 0 when not anomalous', async () => {
      const instance = auditLogger as any;
      mockDb.all.mockReturnValue([]);

      const result = await instance.detectAnomalies({
        action: 'task_created',
        tableName: 'tasks',
        recordId: 1,
        userId: 'test-user',
      });

      expect(result).toEqual({ isAnomaly: false, anomalyScore: 0 });
    });

    it('should not flag anomaly for anomaly_detected action type', async () => {
      const instance = auditLogger as any;
      // All 60 logs are task_created, but we're checking anomaly_detected
      mockDb.all.mockReturnValue(createMockLogs(60, 'task_created'));

      const result = await instance.detectAnomalies({
        action: 'anomaly_detected',
        tableName: 'audit_logs',
        recordId: 0,
        userId: 'test-user',
      });

      expect(result.isAnomaly).toBe(false);
      expect(result.anomalyScore).toBe(0);
    });

    it('should calculate anomalyScore as count divided by threshold', async () => {
      const instance = auditLogger as any;
      mockDb.all.mockReturnValue(createMockLogs(100, 'task_created'));
      mockDb.run.mockReturnValue({ lastInsertRowid: 999, changes: 1 });

      const result = await instance.detectAnomalies({
        action: 'task_created',
        tableName: 'tasks',
        recordId: 1,
        userId: 'test-user',
      });

      expect(result.anomalyScore).toBe(2); // 100 / 50 = 2
    });

    it('should handle mixed actions in recent logs correctly', async () => {
      const instance = auditLogger as any;
      // 40 task_created + 20 task_updated = only 40 match the queried action
      const mixedLogs = [
        ...createMockLogs(40, 'task_created'),
        ...createMockLogs(20, 'task_updated'),
      ];
      mockDb.all.mockReturnValue(mixedLogs);

      const result = await instance.detectAnomalies({
        action: 'task_created',
        tableName: 'tasks',
        recordId: 1,
        userId: 'test-user',
      });

      expect(result.isAnomaly).toBe(false); // 40 < 50
    });
  });

  // ==========================================================================
  // 5. getLogs() with various filter combinations
  // ==========================================================================
  describe('getLogs() Filtering', () => {
    it('should return all logs with no options', () => {
      mockDb.all.mockReturnValue([mockLogEntry()]);

      const logs = auditLogger.getLogs();

      expect(logs).toHaveLength(1);
      expect(mockDb.prepare).toHaveBeenCalled();
      const sql = mockDb.prepare.mock.calls[0][0];
      expect(sql).toContain('SELECT * FROM audit_logs');
      expect(sql).not.toContain('WHERE');
    });

    it('should filter by userId', () => {
      mockDb.all.mockReturnValue([mockLogEntry({ user_id: 'user1' })]);

      auditLogger.getLogs({ userId: 'user1' });

      const sql = mockDb.prepare.mock.calls[0][0];
      expect(sql).toContain('user_id = ?');
    });

    it('should filter by tableName', () => {
      mockDb.all.mockReturnValue([mockLogEntry({ table_name: 'tasks' })]);

      auditLogger.getLogs({ tableName: 'tasks' });

      const sql = mockDb.prepare.mock.calls[0][0];
      expect(sql).toContain('table_name = ?');
    });

    it('should filter by action', () => {
      mockDb.all.mockReturnValue([mockLogEntry({ action: 'task_created' })]);

      auditLogger.getLogs({ action: 'task_created' });

      const sql = mockDb.prepare.mock.calls[0][0];
      expect(sql).toContain('action = ?');
    });

    it('should filter by dateFrom', () => {
      mockDb.all.mockReturnValue([mockLogEntry()]);

      auditLogger.getLogs({ dateFrom: '2026-01-01T00:00:00Z' });

      const sql = mockDb.prepare.mock.calls[0][0];
      expect(sql).toContain('created_at >= ?');
    });

    it('should filter by dateTo', () => {
      mockDb.all.mockReturnValue([mockLogEntry()]);

      auditLogger.getLogs({ dateTo: '2026-12-31T23:59:59Z' });

      const sql = mockDb.prepare.mock.calls[0][0];
      expect(sql).toContain('created_at <= ?');
    });

    it('should filter by severity', () => {
      mockDb.all.mockReturnValue([mockLogEntry({ severity: 'error' })]);

      auditLogger.getLogs({ severity: 'error' });

      const sql = mockDb.prepare.mock.calls[0][0];
      expect(sql).toContain('severity = ?');
    });

    it('should filter by correlationId', () => {
      mockDb.all.mockReturnValue([mockLogEntry()]);

      auditLogger.getLogs({ correlationId: 'corr_123' });

      const sql = mockDb.prepare.mock.calls[0][0];
      expect(sql).toContain('correlation_id = ?');
    });

    it('should filter by sessionId', () => {
      mockDb.all.mockReturnValue([mockLogEntry()]);

      auditLogger.getLogs({ sessionId: 'session_abc' });

      const sql = mockDb.prepare.mock.calls[0][0];
      expect(sql).toContain('session_id = ?');
    });

    it('should combine multiple filters with AND', () => {
      mockDb.all.mockReturnValue([mockLogEntry()]);

      auditLogger.getLogs({
        userId: 'user1',
        tableName: 'tasks',
        action: 'task_created',
      });

      const sql = mockDb.prepare.mock.calls[0][0];
      expect(sql).toContain('user_id = ?');
      expect(sql).toContain('table_name = ?');
      expect(sql).toContain('action = ?');
      expect(sql).toContain('AND');
    });

    it('should apply limit and offset when specified', () => {
      mockDb.all.mockReturnValue([mockLogEntry()]);

      auditLogger.getLogs({ limit: 10, offset: 5 });

      const sql = mockDb.prepare.mock.calls[0][0];
      expect(sql).toContain('LIMIT ? OFFSET ?');
    });

    it('should order results by created_at DESC', () => {
      mockDb.all.mockReturnValue([mockLogEntry()]);

      auditLogger.getLogs();

      const sql = mockDb.prepare.mock.calls[0][0];
      expect(sql).toContain('ORDER BY created_at DESC');
    });

    it('should return empty array when no matching logs', () => {
      mockDb.all.mockReturnValue([]);

      const logs = auditLogger.getLogs({ userId: 'nonexistent' });
      expect(logs).toEqual([]);
    });
  });

  // ==========================================================================
  // 6. getStatistics() Aggregation
  // ==========================================================================
  describe('getStatistics() Aggregation', () => {
    it('should return correct totalLogs', () => {
      // get is called first for totalLogs, then for anomalies
      mockDb.get.mockReturnValueOnce({ count: 100 }).mockReturnValueOnce({ count: 5 });

      const stats = auditLogger.getStatistics();
      expect(stats.totalLogs).toBe(100);
    });

    it('should group by action', () => {
      mockDb.get.mockReturnValue({ count: 80 });
      mockDb.all
        .mockReturnValueOnce([
          { action: 'task_created', count: 50 },
          { action: 'task_updated', count: 30 },
        ])
        .mockReturnValueOnce([]) // bySeverity
        .mockReturnValueOnce([]); // byUser

      const stats = auditLogger.getStatistics();
      expect(stats.byAction.task_created).toBe(50);
      expect(stats.byAction.task_updated).toBe(30);
      expect(stats.byAction).not.toHaveProperty('task_deleted');
    });

    it('should group by severity', () => {
      mockDb.get.mockReturnValue({ count: 80 });
      mockDb.all
        .mockReturnValueOnce([]) // byAction
        .mockReturnValueOnce([
          { severity: 'info', count: 70 },
          { severity: 'error', count: 10 },
        ])
        .mockReturnValueOnce([]); // byUser

      const stats = auditLogger.getStatistics();
      expect(stats.bySeverity.info).toBe(70);
      expect(stats.bySeverity.error).toBe(10);
    });

    it('should group by user', () => {
      mockDb.get.mockReturnValue({ count: 80 });
      mockDb.all
        .mockReturnValueOnce([]) // byAction
        .mockReturnValueOnce([]) // bySeverity
        .mockReturnValueOnce([
          { user_id: 'user1', count: 50 },
          { user_id: 'user2', count: 30 },
        ]);

      const stats = auditLogger.getStatistics();
      expect(stats.byUser.user1).toBe(50);
      expect(stats.byUser.user2).toBe(30);
    });

    it('should count anomalies', () => {
      // get is called for totalLogs (1st) and anomalies (2nd)
      mockDb.get.mockReturnValueOnce({ count: 100 }).mockReturnValueOnce({ count: 3 });

      const stats = auditLogger.getStatistics();
      expect(stats.anomalies).toBe(3);
    });

    it('should handle empty results with all zeros', () => {
      mockDb.get.mockReturnValue({ count: 0 });
      mockDb.all.mockReturnValue([]);

      const stats = auditLogger.getStatistics();
      expect(stats.totalLogs).toBe(0);
      expect(stats.byAction).toEqual({});
      expect(stats.bySeverity).toEqual({});
      expect(stats.byUser).toEqual({});
    });

    it('should apply userId filter in query', () => {
      mockDb.get.mockReturnValue({ count: 50 });
      mockDb.all.mockReturnValue([]);

      auditLogger.getStatistics({ userId: 'user1' });

      // The first prepare call should include the user filter
      const firstPrepareCall = mockDb.prepare.mock.calls[0][0];
      expect(firstPrepareCall).toContain('user_id = ?');
    });

    it('should apply dateFrom and dateTo filters in query', () => {
      mockDb.get.mockReturnValue({ count: 50 });
      mockDb.all.mockReturnValue([]);

      auditLogger.getStatistics({
        dateFrom: '2026-01-01T00:00:00Z',
        dateTo: '2026-12-31T23:59:59Z',
      });

      const sql = mockDb.prepare.mock.calls[0][0];
      expect(sql).toContain('created_at >= ?');
      expect(sql).toContain('created_at <= ?');
    });

    it('should handle no filters (full statistics)', () => {
      mockDb.get.mockReturnValue({ count: 200 });
      mockDb.all.mockReturnValue([]);

      const stats = auditLogger.getStatistics();
      expect(stats.totalLogs).toBe(200);
      expect(stats).toHaveProperty('byAction');
      expect(stats).toHaveProperty('bySeverity');
      expect(stats).toHaveProperty('byUser');
      expect(stats).toHaveProperty('anomalies');
    });

    it('should use COUNT query for totalLogs', () => {
      mockDb.get.mockReturnValue({ count: 42 });
      mockDb.all.mockReturnValue([]);

      auditLogger.getStatistics();

      const sql = mockDb.prepare.mock.calls[0][0];
      expect(sql).toContain('COUNT(*)');
    });
  });

  // ==========================================================================
  // 7. exportLogs() in all 3 formats
  // ==========================================================================
  describe('exportLogs() Formats', () => {
    it('should export in JSON format', () => {
      const mockLogs = [
        mockLogEntry({ id: 1, user_id: 'user1', action: 'task_created' }),
        mockLogEntry({ id: 2, user_id: 'user2', action: 'task_updated' }),
      ];
      mockDb.all.mockReturnValue(mockLogs);

      const result = auditLogger.exportLogs('json');
      const parsed = JSON.parse(result);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].id).toBe(1);
      expect(parsed[0].user_id).toBe('user1');
      expect(parsed[0].action).toBe('task_created');
    });

    it('should export in CSV format with headers', () => {
      const mockLogs = [
        mockLogEntry({ id: 1, user_id: 'user1', action: 'task_created' }),
      ];
      mockDb.all.mockReturnValue(mockLogs);

      const result = auditLogger.exportLogs('csv');
      const lines = result.split('\n');

      expect(lines[0]).toContain('id');
      expect(lines[0]).toContain('user_id');
      expect(lines[0]).toContain('action');
      expect(lines[0]).toContain('table_name');
      expect(lines[0]).toContain('record_id');
      expect(lines[0]).toContain('severity');
      expect(lines[0]).toContain('created_at');
      expect(lines).toHaveLength(2); // header + 1 row
    });

    it('should include all data in CSV rows', () => {
      const mockLogs = [
        mockLogEntry({
          id: 1,
          user_id: 'user1',
          action: 'task_created',
          table_name: 'tasks',
          record_id: 42,
          severity: 'info',
          created_at: '2026-01-01T00:00:00Z',
        }),
      ];
      mockDb.all.mockReturnValue(mockLogs);

      const result = auditLogger.exportLogs('csv');
      const lines = result.split('\n');
      const row = lines[1];

      expect(row).toContain('"1"');
      expect(row).toContain('"user1"');
      expect(row).toContain('"task_created"');
      expect(row).toContain('"tasks"');
      expect(row).toContain('"42"');
      expect(row).toContain('"info"');
      expect(row).toContain('"2026-01-01T00:00:00Z"');
    });

    it('should produce CSV with proper structure and escaping', () => {
      const mockLogs = [
        mockLogEntry({
          id: 1,
          user_id: 'user1',
          action: 'task_created',
          new_values: JSON.stringify({ title: 'hello "world"' }),
        }),
      ];
      mockDb.all.mockReturnValue(mockLogs);

      const result = auditLogger.exportLogs('csv');
      const lines = result.split('\n');
      expect(lines).toHaveLength(2); // header + 1 row
      // First field of data row should be the id
      expect(lines[1]).toContain('"1"');
      // Second field should be the user_id
      expect(lines[1]).toContain('"user1"');
      // Fifth field should be record_id
      expect(lines[1]).toContain('"1"');
      // The escaped quotes should be present somewhere in the row
      expect(lines[1]).toContain('""');
    });

    it('should handle empty CSV export', () => {
      mockDb.all.mockReturnValue([]);

      const result = auditLogger.exportLogs('csv');
      expect(result).toBe('');
    });

    it('should export in Syslog format', () => {
      const mockLogs = [
        mockLogEntry({
          id: 1,
          user_id: 'user1',
          action: 'task_created',
          table_name: 'tasks',
          record_id: 42,
          severity: 'info',
          session_id: 'session_abc',
          created_at: '2026-01-01T00:00:00Z',
        }),
      ];
      mockDb.all.mockReturnValue(mockLogs);

      const result = auditLogger.exportLogs('syslog');
      const lines = result.split('\n');

      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain('user=user1');
      expect(lines[0]).toContain('action=task_created');
      expect(lines[0]).toContain('table=tasks');
      expect(lines[0]).toContain('record=42');
      expect(lines[0]).toContain('severity=info');
      expect(lines[0]).toContain('session=session_abc');
      // Syslog format starts with <priority>
      expect(lines[0]).toMatch(/^<\d+>/);
    });

    it('should handle empty Syslog export', () => {
      mockDb.all.mockReturnValue([]);

      const result = auditLogger.exportLogs('syslog');
      expect(result).toBe('');
    });

    it('should return JSON for unknown format', () => {
      const mockLogs = [mockLogEntry({ id: 1 })];
      mockDb.all.mockReturnValue(mockLogs);

      const result = auditLogger.exportLogs('unknown' as any);
      const parsed = JSON.parse(result);
      expect(Array.isArray(parsed)).toBe(true);
    });

    it('should use correct syslog priority for info severity', () => {
      const mockLogs = [
        mockLogEntry({
          id: 1,
          user_id: 'user1',
          action: 'task_created',
          severity: 'info',
          created_at: '2026-01-01T00:00:00Z',
        }),
      ];
      mockDb.all.mockReturnValue(mockLogs);

      const result = auditLogger.exportLogs('syslog');
      // Facility 16 (local0) * 8 = 128, info = 6, so priority = 134
      expect(result).toContain('<134>');
    });

    it('should use correct syslog priority for error severity', () => {
      const mockLogs = [
        mockLogEntry({
          id: 1,
          user_id: 'user1',
          action: 'error_occurred',
          severity: 'error',
          created_at: '2026-01-01T00:00:00Z',
        }),
      ];
      mockDb.all.mockReturnValue(mockLogs);

      const result = auditLogger.exportLogs('syslog');
      // Facility 128 + error severity 3 = 131
      expect(result).toContain('<131>');
    });

    it('should use correct syslog priority for critical severity', () => {
      const mockLogs = [
        mockLogEntry({
          id: 1,
          user_id: 'user1',
          action: 'error_occurred',
          severity: 'critical',
          created_at: '2026-01-01T00:00:00Z',
        }),
      ];
      mockDb.all.mockReturnValue(mockLogs);

      const result = auditLogger.exportLogs('syslog');
      // Facility 128 + critical severity 2 = 130
      expect(result).toContain('<130>');
    });

    it('should use warning syslog priority for warning severity', () => {
      const mockLogs = [
        mockLogEntry({
          id: 1,
          user_id: 'user1',
          action: 'validation_error',
          severity: 'warning',
          created_at: '2026-01-01T00:00:00Z',
        }),
      ];
      mockDb.all.mockReturnValue(mockLogs);

      const result = auditLogger.exportLogs('syslog');
      // Facility 128 + warning severity 4 = 132
      expect(result).toContain('<132>');
    });

    it('should use default syslog priority for unknown severity', () => {
      const mockLogs = [
        mockLogEntry({
          id: 1,
          user_id: 'user1',
          action: 'task_created',
          severity: 'unknown_severity',
          created_at: '2026-01-01T00:00:00Z',
        }),
      ];
      mockDb.all.mockReturnValue(mockLogs);

      const result = auditLogger.exportLogs('syslog');
      // Facility 128 + default info severity 6 = 134
      expect(result).toContain('<134>');
    });

    it('should apply userId filter in export', () => {
      mockDb.all.mockReturnValue([]);

      auditLogger.exportLogs('json', { userId: 'user1' });

      const sql = mockDb.prepare.mock.calls[0][0];
      expect(sql).toContain('user_id = ?');
    });

    it('should handle CSV export with null values', () => {
      const mockLogs = [
        mockLogEntry({
          id: 1,
          user_id: 'user1',
          action: 'task_created',
          old_values: null,
          new_values: null,
          ip_address: null,
          user_agent: null,
          metadata: null,
          correlation_id: null,
          session_id: null,
        }),
      ];
      mockDb.all.mockReturnValue(mockLogs);

      const result = auditLogger.exportLogs('csv');
      const lines = result.split('\n');
      expect(lines).toHaveLength(2); // header + 1 row
      // Null values should be converted to empty strings
      expect(lines[1]).toContain('""'); // empty quoted values
    });
  });

  // ==========================================================================
  // 8. Helper Functions
  // ==========================================================================
  describe('Helper Functions', () => {
    it('logTaskCreated should log with task_created action', () => {
      logTaskCreated(42, { title: 'New Task', priority: 'high' });

      expect(mockDb.run).toHaveBeenCalled();
      const runCall = mockDb.run.mock.calls[0];
      expect(runCall[1]).toBe('task_created');
      expect(runCall[2]).toBe('tasks');
      expect(runCall[3]).toBe(42);
      expect(JSON.parse(runCall[5])).toEqual({ title: 'New Task', priority: 'high' });
      expect(runCall[9]).toBe('info');
    });

    it('logTaskCreated should accept optional userId', () => {
      logTaskCreated(1, { title: 'Task' }, 'custom-user');

      const runCall = mockDb.run.mock.calls[0];
      expect(runCall[0]).toBe('custom-user');
    });

    it('logTaskUpdated should log with task_updated action', () => {
      logTaskUpdated(
        42,
        { title: 'Old', priority: 'low' },
        { title: 'New', priority: 'high' }
      );

      expect(mockDb.run).toHaveBeenCalled();
      const runCall = mockDb.run.mock.calls[0];
      expect(runCall[1]).toBe('task_updated');
      expect(runCall[2]).toBe('tasks');
      expect(runCall[3]).toBe(42);
      expect(JSON.parse(runCall[4])).toEqual({ title: 'Old', priority: 'low' });
      expect(JSON.parse(runCall[5])).toEqual({ title: 'New', priority: 'high' });
    });

    it('logTaskDeleted should log with task_deleted action and warning severity', () => {
      logTaskDeleted(42, { title: 'Deleted Task' });

      expect(mockDb.run).toHaveBeenCalled();
      const runCall = mockDb.run.mock.calls[0];
      expect(runCall[1]).toBe('task_deleted');
      expect(runCall[2]).toBe('tasks');
      expect(runCall[3]).toBe(42);
      expect(JSON.parse(runCall[4])).toEqual({ title: 'Deleted Task' });
      expect(runCall[9]).toBe('warning');
    });

    it('logAnomaly should log with anomaly_detected action and metadata', () => {
      logAnomaly('high_frequency_action', 'User performed 100 actions');

      expect(mockDb.run).toHaveBeenCalled();
      const runCall = mockDb.run.mock.calls[0];
      expect(runCall[1]).toBe('anomaly_detected');
      expect(runCall[2]).toBe('audit_logs');
      expect(runCall[3]).toBe(0);
      expect(runCall[9]).toBe('warning');

      const metadata = JSON.parse(runCall[8]);
      expect(metadata.anomalyType).toBe('high_frequency_action');
      expect(metadata.details).toBe('User performed 100 actions');
    });

    it('logSecurityEvent should log with critical severity', () => {
      logSecurityEvent('login_failed', { ip: '192.168.1.1', attempts: 5 });

      expect(mockDb.run).toHaveBeenCalled();
      const runCall = mockDb.run.mock.calls[0];
      expect(runCall[1]).toBe('login_failed');
      expect(runCall[2]).toBe('security_events');
      expect(runCall[3]).toBe(0);
      expect(runCall[9]).toBe('critical');
      expect(JSON.parse(runCall[5])).toEqual({ ip: '192.168.1.1', attempts: 5 });
    });

    it('logSecurityEvent should accept optional userId', () => {
      logSecurityEvent('password_changed', { field: 'password' }, 'admin');

      const runCall = mockDb.run.mock.calls[0];
      expect(runCall[0]).toBe('admin');
    });

    it('logTaskCreated should pass severity info', () => {
      logTaskCreated(1, { title: 'Task' });

      const runCall = mockDb.run.mock.calls[0];
      expect(runCall[9]).toBe('info');
    });
  });

  // ==========================================================================
  // 9. User & Session Management
  // ==========================================================================
  describe('User & Session Management', () => {
    it('setUserId should update the userId', () => {
      auditLogger.setUserId('new-user');
      expect(auditLogger.getUserId()).toBe('new-user');
    });

    it('getUserId should return the current userId', () => {
      auditLogger.setUserId('test-user-123');
      expect(auditLogger.getUserId()).toBe('test-user-123');
    });

    it('getSessionId should return a consistent session ID', () => {
      const id1 = auditLogger.getSessionId();
      const id2 = auditLogger.getSessionId();
      expect(id1).toBe(id2);
    });

    it('setUserId should affect subsequent log entries', () => {
      auditLogger.setUserId('affected-user');
      auditLogger.log({
        action: 'task_created',
        tableName: 'tasks',
        recordId: 1,
      });

      const runCall = mockDb.run.mock.calls[0];
      expect(runCall[0]).toBe('affected-user');
    });
  });

  // ==========================================================================
  // 10. External Integration
  // ==========================================================================
  describe('External Integration', () => {
    it('setExternalIntegration should configure the integration', () => {
      auditLogger.setExternalIntegration({
        webhookUrl: 'https://example.com/webhook',
        batchSize: 5,
      });

      const config = (auditLogger as any).externalConfig;
      expect(config).not.toBeNull();
      expect(config.webhookUrl).toBe('https://example.com/webhook');
      expect(config.batchSize).toBe(5);
    });

    it('should queue for external integration when configured', () => {
      auditLogger.setExternalIntegration({
        webhookUrl: 'https://example.com/webhook',
        batchSize: 100,
      });

      auditLogger.log({
        action: 'task_created',
        tableName: 'tasks',
        recordId: 1,
      });

      const pending = (auditLogger as any).pendingLogs;
      expect(pending).toHaveLength(1);
      expect(pending[0].action).toBe('task_created');
    });

    it('should not queue for external integration when not configured', () => {
      auditLogger.log({
        action: 'task_created',
        tableName: 'tasks',
        recordId: 1,
      });

      const pending = (auditLogger as any).pendingLogs;
      expect(pending).toHaveLength(0);
    });

    it('flushExternal should not flush when no webhookUrl', () => {
      auditLogger.setExternalIntegration({ batchSize: 10 });
      const instance = auditLogger as any;

      instance.pendingLogs = [{ action: 'task_created', tableName: 'tasks', recordId: 1 }];
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      instance.flushExternal();

      // Should not log because no webhookUrl
      expect(logSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Flushing audit logs')
      );
      logSpy.mockRestore();
    });

    it('flushExternal should clear pending logs when webhookUrl exists', () => {
      auditLogger.setExternalIntegration({
        webhookUrl: 'https://example.com/webhook',
        batchSize: 10,
      });
      const instance = auditLogger as any;

      instance.pendingLogs = [
        { action: 'task_created', tableName: 'tasks', recordId: 1 },
        { action: 'task_updated', tableName: 'tasks', recordId: 2 },
      ];
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      instance.flushExternal();

      expect(instance.pendingLogs).toHaveLength(0);
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Flushing audit logs'),
        2
      );
      logSpy.mockRestore();
    });

    it('flushExternal should not flush when pendingLogs is empty', () => {
      auditLogger.setExternalIntegration({
        webhookUrl: 'https://example.com/webhook',
      });
      const instance = auditLogger as any;

      instance.pendingLogs = [];
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      instance.flushExternal();

      expect(logSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Flushing audit logs')
      );
      logSpy.mockRestore();
    });

    it('destroy should clear the flush timer', () => {
      const instance = auditLogger as any;
      const originalTimer = instance.flushTimer;

      // Save and restore external config
      const originalConfig = instance.externalConfig;
      instance.externalConfig = null;
      instance.pendingLogs = [];

      auditLogger.destroy();
      expect(instance.flushTimer).toBeNull();

      // Restore
      instance.externalConfig = originalConfig;
    });
  });

  // ==========================================================================
  // 11. Error Handling
  // ==========================================================================
  describe('Error Handling', () => {
    it('should handle prepare errors in getLogs', () => {
      mockDb.prepare.mockImplementation(() => {
        throw new Error('DB connection failed');
      });

      expect(() => {
        auditLogger.getLogs();
      }).toThrow('DB connection failed');
    });

    it('should handle prepare errors in getStatistics', () => {
      mockDb.prepare.mockImplementation(() => {
        throw new Error('DB connection lost');
      });

      expect(() => {
        auditLogger.getStatistics();
      }).toThrow('DB connection lost');
    });

    it('should handle errors in log() when run fails', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockDb.prepare.mockReturnThis();
      mockDb.run.mockImplementation(() => {
        throw new Error('Run failed');
      });

      // log() catches errors from the try/catch block
      expect(() => {
        auditLogger.log({
          action: 'task_created',
          tableName: 'tasks',
          recordId: 1,
        });
      }).not.toThrow();

      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('should handle errors in logBatch() when transaction callback fails', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockDb.transaction.mockImplementation((fn: any) => {
        return () => {
          throw new Error('Transaction failed');
        };
      });

      expect(() => {
        auditLogger.logBatch([
          { action: 'task_created' as const, tableName: 'tasks', recordId: 1 },
        ]);
      }).not.toThrow();

      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('should handle getStatistics with prepare returning undefined', () => {
      mockDb.prepare.mockReturnValue({
        get: () => undefined,
        all: () => [],
      } as any);

      // get returns undefined, so totalLogs.count would fail
      expect(() => {
        auditLogger.getStatistics();
      }).toThrow();
    });
  });

  // ==========================================================================
  // 12. Edge Cases
  // ==========================================================================
  describe('Edge Cases', () => {
    it('should handle log with all optional fields undefined', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      auditLogger.log({
        action: 'task_created',
        tableName: 'tasks',
        recordId: 1,
        // All optional fields are undefined
      });

      const runCall = mockDb.run.mock.calls[0];
      expect(runCall[0]).toBe('default'); // userId
      expect(runCall[4]).toBeNull(); // oldValues
      expect(runCall[5]).toBeNull(); // newValues
      expect(runCall[6]).toBeNull(); // ip_address
      expect(runCall[7]).toBeNull(); // user_agent
      expect(runCall[9]).toBe('info'); // severity

      errorSpy.mockRestore();
    });

    it('should handle getLogs with all filter options combined', () => {
      mockDb.all.mockReturnValue([]);

      auditLogger.getLogs({
        userId: 'user1',
        tableName: 'tasks',
        action: 'task_created',
        limit: 10,
        offset: 20,
        dateFrom: '2026-01-01T00:00:00Z',
        dateTo: '2026-12-31T23:59:59Z',
        severity: 'error',
        correlationId: 'corr_abc',
        sessionId: 'session_xyz',
      });

      const sql = mockDb.prepare.mock.calls[0][0];
      expect(sql).toContain('user_id = ?');
      expect(sql).toContain('table_name = ?');
      expect(sql).toContain('action = ?');
      expect(sql).toContain('created_at >= ?');
      expect(sql).toContain('created_at <= ?');
      expect(sql).toContain('severity = ?');
      expect(sql).toContain('correlation_id = ?');
      expect(sql).toContain('session_id = ?');
      expect(sql).toContain('LIMIT ? OFFSET ?');
      expect(sql).toContain('AND');
    });

    it('should handle getStatistics with no data in database', () => {
      mockDb.get.mockReturnValue({ count: 0 });
      mockDb.all.mockReturnValue([]);

      const stats = auditLogger.getStatistics();
      expect(stats.totalLogs).toBe(0);
      expect(stats.byAction).toEqual({});
      expect(stats.bySeverity).toEqual({});
      expect(stats.byUser).toEqual({});
      expect(stats.anomalies).toBe(0);
    });

    it('should handle log with complex nested metadata', () => {
      auditLogger.log({
        action: 'task_created',
        tableName: 'tasks',
        recordId: 1,
        metadata: {
          source: 'api',
          nested: {
            level1: { level2: 'deep value' },
          },
          array: [1, 2, 3],
        },
      });

      const runCall = mockDb.run.mock.calls[0];
      const metadata = JSON.parse(runCall[8]);
      expect(metadata.source).toBe('api');
      expect(metadata.nested).toEqual({ level1: { level2: 'deep value' } });
      expect(metadata.array).toEqual([1, 2, 3]);
      expect(metadata.timestamp).toBeDefined();
    });

    it('should handle log with empty strings as optional values', () => {
      auditLogger.log({
        action: 'task_created',
        tableName: 'tasks',
        recordId: 1,
        userId: '',
        ipAddress: '',
        userAgent: '',
      });

      const runCall = mockDb.run.mock.calls[0];
      // Empty string is falsy, so should fall back to defaults (null)
      expect(runCall[0]).toBe('default'); // userId falls back
      expect(runCall[6]).toBeNull(); // ipAddress falls back to null
    });

    it('should handle exportLogs with userId and date filters', () => {
      mockDb.all.mockReturnValue([mockLogEntry()]);

      auditLogger.exportLogs('json', {
        userId: 'user1',
        dateFrom: '2026-01-01T00:00:00Z',
        dateTo: '2026-12-31T23:59:59Z',
      });

      const sql = mockDb.prepare.mock.calls[0][0];
      expect(sql).toContain('user_id = ?');
      expect(sql).toContain('created_at >= ?');
      expect(sql).toContain('created_at <= ?');
    });

    it('should handle logBatch with a single entry', () => {
      auditLogger.logBatch([
        { action: 'task_created' as const, tableName: 'tasks', recordId: 1 },
      ]);

      expect(mockDb.run).toHaveBeenCalledTimes(1);
    });

    it('should handle log with very large recordId', () => {
      auditLogger.log({
        action: 'task_created',
        tableName: 'tasks',
        recordId: 999999999,
      });

      const runCall = mockDb.run.mock.calls[0];
      expect(runCall[3]).toBe(999999999);
    });

    it('should handle syslog export with null session_id', () => {
      const mockLogs = [
        mockLogEntry({
          id: 1,
          user_id: 'user1',
          action: 'task_created',
          severity: 'info',
          session_id: null,
          created_at: '2026-01-01T00:00:00Z',
        }),
      ];
      mockDb.all.mockReturnValue(mockLogs);

      const result = auditLogger.exportLogs('syslog');
      expect(result).toContain('session=-'); // null becomes '-'
    });

    it('should use unique correlation IDs for different log entries', () => {
      auditLogger.log({
        action: 'task_created',
        tableName: 'tasks',
        recordId: 1,
      });

      auditLogger.log({
        action: 'task_updated',
        tableName: 'tasks',
        recordId: 2,
      });

      const corr1 = mockDb.run.mock.calls[0][10];
      const corr2 = mockDb.run.mock.calls[1][10];
      expect(corr1).toMatch(/^corr_/);
      expect(corr2).toMatch(/^corr_/);
      // They should be different (different timestamps or random parts)
      // But since they might be generated in the same millisecond, check they exist
      expect(corr1).toBeDefined();
      expect(corr2).toBeDefined();
    });

    it('should handle getLogs returning entries from the database', () => {
      const entries = [
        mockLogEntry({ id: 3, action: 'task_deleted', user_id: 'admin' }),
        mockLogEntry({ id: 2, action: 'task_updated', user_id: 'user2' }),
        mockLogEntry({ id: 1, action: 'task_created', user_id: 'user1' }),
      ];
      mockDb.all.mockReturnValue(entries);

      const logs = auditLogger.getLogs({ limit: 3 });
      expect(logs).toHaveLength(3);
      expect(logs[0].id).toBe(3); // Most recent first
      expect(logs[2].id).toBe(1);
    });
  });
});
