-- Performance Optimizations for Query Speed

-- 1. Fast lookup of tasks by list and completion status
CREATE INDEX IF NOT EXISTS idx_tasks_list_completed ON tasks(list_id, is_completed);

-- 2. Quick retrieval of tasks by deadline
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline);

-- 3. Efficient retrieval of subtasks by parent task
CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id);

-- 4. Fast lookup of task labels
CREATE INDEX IF NOT EXISTS idx_tasklabels_label ON labels(name);

-- 5. Efficient retrieval of pending tasks across projects
CREATE INDEX IF NOT EXISTS idx_tasks_pending ON tasks(is_completed, created_at DESC);

-- 6. Frequent joins between tasks and labels -> improve query speed
CREATE INDEX IF NOT EXISTS idx_tasklabels_task_id ON task_labels(task_id);

-- 7. For recurring tasks, index recurring schedule pattern fields
CREATE INDEX IF NOT EXISTS idx_recurring_pattern ON recurring_schedules(pattern, interval_unit);

-- 8. Speed up attachment lookups
CREATE INDEX IF NOT EXISTS idx_attachments_task_id ON attachments(task_id);

-- 9. Optimize audit log queries by user and timestamp
CREATE INDEX IF NOT EXISTS idx_audit_user_time ON audit_logs(user_id, created_at DESC);