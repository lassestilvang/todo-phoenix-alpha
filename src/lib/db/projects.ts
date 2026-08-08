import db from './schema';
import { Project } from '../types';

export const projects = {
  getAll: (): Project[] => {
    return db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all() as Project[];
  },

  getById: (id: number): Project | null => {
    const result = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    return result as Project | null;
  },

  create: (data: Omit<Project, 'id'>): Project => {
    const result = db.prepare(`
      INSERT INTO projects (name, color, emoji, description, parent_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      data.name,
      data.color ?? '#3b82f6',
      data.emoji ?? '📁',
      data.description ?? null,
      data.parent_id ?? null
    );

    const projectId = result.lastInsertRowid as number;
    const project = this.getById(projectId);
    if (!project) {
      throw new Error('Failed to create project');
    }
    return project;
  },

  update: (id: number, updates: Partial<Omit<Project, 'id'>>): Project => {
    const current = this.getById(id);
    if (!current) throw new Error('Project not found');

    const updateFields: string[] = [];
    const updateValues: (string | number | null)[] = [];

    if (updates.name !== undefined && updates.name !== current.name) {
      updateFields.push('name = ?');
      updateValues.push(updates.name);
    }
    if (updates.color !== undefined && updates.color !== current.color) {
      updateFields.push('color = ?');
      updateValues.push(updates.color);
    }
    if (updates.emoji !== undefined && updates.emoji !== current.emoji) {
      updateFields.push('emoji = ?');
      updateValues.push(updates.emoji);
    }
    if (updates.description !== undefined && updates.description !== current.description) {
      updateFields.push('description = ?');
      updateValues.push(updates.description);
    }
    if (updates.parent_id !== undefined && updates.parent_id !== current.parent_id) {
      updateFields.push('parent_id = ?');
      updateValues.push(updates.parent_id ?? null);
    }

    if (updateFields.length > 0) {
      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      updateValues.push(id);
      db.prepare(`UPDATE projects SET ${updateFields.join(', ')} WHERE id = ?`).run(...updateValues);
    }

    const updated = this.getById(id);
    if (!updated) {
      throw new Error('Failed to update project');
    }
    return updated;
  },

  delete: (id: number): void => {
    const result = db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    if (result.changes === 0) {
      throw new Error('Project not found');
    }
  },

  getChildren: (id: number): Project[] => {
    return db.prepare('SELECT * FROM projects WHERE parent_id = ? ORDER BY created_at DESC')
      .all(id) as Project[];
  },

  getHierarchy: (): Project[] => {
    const allProjects = this.getAll();
    const projectMap = new Map<number, Project>();
    const rootProjects: Project[] = [];

    // First pass: create map and initialize children array
    allProjects.forEach(project => {
      project.children = [];
      projectMap.set(project.id, project);
    });

    // Second pass: build hierarchy
    allProjects.forEach(project => {
      if (project.parent_id !== null) {
        const parent = projectMap.get(project.parent_id);
        if (parent) {
          parent.children.push(project);
        }
      } else {
        rootProjects.push(project);
      }
    });

    return rootProjects;
  },

  // New: Find project by name (case-insensitive)
  findByName: (name: string): Project | null => {
    const result = db.prepare('SELECT * FROM projects WHERE LOWER(name) = LOWER(?)').get(name);
    return result as Project | null;
  },

  // New: Get project path from root
  getPath: (id: number): Project[] => {
    const path: Project[] = [];
    let current = this.getById(id);

    while (current) {
      path.unshift(current);
      if (current.parent_id === null) break;
      current = this.getById(current.parent_id);
    }

    return path;
  }
};