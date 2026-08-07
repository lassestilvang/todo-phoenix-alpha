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

timeTrackingSnapshotsTable.run();

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

// Migration history table for tracking schema changes
const migrationTable = db.prepare(`
  CREATE TABLE IF NOT EXISTS migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version TEXT NOT NULL UNIQUE,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'applied' CHECK(status IN ('pending', 'applied', 'failed', 'rolled_back')),
    description TEXT
  );
`);

migrationTable.run();

// Create default migration record if none exists
const migrationExists = db.prepare('SELECT id FROM migrations WHERE version = "1.0.0"').get();
if (!migrationExists) {
  db.prepare(`
    INSERT INTO migrations (version, status, description)
    VALUES ('1.0.0', 'applied', 'Initial schema with tasks, lists, subtasks, labels, reminders, attachments, time_entries')
  `).run();
}

// Projects table for hierarchical organization
const projectsTable = db.prepare(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#3b82f6',
    emoji TEXT NOT NULL DEFAULT '📁',
    description TEXT,
    parent_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES projects(id) ON DELETE SET NULL
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

// Enhanced recurring_schedules table with complex patterns
const recurringSchedulesTable = db.prepare(`
  CREATE TABLE IF NOT EXISTS recurring_schedules (
    task_id INTEGER NOT NULL PRIMARY KEY,
    pattern TEXT NOT NULL CHECK(pattern IN ('daily', 'weekly', 'weekly_complex', 'monthly', 'monthly_custom')),
    interval INTEGER NOT NULL DEFAULT 1,
    interval_unit TEXT NOT NULL DEFAULT 'day',
    weekdays TEXT, -- JSON array of weekday numbers for weekly patterns (0-6)
    month_day INTEGER, -- Day of month for monthly patterns (1-31)
    week_of_month INTEGER, -- Week of month (1-5) for complex monthly
    weekday_of_month INTEGER, -- Weekday (0-6) for complex monthly
    start_date DATE,
    end_date DATE,
    exclude_dates TEXT, -- JSON array of excluded dates (ISO date strings)
    next_run DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  );
`);

recurringSchedulesTable.run();

// Time tracking rules table for duration constraints
const timeTrackingRulesTable = db.prepare(`
  CREATE TABLE IF NOT EXISTS time_tracking_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL UNIQUE,
    min_duration_minutes INTEGER DEFAULT 1,
    max_duration_minutes INTEGER DEFAULT 480,
    require_description INTEGER DEFAULT 0,
    allowed_days TEXT, -- JSON array of allowed weekday numbers (0-6)
    allowed_hours_start TEXT, -- HH:MM format
    allowed_hours_end TEXT, -- HH:MM format
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  );
`);

timeTrackingRulesTable.run();

// Integrations table for third-party API connections
const integrationsTable = db.prepare(`
  CREATE TABLE IF NOT EXISTS integrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK(type IN ('calendar', 'webhook', 'api', 'oauth')),
    api_key TEXT,
    webhook_url TEXT,
    config TEXT, -- JSON configuration
    enabled INTEGER DEFAULT 1,
    last_sync DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

integrationsTable.run();

// Audit logs table for tracking all data changes
const auditLogsTable = db.prepare(`
  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT DEFAULT 'default',
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id INTEGER,
    old_values TEXT, -- JSON of old values
    new_values TEXT, -- JSON of new values
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

auditLogsTable.run();

// Create indexes for new tables
const createNewIndexes = () => {
  // Projects indexes
  db.prepare('CREATE INDEX IF NOT EXISTS idx_projects_parent_id ON projects(parent_id)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name)').run();

  // Task projects indexes
  db.prepare('CREATE INDEX IF NOT EXISTS idx_task_projects_task_id ON task_projects(task_id)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_task_projects_project_id ON task_projects(project_id)').run();

  // Recurring schedules indexes
  db.prepare('CREATE INDEX IF NOT EXISTS idx_recurring_schedules_next_run ON recurring_schedules(next_run)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_recurring_schedules_pattern ON recurring_schedules(pattern)').run();

  // Time tracking rules indexes
  db.prepare('CREATE INDEX IF NOT EXISTS idx_time_tracking_rules_task_id ON time_tracking_rules(task_id)').run();

  // Integrations indexes
  db.prepare('CREATE INDEX IF NOT EXISTS idx_integrations_type ON integrations(type)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_integrations_enabled ON integrations(enabled)').run();

  // Audit logs indexes
  db.prepare('CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON audit_logs(table_name)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id ON audit_logs(record_id)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)').run();

  // Composite indexes for common query patterns
  db.prepare('CREATE INDEX IF NOT EXISTS idx_tasks_list_completed_date ON tasks(list_id, is_completed, date)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_tasks_priority_date ON tasks(priority, date)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_tasks_deadline_completed ON tasks(deadline, is_completed)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_subtasks_task_completed ON subtasks(task_id, is_completed)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_time_entries_task_started ON time_entries(task_id, started_at)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_reminders_time_sent ON reminders(time, is_sent)').run();
};

createNewIndexes();

export default db;