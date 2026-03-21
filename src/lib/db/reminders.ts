import db from './schema';
import { Reminder } from '../types';

export const reminderOperations = {
  getAll: (taskId: number): Reminder[] => {
    return db.prepare('SELECT * FROM reminders WHERE task_id = ? ORDER BY time ASC').all(taskId) as Reminder[];
  },

  getById: (id: number): Reminder | undefined => {
    return db.prepare('SELECT * FROM reminders WHERE id = ?').get(id) as Reminder | undefined;
  },

  create: (taskId: number, time: Date): Reminder => {
    const result = db.prepare(`
      INSERT INTO reminders (task_id, time)
      VALUES (?, ?)
    `).run(taskId, time.toISOString());
    
    return reminderOperations.getById(result.lastInsertRowid as number)!;
  },

  markAsSent: (id: number): Reminder => {
    db.prepare(`
      UPDATE reminders 
      SET is_sent = 1, sent_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);
    
    return reminderOperations.getById(id)!;
  },

  delete: (id: number): void => {
    db.prepare('DELETE FROM reminders WHERE id = ?').run(id);
  },

  deleteAllForTask: (taskId: number): void => {
    db.prepare('DELETE FROM reminders WHERE task_id = ?').run(taskId);
  },

  getPendingReminders: (currentTime: Date): Reminder[] => {
    return db.prepare(`
      SELECT * FROM reminders 
      WHERE time <= ? AND is_sent = 0
      ORDER BY time ASC
    `).all(currentTime.toISOString()) as Reminder[];
  }
};
