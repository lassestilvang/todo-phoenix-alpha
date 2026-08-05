import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'planner.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#6366f1',
    emoji TEXT NOT NULL DEFAULT '📋',
    icon TEXT NOT NULL DEFAULT 'List',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_default INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    date DATE,
    deadline DATETIME,
    estimate_minutes INTEGER DEFAULT 0,
    actual_minutes INTEGER DEFAULT 0,
    priority TEXT DEFAULT 'none' CHECK(priority IN ('high', 'medium', 'low', 'none')),
    is_completed INTEGER DEFAULT 0,
    is_recurring INTEGER DEFAULT 0,
    recurring_pattern TEXT,
    recurring_custom_value TEXT,
    dependencies JSON DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS subtasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    date DATE,
    deadline DATETIME,
    estimate_minutes INTEGER DEFAULT 0,
    actual_minutes INTEGER DEFAULT 0,
    priority TEXT DEFAULT 'none' CHECK(priority IN ('high', 'medium', 'low', 'none')),
    is_completed INTEGER DEFAULT 0,
    is_recurring INTEGER DEFAULT 0,
    recurring_pattern TEXT,
    recurring_custom_value TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS labels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#ec4899',
    emoji TEXT NOT NULL DEFAULT '🏷️',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS task_labels (
    task_id INTEGER NOT NULL,
    label_id INTEGER NOT NULL,
    PRIMARY KEY (task_id, label_id),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS subtask_labels (
    subtask_id INTEGER NOT NULL,
    label_id INTEGER NOT NULL,
    PRIMARY KEY (subtask_id, label_id),
    FOREIGN KEY (subtask_id) REFERENCES subtasks(id) ON DELETE CASCADE,
    FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS task_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS subtask_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subtask_id INTEGER NOT NULL,
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subtask_id) REFERENCES subtasks(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    time DATETIME NOT NULL,
    is_sent INTEGER DEFAULT 0,
    sent_at DATETIME,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS time_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    started_at DATETIME NOT NULL,
    stopped_at DATETIME,
    duration_minutes INTEGER DEFAULT 0,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_list_id ON tasks(list_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks(date);
  CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
  CREATE INDEX IF NOT EXISTS idx_tasks_is_completed ON tasks(is_completed);
  CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id);
  CREATE INDEX IF NOT EXISTS idx_reminders_task_id ON reminders(task_id);
  CREATE INDEX IF NOT EXISTS idx_reminders_time ON reminders(time);
  CREATE INDEX IF NOT EXISTS idx_time_entries_task_id ON time_entries(task_id);
`);

// Create default Inbox list if it doesn't exist
const inboxExists = db.prepare('SELECT id FROM lists WHERE is_default = 1').get() as { id: number } | undefined;
if (!inboxExists) {
  db.prepare(`
    INSERT INTO lists (name, color, emoji, icon, is_default)
    VALUES ('Inbox', '#6366f1', '📥', 'Inbox', 1)
  `).run();
}

// Create projects table for hierarchical organization
const projectsTable = db.prepare(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#3b82f6',
    emoji TEXT NOT NULL DEFAULT '📁',
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

projectsTable.run();

// Create task_projects table for many-to-many relationship
const taskProjectsTable = db.prepare(`
  CREATE TABLE IF NOT EXISTS task_projects (
    task_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (task_id, project_id),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );
`);

taskProjectsTable.run();

// Create recurring_schedules table for recurring tasks
const recurringSchedulesTable = db.prepare(`
  CREATE TABLE IF NOT EXISTS recurring_schedules (
    task_id INTEGER NOT NULL PRIMARY KEY,
    pattern TEXT NOT NULL,
    interval INTEGER NOT NULL DEFAULT 1,
    interval_unit TEXT NOT NULL DEFAULT 'day',
    start_date DATE,
    end_date DATE,
    exclude_dates TEXT, -- JSON array of excluded dates
    next_run DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  );
`);

recurringSchedulesTable.run();

// Create task_runs table to track generated instances of recurring tasks
const taskRunsTable = db.prepare(`
  CREATE TABLE IF NOT EXISTS task_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recurring_schedule_id INTEGER,
    task_id INTEGER NOT NULL,
    scheduled_date DATE NOT NULL,
    actual_date DATE,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'skipped', 'deleted')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (recurring_schedule_id) REFERENCES recurring_schedules(task_id) ON DELETE SET NULL,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  );
`);

taskRunsTable.run();

// Create notifications table for reminders and system notifications
const notificationsTable = db.prepare(`
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER,
    user_id TEXT DEFAULT 'default',
    type TEXT NOT NULL CHECK(type IN ('reminder', 'due', 'overdue', 'recurring', 'system')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data TEXT, -- JSON data for task details
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sent_at DATETIME,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  );
`);

notificationsTable.run();

// Create time_tracking_snapshots table for persistent timer
const timeTrackingSnapshotsTable = db.prepare(`
  CREATE TABLE IF NOT EXISTS time_tracking_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    is_running INTEGER DEFAULT 0,
    elapsed_seconds INTEGER DEFAULT 0,
    last_start_time DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  );
`);


    // Add missing indexes
    const createIndexes = () => {
      db.prepare('CREATE INDEX IF NOT EXISTS idx_tasks_is_completed ON tasks(is_completed)').run();
      db.prepare('CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline)').run();
      db.prepare('CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks(date)').run();
      db.prepare('CREATE INDEX IF NOT EXISTS idx_tasks_list_id ON tasks(list_id)').run();
      db.prepare('CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority)').run();
      db.prepare('CREATE INDEX IF NOT EXISTS idx_tasks_is_recurring ON tasks(is_recurring)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_tasks_dependencies ON tasks(dependencies)').run();
      db.prepare('CREATE INDEX IF NOT EXISTS idx_reminders_time ON reminders(time)').run();
      db.prepare('CREATE INDEX IF NOT EXISTS idx_time_entries_task_id ON time_entries(task_id)').run();
      db.prepare('CREATE INDEX IF NOT EXISTS idx_task_projects_task_id ON task_projects(task_id)').run();
      db.prepare('CREATE INDEX IF NOT EXISTS idx_task_projects_project_id ON task_projects(project_id)').run();
      db.prepare('CREATE INDEX IF NOT EXISTS idx_recurring_schedules_task_id ON recurring_schedules(task_id)').run();
      db.prepare('CREATE INDEX IF NOT EXISTS idx_recurring_schedules_next_run ON recurring_schedules(next_run)').run();
      db.prepare('CREATE INDEX IF NOT EXISTS idx_notifications_task_id ON notifications(task_id)').run();
      db.prepare('CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read)').run();
      db.prepare('CREATE INDEX IF NOT EXISTS idx_time_tracking_snapshots_task_id ON time_tracking_snapshots(task_id)').run();
    };

createIndexes();

// Backup table for automatic database backups
const backupTable = db.prepare(`
  CREATE TABLE IF NOT EXISTS db_backups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    backup_type TEXT NOT NULL CHECK(backup_type IN ('full', 'incremental')),
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    checksum TEXT,
    description TEXT
  );
`);

backupTable.run();

// Add duration_minutes column to time_entries if it doesn't exist
try {
  db.exec('ALTER TABLE time_entries ADD COLUMN duration_minutes INTEGER DEFAULT 0');
} catch (e: any) {
  // Column already exists, ignore error
  if (!e.message.includes('duplicate column name')) {
    throw e;
  }
}

export default db;