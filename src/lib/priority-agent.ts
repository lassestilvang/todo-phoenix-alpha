/**
 * Priority Agent - Intelligent task ranking and prioritization service
 *
 * Core Responsibilities:
 * - Implement task ranking algorithms (Eisenhower Matrix + urgency decay)
 * - Dynamic priority adjustments based on context changes
 * - Integration with AgentOS for workload distribution
 * - Continuous learning from user behavior patterns
 */

import { create } from 'zustand';
import { AgentCapabilityProfile, AgentWorkloadMetrics, AgentOSState } from './agent-os';

// Priority scoring model
export interface PriorityScore {
  id: string;
  overall: number; // 0-100, higher = more important
  components: {
    urgency: number; // 0-100, time-based priority
    importance: number; // 0-100, impact on goals
    deadline: number; // 0-100, proximity to deadline
    dependencies: number; // 0-100, blocker status
    energy_required: number; // 0-100, effort/cognitive load
    user_focus: number; // 0-100, alignment with current focus
  };
  decay_factor: number; // 0-1, decreases over time
  last_updated: number;
}

export interface PriorityAgentConfig {
  eisenhower_weights: {
    urgent_important: number; // quadrant 1: Do first
    not_urgent_important: number; // quadrant 2: Schedule
    urgent_not_important: number; // quadrant 3: Delegate
    not_urgent_not_important: number; // quadrant 4: Eliminate
  };
  deadline_decay_thresholds: {
    under_1h: number;
    under_24h: number;
    under_1w: number;
    over_1w: number;
  };
  energy_allocation: {
    high_energy_tasks: number; // >75 energy level
    medium_energy_tasks: number; // 25-75 energy level
    low_energy_tasks: number; // <25 energy level
  };
}

export interface TaskContext {
  taskId: string;
  description: string;
  deadline?: Date;
  dependencies: string[];
  tags: string[];
  context_type: 'work' | 'personal' | 'project';
  user_focus_areas: string[];
  estimated_energy?: number;
  user_energy_level?: number;
  user_focus_state?: 'deep_work' | 'interrupt_handling' | 'distracted' | 'creative';
}

export interface PriorityAgentState {
  scores: Map<string, PriorityScore>;
  config: PriorityAgentConfig;
  last_user_focus_change: number;
  learning_patterns: Map<string, number>;
  energy_patterns: Map<string, number>;
  is_running: boolean;
  is_learning: boolean;
}

// Default configuration for the Priority Agent
const defaultConfig: PriorityAgentConfig = {
  eisenhower_weights: {
    urgent_important: 100,
    not_urgent_important: 60,
    urgent_not_important: 40,
    not_urgent_not_important: 20,
  };
  deadline_decay_thresholds: {
    under_1h: 100,
    under_24h: 80,
    under_1w: 60,
    over_1w: 40,
  };
  energy_allocation: {
    high_energy_tasks: 100,
    medium_energy_tasks: 80,
    low_energy_tasks: 50,
  };
};

