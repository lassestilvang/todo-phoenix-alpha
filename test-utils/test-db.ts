/**
 * Test database utilities for integration testing
 * Provides an in-memory SQLite database for tests
 */
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let testDb: Database.Database | null = null;

/**
 * Initialize the test database with the application schema
 */
export function initTestDb(): Database.Database {
  // Create in-memory database
  testDb = new Database(':memory:');

  // Read and execute schema
  const schemaPath = path.join(__dirname, '..', 'src', 'lib', 'db', 'schema.ts');

  // We'll manually apply the schema here since we can't import TypeScript
  testDb.exec(`
    -- Enable foreign keys
    PRAGMA foreign_keys = ON;

    -- Lists table
    CREATE TABLE IF NOT EXISTS lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#3B82F6',
      emoji TEXT DEFAULT '📝',
      icon TEXT DEFAULT 'list',
      is_inbox BOOLEAN DEFAULT 0,
      is_smart BOOLEAN DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Tasks table
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      list_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      date TEXT,
      deadline TEXT,
      estimate_minutes INTEGER DEFAULT 0,
      priority TEXT DEFAULT 'none',
      is_recurring INTEGER DEFAULT 0,
      recurring_pattern TEXT,
      recurring_custom_value TEXT,
      is_completed INTEGER DEFAULT 0,
      completed_at TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE
    );

    -- Subtasks table
    CREATE TABLE IF NOT EXISTS subtasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      is_completed INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    -- Labels table
    CREATE TABLE IF NOT EXISTS labels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#6B7280',
      emoji TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Task labels join table
    CREATE TABLE IF NOT EXISTS task_labels (
      task_id INTEGER NOT NULL,
      label_id INTEGER NOT NULL,
      PRIMARY KEY (task_id, label_id),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
    );

    -- Reminders table
    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      time TEXT NOT NULL,
      is_sent INTEGER DEFAULT 0,
      sent_at TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    -- Attachments table
    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_data TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    -- Time entries table
    CREATE TABLE IF NOT EXISTS time_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      started_at TEXT NOT NULL,
      stopped_at TEXT,
      duration_minutes INTEGER,
      is_running INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    -- Recurring schedules table
    CREATE TABLE IF NOT EXISTS recurring_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      pattern TEXT NOT NULL,
      interval INTEGER DEFAULT 1,
      interval_unit TEXT DEFAULT 'week',
      start_date TEXT NOT NULL,
      end_date TEXT,
      exclude_dates TEXT DEFAULT '[]',
      next_run TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    -- Task runs table
    CREATE TABLE IF NOT EXISTS task_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recurring_schedule_id INTEGER NOT NULL,
      task_id INTEGER NOT NULL,
      scheduled_date TEXT NOT NULL,
      actual_date TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (recurring_schedule_id) REFERENCES recurring_schedules(id) ON DELETE CASCADE,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    -- Task changes (audit log)
    CREATE TABLE IF NOT EXISTS task_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    -- External integrations
    CREATE TABLE IF NOT EXISTS external_integrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      provider TEXT NOT NULL,
      external_id TEXT NOT NULL,
      sync_status TEXT DEFAULT 'pending',
      last_synced_at TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    -- Notifications table
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      sent_at TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    -- DB Backups table
    CREATE TABLE IF NOT EXISTS db_backups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      backup_type TEXT NOT NULL DEFAULT 'full',
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      checksum TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Templates table
    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      list_id INTEGER,
      template_data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE SET NULL
    );

    -- Time tracking snapshots (for persistence)
    CREATE TABLE IF NOT EXISTS time_tracking_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      is_running INTEGER DEFAULT 0,
      elapsed_time INTEGER DEFAULT 0,
      started_at TEXT,
      snapshot_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    -- Recurring patterns table (for pattern mining)
    CREATE TABLE IF NOT EXISTS recurring_patterns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pattern_name TEXT NOT NULL,
      pattern_type TEXT NOT NULL,
      confidence REAL DEFAULT 0,
      frequency INTEGER DEFAULT 0,
      last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Create indexes for performance
    CREATE INDEX IF NOT EXISTS idx_tasks_list_id ON tasks(list_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks(date);
    CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline);
    CREATE INDEX IF NOT EXISTS idx_tasks_is_completed ON tasks(is_completed);
    CREATE INDEX IF NOT EXISTS idx_tasks_is_recurring ON tasks(is_recurring);
    CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id);
    CREATE INDEX IF NOT EXISTS idx_reminders_task_id ON reminders(task_id);
    CREATE INDEX IF NOT EXISTS idx_reminders_time ON reminders(time);
    CREATE INDEX IF NOT EXISTS idx_reminders_is_sent ON reminders(is_sent);
    CREATE INDEX IF NOT EXISTS idx_attachments_task_id ON attachments(task_id);
    CREATE INDEX IF NOT EXISTS idx_time_entries_task_id ON time_entries(task_id);
    CREATE INDEX IF NOT EXISTS idx_time_entries_is_running ON time_entries(is_running);
    CREATE INDEX IF NOT EXISTS idx_task_changes_task_id ON task_changes(task_id);
    CREATE INDEX IF NOT EXISTS idx_recurring_schedules_task_id ON recurring_schedules(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_runs_scheduled_date ON task_runs(scheduled_date);
    CREATE INDEX IF NOT EXISTS idx_external_integrations_task_id ON external_integrations(task_id);

    -- Insert default Inbox list
    INSERT OR IGNORE INTO lists (id, name, color, emoji, icon, is_inbox, sort_order)
    VALUES (1, 'Inbox', '#3B82F6', '📥', 'inbox', 1, 0);
  `);

  return testDb;
}

