import db from '@/lib/db/schema';

/**
 * Smart Sorting System
 * Learns from user behavior to provide personalized task ordering
 */

export interface SortCriteria {
  name: string;
  weight: number;
  direction: 'asc' | 'desc';
}

export interface UserSortPreferences {
  userId: string;
  criteria: SortCriteria[];
  updatedAt: string;
}

// Default sorting criteria weights
export const DEFAULT_SORT_CRITERIA: SortCriteria[] = [
  { name: 'overdue', weight: 100, direction: 'desc' },
  { name: 'dueToday', weight: 80, direction: 'desc' },
  { name: 'dueSoon', weight: 60, direction: 'desc' },
  { name: 'priority', weight: 50, direction: 'desc' },
  { name: 'recentlyCreated', weight: 30, direction: 'desc' },
  { name: 'hasTimeTracking', weight: 20, direction: 'desc' },
  { name: 'hasAttachments', weight: 10, direction: 'desc' },
  { name: 'hasSubtasks', weight: 10, direction: 'desc' }
];

// Initialize smart sorting database
const initSmartSorting = () => {
  if (typeof window === 'undefined') {
    try {
      const Database = require('better-sqlite3');
      const path = require('path');
      const dbPath = path.join(process.cwd(), 'data', 'planner.db');
      const dbInstance = new Database(dbPath);

      dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS user_sort_preferences (
          user_id TEXT PRIMARY KEY,
          criteria_json TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS task_interactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          task_id INTEGER NOT NULL,
          action TEXT NOT NULL, -- 'view', 'edit', 'complete', 'reorder', 'dismiss'
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          metadata TEXT -- JSON for additional context
        );

        CREATE INDEX IF NOT EXISTS idx_task_interactions_user ON task_interactions(user_id);
        CREATE INDEX IF NOT EXISTS idx_task_interactions_task ON task_interactions(task_id);
        CREATE INDEX IF NOT EXISTS idx_task_interactions_action ON task_interactions(action);
      `);
    } catch (e) {
      console.warn('Failed to initialize smart sorting:', e);
    }
  }
};

initSmartSorting();

// Get user's sort preferences
export function getUserSortPreferences(userId: string = 'default'): SortCriteria[] {
  try {
    const pref = db.prepare('SELECT criteria_json FROM user_sort_preferences WHERE user_id = ?')
      .get(userId) as { criteria_json: string } | undefined;

    if (pref) {
      return JSON.parse(pref.criteria_json);
    }
  } catch (e) {
    console.warn('Failed to get sort preferences:', e);
  }
  return DEFAULT_SORT_CRITERIA;
}

// Save user's sort preferences
export function saveUserSortPreferences(userId: string, criteria: SortCriteria[]): void {
  try {
    db.prepare(`
      INSERT OR REPLACE INTO user_sort_preferences (user_id, criteria_json, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `).run(userId, JSON.stringify(criteria));
  } catch (e) {
    console.warn('Failed to save sort preferences:', e);
  }
}

// Record user interaction with a task
export function recordTaskInteraction(
  userId: string,
  taskId: number,
  action: 'view' | 'edit' | 'complete' | 'reorder' | 'dismiss' | 'pin',
  metadata?: Record<string, any>
): void {
  try {
    db.prepare(`
      INSERT INTO task_interactions (user_id, task_id, action, metadata)
      VALUES (?, ?, ?, ?)
    `).run(userId, taskId, action, JSON.stringify(metadata || {}));
  } catch (e) {
    console.warn('Failed to record task interaction:', e);
  }
}

// Calculate task score based on user preferences and interactions
export function calculateTaskScore(
  task: any,
  criteria: SortCriteria[],
  userId: string = 'default'
): number {
  if (!task) return 0;
  if (!criteria || !Array.isArray(criteria)) return 0;

  let score = 0;
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  // Check if overdue
  if (task.deadline) {
    const deadline = new Date(task.deadline).toISOString().split('T')[0];
    if (deadline < today && !task.is_completed) {
      score += criteria.find(c => c.name === 'overdue')?.weight || 100;
    } else if (deadline === today && !task.is_completed) {
      score += criteria.find(c => c.name === 'dueToday')?.weight || 80;
    } else if (deadline > today && deadline <= getDateInDays(7) && !task.is_completed) {
      score += criteria.find(c => c.name === 'dueSoon')?.weight || 60;
    }
  }

  // Priority score
  const priorityWeight = criteria.find(c => c.name === 'priority')?.weight || 50;
  const priorityMap = { high: 3, medium: 2, low: 1, none: 0 };
  score += (priorityMap[task.priority as keyof typeof priorityMap] || 0) * (priorityWeight / 3);

  // Recently created
  if (task.created_at) {
    const created = new Date(task.created_at);
    const daysDiff = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff < 7) {
      score += criteria.find(c => c.name === 'recentlyCreated')?.weight || 30;
    }
  }

  // Has time tracking
  if (task.time_entries && task.time_entries.length > 0) {
    score += criteria.find(c => c.name === 'hasTimeTracking')?.weight || 20;
  }

  // Has attachments
  if (task.attachments && task.attachments.length > 0) {
    score += criteria.find(c => c.name === 'hasAttachments')?.weight || 10;
  }

  // Has subtasks
  if (task.subtasks && task.subtasks.length > 0) {
    score += criteria.find(c => c.name === 'hasSubtasks')?.weight || 10;
  }

  // Add interaction-based score
  score += calculateInteractionScore(task.id, userId);

  return score;
}

// Calculate score based on user interactions
function calculateInteractionScore(taskId: number, userId: string): number {
  try {
    const interactions = db.prepare(`
      SELECT action, COUNT(*) as count, MAX(timestamp) as last_action
      FROM task_interactions
      WHERE user_id = ? AND task_id = ?
      GROUP BY action
    `).all(userId, taskId) as Array<{ action: string; count: number; last_action: string }>;

    let score = 0;
    for (const interaction of interactions) {
      const daysSince = (Date.now() - new Date(interaction.last_action).getTime()) / (1000 * 60 * 60 * 24);
      const recencyFactor = Math.max(0, 1 - daysSince / 30); // Decay over 30 days

      switch (interaction.action) {
        case 'complete':
          score += interaction.count * 5 * recencyFactor;
          break;
        case 'edit':
          score += interaction.count * 3 * recencyFactor;
          break;
        case 'view':
          score += interaction.count * 1 * recencyFactor;
          break;
        case 'pin':
          score += interaction.count * 10 * recencyFactor;
          break;
        case 'reorder':
          score += interaction.count * 2 * recencyFactor;
          break;
      }
    }

    return score;
  } catch (e) {
    return 0;
  }
}

// Apply smart sorting to tasks
export function applySmartSorting(
  tasks: any[],
  userId: string = 'default',
  customCriteria?: SortCriteria[]
): any[] {
  const criteria = customCriteria || getUserSortPreferences(userId);

  return tasks
    .map(task => ({
      ...task,
      smartScore: calculateTaskScore(task, criteria, userId)
    }))
    .sort((a, b) => b.smartScore - a.smartScore);
}

// Get suggested sort order based on interaction history
export function getSuggestedSortCriteria(userId: string = 'default'): SortCriteria[] {
  try {
    // Analyze recent interactions to suggest optimal weights
    const recentInteractions = db.prepare(`
      SELECT action, COUNT(*) as count
      FROM task_interactions
      WHERE user_id = ? AND timestamp > datetime('now', '-7 days')
      GROUP BY action
    `).all(userId) as Array<{ action: string; count: number }>;

    const totalInteractions = recentInteractions.reduce((sum, i) => sum + i.count, 0);

    // If user completes many tasks, prioritize by due date
    const completionRate = recentInteractions.find(i => i.action === 'complete')?.count || 0;
    if (completionRate / totalInteractions > 0.5) {
      return [
        { name: 'overdue', weight: 100, direction: 'desc' },
        { name: 'dueToday', weight: 90, direction: 'desc' },
        { name: 'dueSoon', weight: 70, direction: 'desc' },
        { name: 'priority', weight: 40, direction: 'desc' },
        ...DEFAULT_SORT_CRITERIA.slice(4)
      ];
    }

    // If user views many tasks, prioritize by recent activity
    const viewRate = recentInteractions.find(i => i.action === 'view')?.count || 0;
    if (viewRate / totalInteractions > 0.5) {
      return [
        { name: 'recentlyCreated', weight: 80, direction: 'desc' },
        { name: 'hasTimeTracking', weight: 50, direction: 'desc' },
        { name: 'priority', weight: 40, direction: 'desc' },
        ...DEFAULT_SORT_CRITERIA.filter(c => !['recentlyCreated', 'hasTimeTracking', 'priority'].includes(c.name))
      ];
    }

    return DEFAULT_SORT_CRITERIA;
  } catch (e) {
    return DEFAULT_SORT_CRITERIA;
  }
}

// Helper function
export function getDateInDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}