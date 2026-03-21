import db from './schema';
import { Task, TaskWithDetails, TaskFormData, Priority } from '../types';

export const taskOperations = {
  getAll: (includeCompleted: boolean = true): Task[] => {
    const query = includeCompleted 
      ? 'SELECT * FROM tasks ORDER BY date ASC, priority DESC, created_at DESC'
      : 'SELECT * FROM tasks WHERE is_completed = 0 ORDER BY date ASC, priority DESC, created_at DESC';
    return db.prepare(query).all() as Task[];
  },

  getById: (id: number): Task | undefined => {
    return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task | undefined;
  },

  getByIdWithDetails: (id: number): TaskWithDetails | undefined => {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task | undefined;
    if (!task) return undefined;

    const list = db.prepare('SELECT * FROM lists WHERE id = ?').get(task.list_id);
    const subtasks = db.prepare('SELECT * FROM subtasks WHERE task_id = ?').all(task.id);
    const labels = db.prepare(`
      SELECT l.* FROM labels l
      JOIN task_labels tl ON l.id = tl.label_id
      WHERE tl.task_id = ?
    `).all(task.id);
    const reminders = db.prepare('SELECT * FROM reminders WHERE task_id = ?').all(task.id);
    const attachments = db.prepare('SELECT * FROM attachments WHERE task_id = ?').all(task.id);
    const time_entries = db.prepare('SELECT * FROM time_entries WHERE task_id = ?').all(task.id);
    const changes = db.prepare('SELECT * FROM task_changes WHERE task_id = ? ORDER BY changed_at DESC').all(task.id);

    return {
      ...task,
      list,
      subtasks,
      labels,
      reminders,
      attachments,
      time_entries,
      changes
    } as TaskWithDetails;
  },

  getByListId: (listId: number, includeCompleted: boolean = true): Task[] => {
    const query = includeCompleted
      ? 'SELECT * FROM tasks WHERE list_id = ? ORDER BY date ASC, priority DESC, created_at DESC'
      : 'SELECT * FROM tasks WHERE list_id = ? AND is_completed = 0 ORDER BY date ASC, priority DESC, created_at DESC';
    return db.prepare(query).all(listId) as Task[];
  },

  getByDate: (date: string, includeCompleted: boolean = true): Task[] => {
    const query = includeCompleted
      ? 'SELECT * FROM tasks WHERE date = ? ORDER BY priority DESC, created_at DESC'
      : 'SELECT * FROM tasks WHERE date = ? AND is_completed = 0 ORDER BY priority DESC, created_at DESC';
    return db.prepare(query).all(date) as Task[];
  },

  getByDateRange: (startDate: string, endDate: string, includeCompleted: boolean = true): Task[] => {
    const query = includeCompleted
      ? 'SELECT * FROM tasks WHERE date >= ? AND date <= ? ORDER BY date ASC, priority DESC, created_at DESC'
      : 'SELECT * FROM tasks WHERE date >= ? AND date <= ? AND is_completed = 0 ORDER BY date ASC, priority DESC, created_at DESC';
    return db.prepare(query).all(startDate, endDate) as Task[];
  },

  getUpcoming: (fromDate: string, includeCompleted: boolean = true): Task[] => {
    const query = includeCompleted
      ? 'SELECT * FROM tasks WHERE date >= ? ORDER BY date ASC, priority DESC, created_at DESC'
      : 'SELECT * FROM tasks WHERE date >= ? AND is_completed = 0 ORDER BY date ASC, priority DESC, created_at DESC';
    return db.prepare(query).all(fromDate) as Task[];
  },

  getOverdue: (currentDate: string): Task[] => {
    return db.prepare(`
      SELECT * FROM tasks 
      WHERE deadline < ? AND is_completed = 0
      ORDER BY deadline ASC
    `).all(currentDate) as Task[];
  },

  create: (data: TaskFormData): Task => {
    const result = db.prepare(`
      INSERT INTO tasks (
        list_id, name, description, date, deadline, 
        estimate_minutes, priority, is_recurring, 
        recurring_pattern, recurring_custom_value
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.list_id,
      data.name,
      data.description || null,
      data.date ? data.date.toISOString().split('T')[0] : null,
      data.deadline ? data.deadline.toISOString() : null,
      data.estimate_minutes || 0,
      data.priority || 'none',
      data.is_recurring ? 1 : 0,
      data.recurring_pattern || null,
      data.recurring_custom_value || null
    );

    const taskId = result.lastInsertRowid as number;

    // Add labels if provided
    if (data.label_ids && data.label_ids.length > 0) {
      const insertLabel = db.prepare('INSERT INTO task_labels (task_id, label_id) VALUES (?, ?)');
      for (const labelId of data.label_ids) {
        insertLabel.run(taskId, labelId);
      }
    }

    return taskOperations.getById(taskId)!;
  },

  update: (id: number, updates: Partial<TaskFormData>): Task => {
    const currentTask = taskOperations.getById(id);
    if (!currentTask) throw new Error('Task not found');

    // Log changes
    const changesToLog: { field: string; oldValue: any; newValue: any }[] = [];

    if (updates.name !== undefined && updates.name !== currentTask.name) {
      changesToLog.push({ field: 'name', oldValue: currentTask.name, newValue: updates.name });
    }
    if (updates.description !== undefined && updates.description !== currentTask.description) {
      changesToLog.push({ field: 'description', oldValue: currentTask.description, newValue: updates.description });
    }
    if (updates.date !== undefined) {
      const newDate = updates.date ? updates.date.toISOString().split('T')[0] : null;
      if (newDate !== currentTask.date) {
        changesToLog.push({ field: 'date', oldValue: currentTask.date, newValue: newDate });
      }
    }
    if (updates.deadline !== undefined) {
      const newDeadline = updates.deadline ? updates.deadline.toISOString() : null;
      if (newDeadline !== currentTask.deadline) {
        changesToLog.push({ field: 'deadline', oldValue: currentTask.deadline, newValue: newDeadline });
      }
    }
    if (updates.estimate_minutes !== undefined && updates.estimate_minutes !== currentTask.estimate_minutes) {
      changesToLog.push({ field: 'estimate_minutes', oldValue: currentTask.estimate_minutes, newValue: updates.estimate_minutes });
    }
    if (updates.priority !== undefined && updates.priority !== currentTask.priority) {
      changesToLog.push({ field: 'priority', oldValue: currentTask.priority, newValue: updates.priority });
    }
    if (updates.is_recurring !== undefined && updates.is_recurring !== (currentTask.is_recurring === 1)) {
      changesToLog.push({ field: 'is_recurring', oldValue: currentTask.is_recurring, newValue: updates.is_recurring });
    }
    if (updates.recurring_pattern !== undefined && updates.recurring_pattern !== currentTask.recurring_pattern) {
      changesToLog.push({ field: 'recurring_pattern', oldValue: currentTask.recurring_pattern, newValue: updates.recurring_pattern });
    }
    if (updates.recurring_custom_value !== undefined && updates.recurring_custom_value !== currentTask.recurring_custom_value) {
      changesToLog.push({ field: 'recurring_custom_value', oldValue: currentTask.recurring_custom_value, newValue: updates.recurring_custom_value });
    }
    if (updates.list_id !== undefined && updates.list_id !== currentTask.list_id) {
      changesToLog.push({ field: 'list_id', oldValue: currentTask.list_id, newValue: updates.list_id });
    }

    // Update the task
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (updates.name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(updates.name);
    }
    if (updates.description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(updates.description);
    }
    if (updates.date !== undefined) {
      updateFields.push('date = ?');
      updateValues.push(updates.date ? updates.date.toISOString().split('T')[0] : null);
    }
    if (updates.deadline !== undefined) {
      updateFields.push('deadline = ?');
      updateValues.push(updates.deadline ? updates.deadline.toISOString() : null);
    }
    if (updates.estimate_minutes !== undefined) {
      updateFields.push('estimate_minutes = ?');
      updateValues.push(updates.estimate_minutes);
    }
    if (updates.priority !== undefined) {
      updateFields.push('priority = ?');
      updateValues.push(updates.priority);
    }
    if (updates.is_recurring !== undefined) {
      updateFields.push('is_recurring = ?');
      updateValues.push(updates.is_recurring ? 1 : 0);
    }
    if (updates.recurring_pattern !== undefined) {
      updateFields.push('recurring_pattern = ?');
      updateValues.push(updates.recurring_pattern);
    }
    if (updates.recurring_custom_value !== undefined) {
      updateFields.push('recurring_custom_value = ?');
      updateValues.push(updates.recurring_custom_value);
    }
    if (updates.list_id !== undefined) {
      updateFields.push('list_id = ?');
      updateValues.push(updates.list_id);
    }

    if (updateFields.length > 0) {
      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      updateValues.push(id);
      db.prepare(`UPDATE tasks SET ${updateFields.join(', ')} WHERE id = ?`).run(...updateValues);
    }

    // Log changes to database
    if (changesToLog.length > 0) {
      const insertChange = db.prepare(`
        INSERT INTO task_changes (task_id, field_name, old_value, new_value)
        VALUES (?, ?, ?, ?)
      `);
      for (const change of changesToLog) {
        insertChange.run(id, change.field, String(change.oldValue), String(change.newValue));
      }
    }

    // Update labels if provided
    if (updates.label_ids !== undefined) {
      db.prepare('DELETE FROM task_labels WHERE task_id = ?').run(id);
      if (updates.label_ids.length > 0) {
        const insertLabel = db.prepare('INSERT INTO task_labels (task_id, label_id) VALUES (?, ?)');
        for (const labelId of updates.label_ids) {
          insertLabel.run(id, labelId);
        }
      }
    }

    return taskOperations.getById(id)!;
  },

  toggleComplete: (id: number): Task => {
    const task = taskOperations.getById(id);
    if (!task) throw new Error('Task not found');

    const newCompleted = task.is_completed === 0 ? 1 : 0;
    
    db.prepare(`
      UPDATE tasks 
      SET is_completed = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newCompleted, id);

    // Log the change
    db.prepare(`
      INSERT INTO task_changes (task_id, field_name, old_value, new_value)
      VALUES (?, ?, ?, ?)
    `).run(id, 'is_completed', String(task.is_completed), String(newCompleted));

    return taskOperations.getById(id)!;
  },

  delete: (id: number): void => {
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  },

  search: (query: string, includeCompleted: boolean = true): Task[] => {
    const searchQuery = includeCompleted
      ? `SELECT * FROM tasks WHERE name LIKE ? OR description LIKE ? ORDER BY date ASC, priority DESC, created_at DESC`
      : `SELECT * FROM tasks WHERE (name LIKE ? OR description LIKE ?) AND is_completed = 0 ORDER BY date ASC, priority DESC, created_at DESC`;
    const searchTerm = `%${query}%`;
    return db.prepare(searchQuery).all(searchTerm, searchTerm) as Task[];
  }
};
