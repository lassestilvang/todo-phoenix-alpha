import db from './schema';
import { Task, TaskWithDetails, TaskFormData, RecurringPattern } from '../types';

// Helper function to calculate next occurrence date based on recurrence pattern
export const calculateNextOccurrence = (
  baseDate: Date | null,
  pattern: string | null,
  customValue: string | null
): Date | null => {
  if (!baseDate || !pattern) return null;

  const date = new Date(baseDate);
  const value = customValue ? parseInt(customValue, 10) : 1;

  switch (pattern) {
    case 'every_day':
      date.setDate(date.getDate() + 1);
      return date;

    case 'every_week':
      date.setDate(date.getDate() + 7);
      return date;

    case 'every_weekday': {
      // Skip weekends, move to next weekday
      do {
        date.setDate(date.getDate() + 1);
      } while (date.getDay() === 0 || date.getDay() === 6); // Skip Sunday (0) and Saturday (6)
      return date;
    }

    case 'every_month':
      date.setMonth(date.getMonth() + 1);
      return date;

    case 'every_year':
      date.setFullYear(date.getFullYear() + 1);
      return date;

    case 'custom_n_days':
      if (!isNaN(value) && value > 0) {
        date.setDate(date.getDate() + value);
        return date;
      }
      return null;

    case 'custom_n_weeks':
      if (!isNaN(value) && value > 0) {
        date.setDate(date.getDate() + value * 7);
        return date;
      }
      return null;

    case 'custom_days_of_month':
      if (!isNaN(value) && value > 0 && value <= 31) {
        // Set to the custom day of next month
        date.setMonth(date.getMonth() + 1);
        date.setDate(Math.min(value, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
        return date;
      }
      return null;

    default:
      return null;
  }
};

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

    // Update the task
    const updateFields: string[] = [];
    const updateValues: (string | number | Date | null)[] = [];

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
  },

  // NEW: Generate next occurrence for recurring tasks
  generateNextOccurrence: (taskId: number): Task | null => {
    const task = taskOperations.getById(taskId);
    if (!task || !task.is_recurring || !task.recurring_pattern) return null;

    const baseDate = task.date ? new Date(task.date) : null;
    const nextDate = calculateNextOccurrence(
      baseDate,
      task.recurring_pattern,
      task.recurring_custom_value
    );

    if (!nextDate) return null;

    // Create a new task instance based on the recurring task
    const nextTaskData: TaskFormData = {
      list_id: task.list_id,
      name: task.name,
      description: task.description === null ? undefined : task.description,
      date: nextDate,
      deadline: task.deadline ? new Date(task.deadline) : undefined,
      estimate_minutes: task.estimate_minutes,
      priority: task.priority,
      is_recurring: task.is_recurring === 1,
      recurring_pattern: task.recurring_pattern as RecurringPattern | undefined,
      recurring_custom_value: task.recurring_custom_value ?? undefined,
    };

    // Create the new occurrence
    return taskOperations.create(nextTaskData);
  },

  // NEW: Generate multiple future occurrences (for preview)
  generateFutureOccurrences: (taskId: number, count: number = 5): Task[] => {
    const occurrences: Task[] = [];
    let currentTaskId = taskId;

    for (let i = 0; i < count; i++) {
      const nextOccurrence = taskOperations.generateNextOccurrence(currentTaskId);
      if (!nextOccurrence) break;

      occurrences.push(nextOccurrence);
      currentTaskId = nextOccurrence.id; // Use the newly created task as base for next iteration
    }

    return occurrences;
  }
};