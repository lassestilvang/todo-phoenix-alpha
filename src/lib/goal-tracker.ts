// Advanced Goal Tracking System with OKR Support

import db from './db/schema';

export interface Objective {
  id: number;
  name: string;
  description: string;
  ownerId: string;
  startDate: string;
  endDate: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'draft' | 'active' | 'completed' | 'on-hold' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  keyResults?: KeyResult[];
}

export interface KeyResult {
  id: number;
  objectiveId: number;
  name: string;
  description: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  weight: number; // 0-1, how much this KR contributes to objective
  createdAt: string;
}

export interface GoalWithProgress extends Objective {
  progressPercent: number;
  completedKeyResults: number;
  totalKeyResults: number;
  isOverdue: boolean;
}

export interface GoalRecommendation {
  objectiveId: number;
  taskId: number;
  taskName: string;
  priority: number;
  reason: string;
  confidence: number;
}

export interface GoalMetrics {
  totalGoals: number;
  activeGoals: number;
  completedGoals: number;
  avgCompletionRate: number;
  goalsAtRisk: number;
  totalKeyResults: number;
  avgKeyResultProgress: number;
}

// Create a new objective
export function createObjective(data: {
  name: string;
  description?: string;
  ownerId: string;
  startDate: string;
  endDate: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}): Objective {
  const result = db.prepare(`
    INSERT INTO objectives (name, description, owner_id, start_date, end_date, priority, status)
    VALUES (?, ?, ?, ?, ?, ?, 'active')
  `).run(
    data.name,
    data.description || null,
    data.ownerId,
    data.startDate,
    data.endDate,
    data.priority || 'medium'
  );

  return getObjective(result.lastInsertRowid as number)!;
}

// Get a single objective with key results
export function getObjective(id: number): Objective | null {
  const obj = db.prepare(`
    SELECT * FROM objectives WHERE id = ?
  `).get(id) as any;

  if (!obj) return null;

  const keyResults = db.prepare(`
    SELECT * FROM key_results WHERE objective_id = ?
    ORDER BY weight DESC
  `).all(id) as any[];

  return {
    ...obj,
    keyResults,
  };
}

// Get all objectives for a user with progress
export function getObjectives(userId: string): GoalWithProgress[] {
  const objectives = db.prepare(`
    SELECT * FROM objectives WHERE owner_id = ?
    ORDER BY priority DESC, end_date ASC
  `).all(userId) as any[];

  return objectives.map(obj => {
    const krs = db.prepare(`
      SELECT * FROM key_results WHERE objective_id = ?
    `).all(obj.id) as any[];

    const totalWeight = krs.reduce((sum: number, kr: any) => sum + kr.weight, 0);
    const weightedProgress = krs.reduce((sum: number, kr: any) => {
      const progress = kr.targetValue > 0 ? kr.currentValue / kr.targetValue : 0;
      return sum + (progress * kr.weight);
    }, 0);
    const progressPercent = totalWeight > 0 ? Math.round((weightedProgress / totalWeight) * 100) : 0;

    const completedKRs = krs.filter(kr => kr.currentValue >= kr.targetValue).length;

    const isOverdue = new Date(obj.end_date) < new Date() && obj.status !== 'completed';

    return {
      ...obj,
      keyResults: krs,
      progressPercent,
      completedKeyResults: completedKRs,
      totalKeyResults: krs.length,
      isOverdue,
    };
  });
}

