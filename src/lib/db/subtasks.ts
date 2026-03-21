import db from './schema';
import { Subtask, SubtaskWithDetails, SubtaskFormData } from '../types';

export const subtaskOperations = {
  getAll: (taskId: number): Subtask[] => {
    return db.prepare('SELECT * FROM subtasks WHERE task_id = ? ORDER BY created_at ASC').all(taskId) as Subtask[];
  },

  getById: (id: number): Subtask | undefined => {
    return db.prepare('SELECT * FROM subtasks WHERE id = ?').get(id) as Subtask | undefined;
  },

  getByIdWithDetails: (id: number): SubtaskWithDetails | undefined => {
    const subtask = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(id) as Subtask | undefined;
    if (!subtask) return undefined;

    const labels = db.prepare(`
      SELECT l.* FROM labels l
      JOIN subtask_labels sl ON l.id = sl.label_id
      WHERE sl.subtask_id = ?
    `).all(id);
    const changes = db.prepare('SELECT * FROM subtask_changes WHERE subtask_id = ? ORDER BY changed_at DESC').all(id);

    return {
      ...subtask,
      labels,
      changes
    } as SubtaskWithDetails;
  },

  create: (taskId: number, data: SubtaskFormData): Subtask => {
    const result = db.prepare(`
      INSERT INTO subtasks (
        task_id, name, description, date, deadline, 
        estimate_minutes, priority, is_recurring, 
        recurring_pattern, recurring_custom_value
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      taskId,
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

    const subtaskId = result.lastInsertRowid as number;

    // Add labels if provided
    if (data.label_ids && data.label_ids.length > 0) {
      const insertLabel = db.prepare('INSERT INTO subtask_labels (subtask_id, label_id) VALUES (?, ?)');
      for (const labelId of data.label_ids) {
        insertLabel.run(subtaskId, labelId);
      }
    }

    return subtaskOperations.getById(subtaskId)!;
  },

  update: (id: number, updates: Partial<SubtaskFormData>): Subtask => {
    const currentSubtask = subtaskOperations.getById(id);
    if (!currentSubtask) throw new Error('Subtask not found');

    // Log changes
    const changesToLog: { field: string; oldValue: string | number | boolean | null; newValue: string | number | boolean | null }[] = [];

    if (updates.name !== undefined && updates.name !== currentSubtask.name) {
      changesToLog.push({ field: 'name', oldValue: currentSubtask.name, newValue: updates.name });
    }
    if (updates.description !== undefined && updates.description !== currentSubtask.description) {
      changesToLog.push({ field: 'description', oldValue: currentSubtask.description, newValue: updates.description });
    }
    if (updates.date !== undefined) {
      const newDate = updates.date ? updates.date.toISOString().split('T')[0] : null;
      if (newDate !== currentSubtask.date) {
        changesToLog.push({ field: 'date', oldValue: currentSubtask.date, newValue: newDate });
      }
    }
    if (updates.deadline !== undefined) {
      const newDeadline = updates.deadline ? updates.deadline.toISOString() : null;
      if (newDeadline !== currentSubtask.deadline) {
        changesToLog.push({ field: 'deadline', oldValue: currentSubtask.deadline, newValue: newDeadline });
      }
    }
    if (updates.estimate_minutes !== undefined && updates.estimate_minutes !== currentSubtask.estimate_minutes) {
      changesToLog.push({ field: 'estimate_minutes', oldValue: currentSubtask.estimate_minutes, newValue: updates.estimate_minutes });
    }
    if (updates.priority !== undefined && updates.priority !== currentSubtask.priority) {
      changesToLog.push({ field: 'priority', oldValue: currentSubtask.priority, newValue: updates.priority });
    }
    if (updates.is_recurring !== undefined && updates.is_recurring !== (currentSubtask.is_recurring === 1)) {
      changesToLog.push({ field: 'is_recurring', oldValue: currentSubtask.is_recurring, newValue: updates.is_recurring });
    }
    if (updates.recurring_pattern !== undefined && updates.recurring_pattern !== currentSubtask.recurring_pattern) {
      changesToLog.push({ field: 'recurring_pattern', oldValue: currentSubtask.recurring_pattern, newValue: updates.recurring_pattern });
    }
    if (updates.recurring_custom_value !== undefined && updates.recurring_custom_value !== currentSubtask.recurring_custom_value) {
      changesToLog.push({ field: 'recurring_custom_value', oldValue: currentSubtask.recurring_custom_value, newValue: updates.recurring_custom_value });
    }

    // Update the subtask
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

    if (updateFields.length > 0) {
      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      updateValues.push(id);
      db.prepare(`UPDATE subtasks SET ${updateFields.join(', ')} WHERE id = ?`).run(...updateValues);
    }

    // Log changes to database
    if (changesToLog.length > 0) {
      const insertChange = db.prepare(`
        INSERT INTO subtask_changes (subtask_id, field_name, old_value, new_value)
        VALUES (?, ?, ?, ?)
      `);
      for (const change of changesToLog) {
        insertChange.run(id, change.field, String(change.oldValue), String(change.newValue));
      }
    }

    // Update labels if provided
    if (updates.label_ids !== undefined) {
      db.prepare('DELETE FROM subtask_labels WHERE subtask_id = ?').run(id);
      if (updates.label_ids.length > 0) {
        const insertLabel = db.prepare('INSERT INTO subtask_labels (subtask_id, label_id) VALUES (?, ?)');
        for (const labelId of updates.label_ids) {
          insertLabel.run(id, labelId);
        }
      }
    }

    return subtaskOperations.getById(id)!;
  },

  toggleComplete: (id: number): Subtask => {
    const subtask = subtaskOperations.getById(id);
    if (!subtask) throw new Error('Subtask not found');

    const newCompleted = subtask.is_completed === 0 ? 1 : 0;
    
    db.prepare(`
      UPDATE subtasks 
      SET is_completed = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newCompleted, id);

    // Log the change
    db.prepare(`
      INSERT INTO subtask_changes (subtask_id, field_name, old_value, new_value)
      VALUES (?, ?, ?, ?)
    `).run(id, 'is_completed', String(subtask.is_completed), String(newCompleted));

    return subtaskOperations.getById(id)!;
  },

  delete: (id: number): void => {
    db.prepare('DELETE FROM subtasks WHERE id = ?').run(id);
  }
};