// Priority Agent Store
export const usePriorityAgent = create<PriorityAgentState>((set, get) => ({
  scores: new Map(),
  config: defaultConfig,
  last_user_focus_change: Date.now(),
  learning_patterns: new Map(),
    energy_patterns: new Map(),
  is_running: true,
  is_learning: true,

  // Update or create a priority score for a task
  updateScore: (taskContext: TaskContext, userFocusState?: string) => {
    const scores = new Map(get().scores);
    const userFocus = userFocusState || get().last_user_focus_change;

    // Calculate component scores
    const urgencyScore = calculateUrgency(taskContext);
    const importanceScore = calculateImportance(taskContext);
    const deadlineScore = calculateDeadline(taskContext);
    const dependenciesScore = calculateDependencies(taskContext);
    const energyScore = calculateEnergy(taskContext);
    const userFocusScore = calculateUserFocus(taskContext, userFocus);

    // Calculate decay factor (lower for older tasks)
    const ageMinutes = (Date.now() - taskContext.last_updated) / 60000;
    const decayFactor = Math.max(0, 1 - ageMinutes * 0.001); // 0.1% decay per minute

    // Determine Eisenhower quadrant
    const isUrgent = taskContext.deadline ? isDeadlineUrgent(taskContext.deadline) : false;
    const isImportant = importanceScore > 50;

    let eisenhowerScore: number;
    if (isUrgent && isImportant) eisenhowerScore = defaultConfig.eisenhower_weights.urgent_important;
    else if (!isUrgent && isImportant) eisenhowerScore = defaultConfig.eisenhower_weights.not_urgent_important;
    else if (isUrgent && !isImportant) eisenhowerScore = defaultConfig.eisenhower_weights.urgent_not_important;
    else eisenhowerScore = defaultConfig.eisenhower_weights.not_urgent_not_important;

    // Calculate overall score
    const overallScore = Math.round(
      (urgencyScore * 0.25 + importanceScore * 0.20 + deadlineScore * 0.20 +
       dependenciesScore * 0.15 + energyScore * 0.10 + userFocusScore * 0.10)
    );

    const priorityScore: PriorityScore = {
      id: taskContext.taskId,
      overall: overallScore,
      components: {
        urgency: Math.round(urgencyScore),
        importance: Math.round(importanceScore),
        deadline: Math.round(deadlineScore),
        dependencies: Math.round(dependenciesScore),
        energy_required: Math.round(energyScore),
        user_focus: Math.round(userFocusScore),
      },
      decay_factor: decayFactor,
      last_updated: Date.now(),
    };

    scores.set(taskContext.taskId, priorityScore);

    // Record learning patterns
    updateLearningPattern(taskContext, overallScore);
    updateEnergyPattern(taskContext, energyScore);

    set({ scores });
    return priorityScore;
  },

  // Get ranked list of tasks
  getRankedTasks: (agentId: string) => {
    const scores = get().scores;
    const agent = get().agents.get(agentId);

    return Array.from(scores.values())
      .map(score => ({
        taskId: score.id,
        score: score.overall,
        components: score.components,
        eisenhower_quadrant: (() => {
          const task = getTask(score.id);
          if (!task) return 4;
          const isUrgent = task.deadline ? isDeadlineUrgent(task.deadline) : false;
          const isImportant = score.components.importance > 50;
          if (isUrgent && isImportant) return 1;
          if (!isUrgent && isImportant) return 2;
          if (isUrgent && !isImportant) return 3;
          return 4;
        })(),
      }))
      .sort((a, b) => {
        // Sort by overall score (descending), then by eisenhower quadrant (1 first)
        if (b.score !== a.score) return b.score - a.score;
        return a.eisenhower_quadrant - b.eisenhower_quadrant;
      });
  },

  // Update user focus state
  updateUserFocus: (focusState: string) => {
    set({ last_user_focus_change: Date.now() });
  },

  // Get energy-based task recommendations
  getEnergyBasedRecommendations: (currentEnergyLevel: number) => {
    const energyScore = currentEnergyLevel > 75 ? 'high_energy_tasks' :
                       currentEnergyLevel > 25 ? 'medium_energy_tasks' : 'low_energy_tasks';

    return get().scores;
  },
}));

// Helper functions
function calculateUrgency(task: TaskContext): number {
  if (!task.deadline) return defaultConfig.deadline_decay_thresholds.over_1w;

  const now = Date.now();
  const deadline = task.deadline.getTime();
  const hoursUntilDeadline = (deadline - now) / (1000 * 60 * 60);

  if (hoursUntilDeadline <= 1) return defaultConfig.deadline_decay_thresholds.under_1h;
  if (hoursUntilDeadline <= 24) return defaultConfig.deadline_decay_thresholds.under_24h;
  if (hoursUntilDeadline <= 168) return defaultConfig.deadline_decay_thresholds.under_1w;
  return defaultConfig.deadline_decay_thresholds.over_1w;
}

