import db from './schema';
import { Task } from '@/lib/types';

export interface Reminder {
  id: number;
  task_id: number;
  time: string;
  is_sent: boolean;
  sent_at?: string;
  task?: Task;
}

export const reminderOperations = {
  getAll: (): Reminder[] => {
    return db.prepare('SELECT * FROM reminders').all() as Reminder[];
  },

  getById: (id: number): Reminder | null => {
    return db.prepare('SELECT * FROM reminders WHERE id = ?').get(id) as Reminder | null;
  },

  getByTaskId: (taskId: number): Reminder[] => {
    return db.prepare('SELECT * FROM reminders WHERE task_id = ?').all(taskId) as Reminder[];
  },

  getUpcoming: (fromTime: string): Reminder[] => {
    return db.prepare(
      'SELECT * FROM reminders WHERE time >= ? AND is_sent = 0 ORDER BY time ASC'
    ).all(fromTime) as Reminder[];
  },

  getPending: (): Reminder[] => {
    return db.prepare(
      'SELECT * FROM reminders WHERE is_sent = 0 ORDER BY time ASC'
    ).all() as Reminder[];
  },

  create: (taskId: number, time: string): Reminder => {
    const result = db.prepare(
      'INSERT INTO reminders (task_id, time) VALUES (?, ?)'
    ).run(taskId, time);

    return this.getById(result.lastInsertRowid as number)!;
  },

  update: (id: number, updates: Partial<Reminder>): Reminder => {
    const updatesArray: string[] = [];
    const values: (string | number | boolean)[] = [];

    if (updates.time !== undefined) {
      updatesArray.push('time = ?');
      values.push(updates.time);
    }

    if (updates.is_sent !== undefined) {
      updatesArray.push('is_sent = ?');
      values.push(updates.is_sent ? 1 : 0);
      if (updates.is_sent && !updates.sent_at) {
        updatesArray.push('sent_at = CURRENT_TIMESTAMP');
      }
    }

    if (updatesArray.length === 0) {
      throw new Error('No updates provided');
    }

    db.prepare(`UPDATE reminders SET ${updatesArray.join(', ')} WHERE id = ?`).run(...values, id);

    return this.getById(id)!;
  },

  markAsSent: (id: number): Reminder => {
    return this.update(id, { is_sent: true, sent_at: new Date().toISOString() });
  },

  delete: (id: number): void => {
    db.prepare('DELETE FROM reminders WHERE id = ?').run(id);
  },

  deleteByTaskId: (taskId: number): void => {
    db.prepare('DELETE FROM reminders WHERE task_id = ?').run(taskId);
  },

  // New: Get reminders for today
  getToday: (): Reminder[] => {
    const today = new Date().toISOString().split('T')[0];
    return db.prepare(
      'SELECT * FROM reminders WHERE date(time, "start of day") = date(?) AND is_sent = 0 ORDER BY time ASC'
    ).all(today) as Reminder[];
  },

  // New: Get overdue reminders (past due time)
  getOverdue: (): Reminder[] => {
    const now = new Date().toISOString();
    return db.prepare(
      'SELECT * FROM reminders WHERE time < ? AND is_sent = 0 ORDER BY time ASC'
    ).all(now) as Reminder[];
  }
};