import db from './schema';
import { Label } from '../types';

export const labelOperations = {
  getAll: (): Label[] => {
    return db.prepare('SELECT * FROM labels ORDER BY name ASC').all() as Label[];
  },

  getById: (id: number): Label | undefined => {
    return db.prepare('SELECT * FROM labels WHERE id = ?').get(id) as Label | undefined;
  },

  create: (name: string, color: string, emoji: string): Label => {
    const result = db.prepare(`
      INSERT INTO labels (name, color, emoji)
      VALUES (?, ?, ?)
    `).run(name, color, emoji);
    
    return labelOperations.getById(result.lastInsertRowid as number)!;
  },

  update: (id: number, updates: Partial<Pick<Label, 'name' | 'color' | 'emoji'>>): Label => {
    const fields = Object.keys(updates).filter(key => updates[key as keyof typeof updates] !== undefined);
    if (fields.length === 0) {
      return labelOperations.getById(id)!;
    }

    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const values = fields.map(field => updates[field as keyof typeof updates]);
    
    db.prepare(`
      UPDATE labels 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(...values, id);
    
    return labelOperations.getById(id)!;
  },

  delete: (id: number): void => {
    db.prepare('DELETE FROM labels WHERE id = ?').run(id);
  },

  getByTaskId: (taskId: number): Label[] => {
    return db.prepare(`
      SELECT l.* FROM labels l
      JOIN task_labels tl ON l.id = tl.label_id
      WHERE tl.task_id = ?
    `).all(taskId) as Label[];
  },

  getBySubtaskId: (subtaskId: number): Label[] => {
    return db.prepare(`
      SELECT l.* FROM labels l
      JOIN subtask_labels sl ON l.id = sl.label_id
      WHERE sl.subtask_id = ?
    `).all(subtaskId) as Label[];
  }
};
