import db from './schema';
import { Attachment } from '../types';

export const attachmentOperations = {
  getAll: (taskId: number): Attachment[] => {
    return db.prepare('SELECT * FROM attachments WHERE task_id = ? ORDER BY created_at DESC').all(taskId) as Attachment[];
  },

  getById: (id: number): Attachment | undefined => {
    return db.prepare('SELECT * FROM attachments WHERE id = ?').get(id) as Attachment | undefined;
  },

  create: (taskId: number, filename: string, file_type: string, file_data: string): Attachment => {
    const result = db.prepare(`
      INSERT INTO attachments (task_id, filename, file_type, file_data)
      VALUES (?, ?, ?, ?)
    `).run(taskId, filename, file_type, file_data);
    
    return attachmentOperations.getById(result.lastInsertRowid as number)!;
  },

  delete: (id: number): void => {
    db.prepare('DELETE FROM attachments WHERE id = ?').run(id);
  },

  deleteAllForTask: (taskId: number): void => {
    db.prepare('DELETE FROM attachments WHERE task_id = ?').run(taskId);
  }
};