/**
 * Get the test database instance
 */
export function getTestDb(): Database.Database {
  if (!testDb) {
    return initTestDb();
  }
  return testDb;
}

/**
 * Close the test database
 */
export function closeTestDb(): void {
  if (testDb) {
    testDb.close();
    testDb = null;
  }
}

/**
 * Reset the test database to initial state
 */
export function resetTestDb(): Database.Database {
  closeTestDb();
  return initTestDb();
}

/**
 * Insert a test task and return its ID
 */
export function createTestTask(
  db: Database.Database,
  overrides: Partial<{
    list_id: number;
    name: string;
    description: string;
    date: string | null;
    deadline: string | null;
    estimate_minutes: number;
    priority: string;
    is_recurring: number;
    recurring_pattern: string | null;
    recurring_custom_value: string | null;
  }> = {}
): number {
  const defaultTask = {
    list_id: 1,
    name: 'Test Task',
    description: 'Test Description',
    date: null,
    deadline: null,
    estimate_minutes: 30,
    priority: 'medium',
    is_recurring: 0,
    recurring_pattern: null,
    recurring_custom_value: null,
    ...overrides,
  };

  const stmt = db.prepare(`
    INSERT INTO tasks (list_id, name, description, date, deadline, estimate_minutes, priority, is_recurring, recurring_pattern, recurring_custom_value)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    defaultTask.list_id,
    defaultTask.name,
    defaultTask.description,
    defaultTask.date,
    defaultTask.deadline,
    defaultTask.estimate_minutes,
    defaultTask.priority,
    defaultTask.is_recurring,
    defaultTask.recurring_pattern,
    defaultTask.recurring_custom_value
  );

  return result.lastInsertRowid as number;
}

/**
 * Create a test list and return its ID
 */
export function createTestList(
  db: Database.Database,
  overrides: Partial<{
    name: string;
    color: string;
    emoji: string;
    icon: string;
    is_inbox: number;
  }> = {}
): number {
  const defaultList = {
    name: 'Test List',
    color: '#3B82F6',
    emoji: '📝',
    icon: 'list',
    is_inbox: 0,
    ...overrides,
  };

  const stmt = db.prepare(`
    INSERT INTO lists (name, color, emoji, icon, is_inbox)
    VALUES (?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    defaultList.name,
    defaultList.color,
    defaultList.emoji,
    defaultList.icon,
    defaultList.is_inbox
  );

  return result.lastInsertRowid as number;
}

/**
 * Create a test reminder and return its ID
 */
export function createTestReminder(
  db: Database.Database,
  taskId: number,
  time: string,
  isSent: number = 0
): number {
  const stmt = db.prepare(`
    INSERT INTO reminders (task_id, time, is_sent)
    VALUES (?, ?, ?)
  `);

  const result = stmt.run(taskId, time, isSent);
  return result.lastInsertRowid as number;
}

/**
 * Create a test attachment and return its ID
 */
export function createTestAttachment(
  db: Database.Database,
  taskId: number,
  filename: string = 'test.txt',
  fileType: string = 'text/plain',
  fileData: string = 'dGVzdA==', // base64 'test'
  fileSize: number = 4
): number {
  const stmt = db.prepare(`
    INSERT INTO attachments (task_id, filename, file_type, file_data, file_size)
    VALUES (?, ?, ?, ?, ?)
  `);

  const result = stmt.run(taskId, filename, fileType, fileData, fileSize);
  return result.lastInsertRowid as number;
}

/**
 * Create a test time entry and return its ID
 */
export function createTestTimeEntry(
  db: Database.Database,
  taskId: number,
  overrides: Partial<{
    started_at: string;
    stopped_at: string | null;
    duration_minutes: number | null;
    is_running: number;
  }> = {}
): number {
  const defaultEntry = {
    started_at: new Date().toISOString(),
    stopped_at: null,
    duration_minutes: null,
    is_running: 1,
    ...overrides,
  };

  const stmt = db.prepare(`
    INSERT INTO time_entries (task_id, started_at, stopped_at, duration_minutes, is_running)
    VALUES (?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    taskId,
    defaultEntry.started_at,
    defaultEntry.stopped_at,
    defaultEntry.duration_minutes,
    defaultEntry.is_running
  );

  return result.lastInsertRowid as number;
}