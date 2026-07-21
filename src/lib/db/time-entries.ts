import db from './schema';
import { TimeEntry } from '../types';

export const timeEntryOperations = {
  getAll: (taskId?: number | null): TimeEntry[] => {
    if (taskId !== null && taskId !== undefined) {
      return db.prepare('SELECT * FROM time_entries WHERE task_id = ? ORDER BY started_at DESC').all(taskId) as TimeEntry[];
    }
    return db.prepare('SELECT * FROM time_entries ORDER BY started_at DESC').all() as TimeEntry[];
  },

  getById: (id: number): TimeEntry | undefined => {
    return db.prepare('SELECT * FROM time_entries WHERE id = ?').get(id) as TimeEntry | undefined;
  },

  create: (taskId: number, startedAt: Date): TimeEntry => {
    const result = db.prepare(`
      INSERT INTO time_entries (task_id, started_at)
      VALUES (?, ?)
    `).run(taskId, startedAt.toISOString());
    
    return timeEntryOperations.getById(result.lastInsertRowid as number)!;
  },

  stop: (id: number, stoppedAt: Date, durationMinutes: number): TimeEntry => {
    db.prepare(`
      UPDATE time_entries 
      SET stopped_at = ?, duration_minutes = ?
      WHERE id = ?
    `).run(stoppedAt.toISOString(), durationMinutes, id);
    
    return timeEntryOperations.getById(id)!;
  },

  delete: (id: number): void => {
    db.prepare('DELETE FROM time_entries WHERE id = ?').run(id);
  },

  deleteAllForTask: (taskId: number): void => {
    db.prepare('DELETE FROM time_entries WHERE task_id = ?').run(taskId);
  },

  getTotalTimeForTask: (taskId: number): number => {
    const result = db.prepare(`
      SELECT SUM(duration_minutes) as total FROM time_entries 
      WHERE task_id = ? AND stopped_at IS NOT NULL
    `).get(taskId) as { total: number | null };
    
    return result?.total || 0;
  },

  getActiveEntry: (taskId: number): TimeEntry | undefined => {
    return db.prepare(`
      SELECT * FROM time_entries 
      WHERE task_id = ? AND stopped_at IS NULL
      ORDER BY started_at DESC
      LIMIT 1
    `).get(taskId) as TimeEntry | undefined;
  }
};