function calculateImportance(task: TaskContext): number {
  // Simple heuristic based on description length, tags complexity, and dependencies
  let score = 50;

  if (task.description.length > 100) score += 20;
  if (task.tags.length > 3) score += 15;
  if (task.dependencies.length > 0) score += 25;

  // Adjust based on context type
  switch (task.context_type) {
    case 'work':
      score += 20;
      break;
    case 'personal':
      score += 10;
      break;
    case 'project':
      score += 30;
      break;
  }

  return Math.min(100, score);
}

function calculateDeadline(task: TaskContext): number {
  if (!task.deadline) return defaultConfig.deadline_decay_thresholds.over_1w;

  const now = Date.now();
  const deadline = task.deadline.getTime();
  const hoursUntilDeadline = (deadline - now) / (1000 * 60 * 60);

  if (hoursUntilDeadline <= 1) return defaultConfig.deadline_decay_thresholds.under_1h;
  if (hoursUntilDeadline <= 24) return defaultConfig.deadline_decay_thresholds.under_24h;
  if (hoursUntilDeadline <= 168) return defaultConfig.deadline_decay_thresholds.under_1w;
  return defaultConfig.deadline_decay_thresholds.over_1w;
}

function calculateDependencies(task: TaskContext): number {
  // Blockers have high priority (100), tasks with fewer dependencies have lower priority
  if (task.dependencies.length > 0) return 100; // Could be blocked
  return 30; // Independent tasks
}

function calculateEnergy(task: TaskContext): number {
  if (task.estimated_energy !== undefined) {
    return 100 - (task.estimated_energy * 100); // Lower energy required = higher score
  }

  // Estimate based on description complexity
  const complexity = task.description.length / 10; // Rough estimate
  return Math.max(10, Math.min(100, 100 - (complexity * 5)));
}

function calculateUserFocus(task: TaskContext, userFocusState: number): number {
  if (task.user_focus_state === userFocusState) return 100;
  return 50; // Default middle score
}

function isDeadlineUrgent(deadline: Date): boolean {
  const now = Date.now();
  const hoursUntilDeadline = (deadline.getTime() - now) / (1000 * 60 * 60);
  return hoursUntilDeadline <= 4; // 4 hours or less is urgent
}

function updateLearningPattern(task: TaskContext, score: number): void {
  const patterns = get().learning_patterns;

  // Track task patterns based on outcome
  if (!patterns.has(task.context_type)) {
    patterns.set(task.context_type, {});
  }

  const typePattern = patterns.get(task.context_type) || {};
  if (!typePattern.scores) typePattern.scores = [];

  typePattern.scores.push(score);
  if (typePattern.scores.length > 100) typePattern.scores = typePattern.scores.slice(-100);

  // Calculate average score for this type
  typePattern.averageScore = typePattern.scores.reduce((a, b) => a + b, 0) / typePattern.scores.length;

  patterns.set(task.context_type, typePattern);
}

function updateEnergyPattern(task: TaskContext, energyScore: number): void {
  const patterns = get().energy_patterns;

  if (!patterns.has(task.user_focus_state || 'default')) {
    patterns.set(task.user_focus_state || 'default', { energy_scores: [], average: 0 });
  }

  const focusPattern = patterns.get(task.user_focus_state || 'default') || { energy_scores: [], average: 0 };
  focusPattern.energy_scores.push(energyScore);

  if (focusPattern.energy_scores.length > 100) focusPattern.energy_scores = focusPattern.energy_scores.slice(-100);

  focusPattern.average = focusPattern.energy_scores.reduce((a, b) => a + b, 0) / focusPattern.energy_scores.length;

  patterns.set(task.user_focus_state || 'default', focusPattern);
}

function getTask(taskId: string): TaskContext | null {
  // This would need to be provided by the application layer
  // For now, return null - caller should implement this
  return null;
}

// Auto-start learning if enabled
if (get().is_learning) {
  // Start continuous learning interval
  setInterval(() => {
    if (get().is_learning) {
      // Continuous learning logic here
    }
  }, 60000); // Every minute
}