// Update objective status
export function updateObjectiveStatus(
  id: number,
  status: 'draft' | 'active' | 'completed' | 'on-hold' | 'cancelled'
): Objective | null {
  db.prepare(`
    UPDATE objectives SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(status, id);

  return getObjective(id);
}

// Delete objective
export function deleteObjective(id: number): boolean {
  const result = db.prepare(`DELETE FROM objectives WHERE id = ?`).run(id);
  return result.changes > 0;
}

// Create a key result for an objective
export function createKeyResult(data: {
  objectiveId: number;
  name: string;
  description?: string;
  targetValue: number;
  unit?: string;
  weight?: number;
}): KeyResult {
  const result = db.prepare(`
    INSERT INTO key_results (objective_id, name, description, target_value, current_value, unit, weight)
    VALUES (?, ?, ?, ?, 0, ?, ?)
  `).run(
    data.objectiveId,
    data.name,
    data.description || null,
    data.targetValue,
    data.unit || 'points',
    data.weight || 1
  );

  return getKeyResult(result.lastInsertRowid as number)!;
}

// Get a single key result
export function getKeyResult(id: number): KeyResult | null {
  return db.prepare(`
    SELECT * FROM key_results WHERE id = ?
  `).get(id) as KeyResult | null;
}

// Update key result progress
export function updateKeyResultProgress(
  id: number,
  currentValue: number,
  comment?: string
): KeyResult | null {
  db.prepare(`
    UPDATE key_results
    SET current_value = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(currentValue, id);

  // Add comment if provided
  if (comment) {
    db.prepare(`
      INSERT INTO kr_comments (key_result_id, comment, created_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `).run(id, comment);
  }

  return getKeyResult(id);
}

// Get key results for an objective
export function getKeyResults(objectiveId: number): KeyResult[] {
  return db.prepare(`
    SELECT * FROM key_results WHERE objective_id = ?
    ORDER BY weight DESC
  `).all(objectiveId) as KeyResult[];
}

// Calculate goal metrics
export function getGoalMetrics(userId: string): GoalMetrics {
  const objectives = getObjectives(userId);

  const totalGoals = objectives.length;
  const activeGoals = objectives.filter(o => o.status === 'active').length;
  const completedGoals = objectives.filter(o => o.status === 'completed').length;
  const goalsAtRisk = objectives.filter(o => o.isOverdue && o.status === 'active').length;
  const avgCompletionRate = totalGoals > 0
    ? Math.round(objectives.reduce((sum, o) => sum + o.progressPercent, 0) / totalGoals)
    : 0;

  const totalKeyResults = objectives.reduce((sum, o) => sum + o.totalKeyResults, 0);
  const avgKeyResultProgress = totalKeyResults > 0
    ? Math.round(objectives.reduce((sum, o) => sum + o.progressPercent, 0) / totalGoals)
    : 0;

  return {
    totalGoals,
    activeGoals,
    completedGoals,
    avgCompletionRate,
    goalsAtRisk,
    totalKeyResults,
    avgKeyResultProgress,
  };
}

// Get goal recommendations based on incomplete tasks
export function getGoalRecommendations(userId: string): GoalRecommendation[] {
  const objectives = getObjectives(userId).filter(o => o.status === 'active');
  const incompleteTasks = db.prepare(`
    SELECT * FROM tasks WHERE is_completed = 0
    ORDER BY priority DESC, date ASC
  `).all() as any[];

  const recommendations: GoalRecommendation[] = [];

  for (const objective of objectives) {
    const keyResults = getKeyResults(objective.id);

    // Find tasks that align with this objective's key results
    for (const task of incompleteTasks) {
      let matchScore = 0;
      const reasons: string[] = [];

      for (const kr of keyResults) {
        // Check if task name/name matches KR name (simple matching)
        if (task.name.toLowerCase().includes(kr.name.toLowerCase())) {
          matchScore += kr.weight * 0.5;
          reasons.push(`Aligns with "${kr.name}"`);
        }

        // Check deadline alignment
        if (task.deadline) {
          const taskDeadline = new Date(task.deadline);
          const krEnd = new Date(objective.endDate);
          if (taskDeadline <= krEnd) {
            matchScore += kr.weight * 0.3;
            reasons.push(`Deadline fits OKR timeline`);
          }
        }
      }

      if (matchScore > 0.3) {
        recommendations.push({
          objectiveId: objective.id,
          taskId: task.id,
          taskName: task.name,
          priority: task.priority === 'high' ? 10 : task.priority === 'medium' ? 5 : 2,
          reason: reasons.join('; ') || 'Task matches objective',
          confidence: Math.min(0.95, matchScore),
        });
      }
    }
  }

  // Sort by confidence and priority
  recommendations.sort((a, b) => b.confidence - a.confidence || b.priority - a.priority);

  return recommendations.slice(0, 10);
}

// Get tasks that contribute to a specific goal
export function getTasksForObjective(objectiveId: number): { taskId: number; taskName: string; contribution: number }[] {
  const objective = getObjective(objectiveId);
  if (!objective) return [];

  const keyResults = objective.keyResults || [];
  const totalWeight = keyResults.reduce((sum: number, kr: any) => sum + kr.weight, 0);

  const tasks = db.prepare(`
    SELECT * FROM tasks WHERE is_completed = 0 AND id IN (
      SELECT task_id FROM task_objectives WHERE objective_id = ?
    )
  `).all(objectiveId) as any[];

  return tasks.map(task => {
    const taskObj = db.prepare(`
      SELECT * FROM task_objectives WHERE task_id = ? AND objective_id = ?
    `).get(task.id, objectiveId) as any;

    const contribution = taskObj ? taskObj.contribution_weight : 0;

    return {
      taskId: task.id,
      taskName: task.name,
      contribution,
    };
  });
}

// Link a task to an objective
export function linkTaskToObjective(
  taskId: number,
  objectiveId: number,
  contributionWeight: number = 1
): void {
  db.prepare(`
    INSERT OR REPLACE INTO task_objectives (task_id, objective_id, contribution_weight)
    VALUES (?, ?, ?)
  `).run(taskId, objectiveId, contributionWeight);
}

// Unlink a task from an objective
export function unlinkTaskFromObjective(taskId: number, objectiveId: number): boolean {
  const result = db.prepare(`
    DELETE FROM task_objectives WHERE task_id = ? AND objective_id = ?
  `).run(taskId, objectiveId);

  return result.changes > 0;
}

// Generate OKR template based on common patterns
export function generateOKRTemplate(category: 'personal' | 'work' | 'team' | 'project'): {
  name: string;
  objectives: Array<{
    name: string;
    keyResults: Array<{
      name: string;
      targetValue: number;
      weight: number;
    }>;
  }>;
} {
  const templates: Record<string, any> = {
    personal: {
      name: 'Personal Growth OKR',
      objectives: [
        {
          name: 'Improve Health & Wellness',
          keyResults: [
            { name: 'Exercise 3x per week', targetValue: 12, weight: 0.4 },
            { name: 'Sleep 7+ hours nightly', targetValue: 28, weight: 0.3 },
            { name: 'Read 2 books', targetValue: 2, weight: 0.3 },
          ],
        },
        {
          name: 'Career Development',
          keyResults: [
            { name: 'Complete 2 courses', targetValue: 2, weight: 0.5 },
            { name: 'Build 1 portfolio project', targetValue: 1, weight: 0.5 },
          ],
        },
      ],
    },
    work: {
      name: 'Work Performance OKR',
      objectives: [
        {
          name: 'Increase Productivity',
          keyResults: [
            { name: 'Complete 50 tasks', targetValue: 50, weight: 0.5 },
            { name: 'Reduce average task time by 20%', targetValue: 80, weight: 0.5 },
          ],
        },
        {
          name: 'Improve Quality',
          keyResults: [
            { name: 'Achieve 95% task completion rate', targetValue: 95, weight: 0.6 },
            { name: 'Zero critical bugs', targetValue: 0, weight: 0.4 },
          ],
        },
      ],
    },
    team: {
      name: 'Team Collaboration OKR',
      objectives: [
        {
          name: 'Improve Communication',
          keyResults: [
            { name: 'Hold 4 team meetings', targetValue: 4, weight: 0.5 },
            { name: 'Share 10 updates', targetValue: 10, weight: 0.5 },
          ],
        },
        {
          name: 'Deliver Project Milestones',
          keyResults: [
            { name: 'Complete Phase 1', targetValue: 1, weight: 0.4 },
            { name: 'Complete Phase 2', targetValue: 1, weight: 0.3 },
            { name: 'Complete Phase 3', targetValue: 1, weight: 0.3 },
          ],
        },
      ],
    },
    project: {
      name: 'Project Delivery OKR',
      objectives: [
        {
          name: 'Deliver MVP',
          keyResults: [
            { name: 'Complete 10 core features', targetValue: 10, weight: 0.6 },
            { name: 'Pass QA with <5 bugs', targetValue: 5, weight: 0.4 },
          ],
        },
        {
          name: 'Launch on Time',
          keyResults: [
            { name: 'Complete all sprints', targetValue: 4, weight: 0.5 },
            { name: 'Deploy to production', targetValue: 1, weight: 0.5 },
          ],
        },
      ],
    },
  };

  return templates[category] || templates.work;
}

// Initialize database tables for goals
export function initializeGoalTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS objectives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      owner_id TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'critical')),
      status TEXT DEFAULT 'active' CHECK(status IN ('draft', 'active', 'completed', 'on-hold', 'cancelled')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS key_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      objective_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      target_value REAL NOT NULL,
      current_value REAL DEFAULT 0,
      unit TEXT DEFAULT 'points',
      weight REAL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (objective_id) REFERENCES objectives(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS task_objectives (
      task_id INTEGER NOT NULL,
      objective_id INTEGER NOT NULL,
      contribution_weight REAL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (task_id, objective_id),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (objective_id) REFERENCES objectives(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS kr_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_result_id INTEGER NOT NULL,
      comment TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (key_result_id) REFERENCES key_results(id) ON DELETE CASCADE
    );
  `);

  // Create indexes for performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_objectives_owner ON objectives(owner_id);
    CREATE INDEX IF NOT EXISTS idx_objectives_status ON objectives(status);
    CREATE INDEX IF NOT EXISTS idx_key_results_objective ON key_results(objective_id);
    CREATE INDEX IF NOT EXISTS idx_task_objectives_task ON task_objectives(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_objectives_objective ON task_objectives(objective_id);
  `);
}