import db from './schema';
import { List } from '../types';

export const listOperations = {
  getAll: (): List[] => {
    return db.prepare('SELECT * FROM lists ORDER BY is_default DESC, name ASC').all() as List[];
  },

  getById: (id: number): List | undefined => {
    return db.prepare('SELECT * FROM lists WHERE id = ?').get(id) as List | undefined;
  },

  create: (name: string, color: string, emoji: string, icon: string): List => {
    const result = db.prepare(`
      INSERT INTO lists (name, color, emoji, icon)
      VALUES (?, ?, ?, ?)
    `).run(name, color, emoji, icon);
    
    return listOperations.getById(result.lastInsertRowid as number)!;
  },

  update: (id: number, updates: Partial<Pick<List, 'name' | 'color' | 'emoji' | 'icon'>>): List => {
    const fields = Object.keys(updates).filter(key => updates[key as keyof typeof updates] !== undefined);
    if (fields.length === 0) {
      return listOperations.getById(id)!;
    }

    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const values = fields.map(field => updates[field as keyof typeof updates]);
    
    db.prepare(`
      UPDATE lists 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(...values, id);
    
    return listOperations.getById(id)!;
  },

  delete: (id: number): void => {
    db.prepare('DELETE FROM lists WHERE id = ?').run(id);
  },

  getDefault: (): List | undefined => {
    return db.prepare('SELECT * FROM lists WHERE is_default = 1').get() as List | undefined;
  }
};
