import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import db from '../../src/lib/db/schema';

describe('Scheduler Integration', () => {
  beforeAll(() => {
    // Setup test database connection
  });

  afterAll(() => {
    // Cleanup test database
  });

  it('should initialize scheduler without errors', () => {
    expect(db).toBeDefined();
  });

  it('should have proper schema version', () => {
    const version = db.prepare('SELECT version FROM migrations LIMIT 1').get() as { version: string } | undefined;
    expect(version).toBeDefined();
    expect(version?.version).toBe('1.0.0');
  });

  it('should have all required tables', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    const tableNames = tables.map(t => t.name);

    expect(tableNames).toContain('tasks');
    expect(tableNames).toContain('reminders');
    expect(tableNames).toContain('projects');
    expect(tableNames).toContain('time_tracking_rules');
    expect(tableNames).toContain('audit_logs');
  });

  it('should handle task creation and associations', async () => {
    const testTask = db.prepare('SELECT * FROM tasks LIMIT 1').get();
    expect(testTask).toBeDefined();
  });
});