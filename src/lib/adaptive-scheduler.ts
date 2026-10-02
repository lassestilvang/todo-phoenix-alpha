// Adaptive Task Scheduling with ML-based optimization

import db from './db/schema';
import { taskOperations } from './db/tasks';

export interface TaskPattern {
  taskId: number;
  estimatedDuration: number;
  actualDuration: number;
  completionRate: number;
  preferredStartTime: number; // hour of day (0-23)
  preferredDayOfWeek: number[]; // 0-6
  energyLevel: 'low' | 'medium' | 'high';
  cognitiveLoad: 'light' | 'medium' | 'heavy';
  context: string[]; // tags/context markers
}

export interface SchedulingRecommendation {
  taskId: number;
  taskName: string;
  scheduledDate: string;
  scheduledTime: string; // HH:MM format
  estimatedDuration: number;
  priority: number; // 1-10
  confidence: number; // 0-1
  reason: string;
  energyMatch: boolean;
  contextMatch: boolean;
}

export interface UserBehaviorProfile {
  userId: string;
  peakProductivityHours: { start: number; end: number; dayOfWeek: number };
  averageTaskDuration: number;
  preferredWorkBlocks: number[]; // hours when user is most productive
  breakPatterns: { afterMinutes: number; breakDuration: number };
  completionPatterns: { dayOfWeek: number; hour: number; completionRate: number }[];
  procrastinationTriggers: string[];
  energyCycles: { hour: number; level: number }[];
}

export interface AdaptiveScheduleConfig {
  optimizationGoal: 'completion' | 'balance' | 'focus';
  maxDailyTasks: number;
  minBreakBetweenTasks: number; // minutes
  preferMorningTasks: boolean;
  energyAwareScheduling: boolean;
  contextSwitchingPenalty: number; // minutes lost between different task types
}

const DEFAULT_CONFIG: AdaptiveScheduleConfig = {
  optimizationGoal: 'completion',
  maxDailyTasks: 8,
  minBreakBetweenTasks: 15,
  preferMorningTasks: true,
  energyAwareScheduling: true,
  contextSwitchingPenalty: 25,
};

// Load or create user behavior profile
function getUserProfile(userId: string = 'default'): UserBehaviorProfile {
  if (typeof window === 'undefined') {
    return createDefaultProfile(userId);
  }

  try {
    const stored = localStorage.getItem(`adaptive-schedule-profile-${userId}`);
    if (stored) {
      return { ...createDefaultProfile(userId), ...JSON.parse(stored) };
    }
  } catch {
    // Use defaults
  }

  return createDefaultProfile(userId);
}

function createDefaultProfile(userId: string): UserBehaviorProfile {
  return {
    userId,
    peakProductivityHours: { start: 9, end: 11, dayOfWeek: 1 }, // Monday morning
    averageTaskDuration: 45,
    preferredWorkBlocks: [9, 10, 11, 14, 15, 16],
    breakPatterns: { afterMinutes: 25, breakDuration: 5 },
    completionPatterns: [],
    procrastinationTriggers: [],
    energyCycles: [
      { hour: 6, level: 0.3 },
      { hour: 9, level: 0.9 },
      { hour: 12, level: 0.6 },
      { hour: 14, level: 0.7 },
      { hour: 17, level: 0.5 },
      { hour: 20, level: 0.2 },
    ],
  };
}

function saveUserProfile(profile: UserBehaviorProfile) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      `adaptive-schedule-profile-${profile.userId}`,
      JSON.stringify(profile)
    );
  } catch {
    // Ignore storage errors
  }
}

// Analyze task completion history to learn patterns
function analyzeTaskPatterns(taskId: number): TaskPattern | null {
  const task = taskOperations.getById(taskId);
  if (!task) return null;

  // Get time entries for this task
  const timeEntries = db
    .prepare(`
      SELECT started_at, stopped_at, duration_minutes
      FROM time_entries
      WHERE task_id = ? AND stopped_at IS NOT NULL
      ORDER BY started_at DESC
      LIMIT 20
    `)
    .all(taskId) as any[];

  if (timeEntries.length === 0) {
    // No history yet, return defaults based on task properties
    return {
      taskId,
      estimatedDuration: task.estimate_minutes || 30,
      actualDuration: task.estimate_minutes || 30,
      completionRate: 0.5, // Neutral default
      preferredStartTime: 9,
      preferredDayOfWeek: [1, 2, 3, 4, 5], // Weekdays
      energyLevel: 'medium',
      cognitiveLoad: 'medium',
      context: [],
    };
  }

  const durations = timeEntries.map((e) => e.duration_minutes);
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const completionRate = task.is_completed
    ? 1.0
    : Math.min(1.0, durations.length / 5); // Simple heuristic

  // Analyze completion times
  const completionHours = timeEntries.map((e) => {
    const date = new Date(e.started_at);
    return date.getHours();
  });
  const preferredHour =
    completionHours.length > 0
      ? completionHours.sort(
          (a, b) =>
            completionHours.filter((h) => h === a).length -
            completionHours.filter((h) => h === b).length
        ).pop() ?? 9
      : 9;

  // Analyze days of week
  const completionDays = timeEntries.map((e) => {
    const date = new Date(e.started_at);
    return date.getDay();
  });
  const preferredDays = [...new Set(completionDays)].sort(
    (a, b) =>
      completionDays.filter((d) => d === b).length -
      completionDays.filter((d) => d === a).length
  );

  return {
    taskId,
    estimatedDuration: task.estimate_minutes || 30,
    actualDuration: Math.round(avgDuration),
    completionRate,
    preferredStartTime: preferredHour,
    preferredDayOfWeek: preferredDays,
    energyLevel: avgDuration > 120 ? 'high' : avgDuration > 60 ? 'medium' : 'low',
    cognitiveLoad: task.priority === 'high' ? 'heavy' : task.priority === 'medium' ? 'medium' : 'light',
    context: [],
  };
}

// Calculate energy level at a given hour
function getEnergyLevelAtHour(hour: number, energyCycles: { hour: number; level: number }[]): number {
  if (energyCycles.length === 0) return 0.5;

  // Find closest cycle point
  let closest = energyCycles[0];
  let minDiff = Math.abs(hour - closest.hour);

  for (const cycle of energyCycles) {
    const diff = Math.abs(hour - cycle.hour);
    if (diff < minDiff) {
      minDiff = diff;
      closest = cycle;
    }
  }

  // Interpolate between nearby points
  return closest.level;
}

// Calculate the best time slot for a task
function calculateOptimalTimeSlot(
  taskPattern: TaskPattern,
  profile: UserBehaviorProfile,
  date: Date,
  config: AdaptiveScheduleConfig
): { hour: number; confidence: number; reason: string } {
  const dayOfWeek = date.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // Get user's preferred hours for this day
  const preferredHour = taskPattern.preferredStartTime;
  const energyAtPreferred = getEnergyLevelAtHour(preferredHour, profile.energyCycles);

  // Check if this is a high-energy time
  const isHighEnergy = energyAtPreferred > 0.7;

  // Calculate confidence based on multiple factors
  let confidence = 0.5;
  const reasons: string[] = [];

  // Factor 1: Energy match
  if (config.energyAwareScheduling && isHighEnergy) {
    confidence += 0.2;
    reasons.push('High energy period');
  } else if (config.energyAwareScheduling && !isHighEnergy) {
    confidence -= 0.1;
  }

  // Factor 2: Historical preference
  if (taskPattern.preferredDayOfWeek.includes(dayOfWeek)) {
    confidence += 0.15;
    reasons.push('Matches historical pattern');
  }

  // Factor 3: Morning preference
  if (config.preferMorningTasks && preferredHour < 12) {
    confidence += 0.1;
    reasons.push('Morning preference');
  }

  // Factor 4: Task complexity vs time of day
  if (taskPattern.cognitiveLoad === 'heavy' && isHighEnergy) {
    confidence += 0.15;
    reasons.push('Complex task during peak focus');
  } else if (taskPattern.cognitiveLoad === 'light' && !isHighEnergy) {
    confidence += 0.1;
    reasons.push('Light task during lower energy');
  }

  // Clamp confidence
  confidence = Math.max(0.1, Math.min(0.95, confidence));

  return {
    hour: preferredHour,
    confidence,
    reason: reasons.join('; ') || 'Default scheduling',
  };
}

// Generate adaptive schedule for a set of tasks
export function generateAdaptiveSchedule(
  taskIds: number[],
  startDate: Date = new Date(),
  config: Partial<AdaptiveScheduleConfig> = {}
): SchedulingRecommendation[] {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const profile = getUserProfile();
  const recommendations: SchedulingRecommendation[] = [];

  // Analyze patterns for all tasks
  const taskPatterns = taskIds
    .map((id) => analyzeTaskPatterns(id))
    .filter((p): p is TaskPattern => p !== null);

  // Sort tasks by priority (heavy tasks first during high energy)
  const sortedTasks = [...taskPatterns].sort((a, b) => {
    // Heavy cognitive load tasks first
    if (a.cognitiveLoad === 'heavy' && b.cognitiveLoad !== 'heavy') return -1;
    if (b.cognitiveLoad === 'heavy' && a.cognitiveLoad !== 'heavy') return 1;
    // Then by estimated duration (longer tasks first)
    return b.estimatedDuration - a.estimatedDuration;
  });

  // Generate schedule for each task
  const currentDate = new Date(startDate);
  let currentHour = profile.preferredWorkBlocks[0] || 9;

  for (const pattern of sortedTasks) {
    const slot = calculateOptimalTimeSlot(pattern, profile, currentDate, mergedConfig);

    // Check if we need to move to next day
    if (currentHour >= 18) {
      currentDate.setDate(currentDate.getDate() + 1);
      currentHour = profile.preferredWorkBlocks[0] || 9;
    }

    // Skip weekends if task is weekday-only
    if (pattern.preferredDayOfWeek.length <= 2 && pattern.preferredDayOfWeek.every(d => d === 0 || d === 6)) {
      currentDate.setDate(currentDate.getDate() + 1);
      currentHour = profile.preferredWorkBlocks[0] || 9;
    }

    const task = taskOperations.getById(pattern.taskId);
    if (!task) continue;

    recommendations.push({
      taskId: pattern.taskId,
      taskName: task.name,
      scheduledDate: currentDate.toISOString().split('T')[0],
      scheduledTime: `${slot.hour.toString().padStart(2, '0')}:00`,
      estimatedDuration: pattern.estimatedDuration,
      priority: task.priority === 'high' ? 10 : task.priority === 'medium' ? 5 : 2,
      confidence: slot.confidence,
      reason: slot.reason,
      energyMatch: getEnergyLevelAtHour(slot.hour, profile.energyCycles) > 0.6,
      contextMatch: false, // Would need more context data
    });

    // Advance time (add task duration + break)
    currentHour += Math.ceil(pattern.estimatedDuration / 60) + Math.floor(mergedConfig.minBreakBetweenTasks / 60);
  }

  return recommendations;
}

// Get scheduling insights for a task
export function getSchedulingInsights(taskId: number): {
  bestTimeSlots: { hour: number; dayOfWeek: number; confidence: number }[];
  estimatedCompletionRate: number;
  suggestedDuration: number;
  procrastinationRisk: 'low' | 'medium' | 'high';
} {
  const pattern = analyzeTaskPatterns(taskId);
  const profile = getUserProfile();

  if (!pattern) {
    return {
      bestTimeSlots: [{ hour: 9, dayOfWeek: 1, confidence: 0.5 }],
      estimatedCompletionRate: 0.5,
      suggestedDuration: 30,
      procrastinationRisk: 'medium',
    };
  }

  // Calculate best time slots across the week
  const bestTimeSlots: { hour: number; dayOfWeek: number; confidence: number }[] = [];

  for (let day = 0; day < 7; day++) {
    for (let hour = 6; hour <= 20; hour++) {
      const energy = getEnergyLevelAtHour(hour, profile.energyCycles);
      const isPreferredDay = pattern.preferredDayOfWeek.includes(day);
      const isPreferredHour = hour === pattern.preferredStartTime;

      let confidence = 0.3;
      if (energy > 0.7) confidence += 0.3;
      if (isPreferredDay) confidence += 0.2;
      if (isPreferredHour) confidence += 0.2;
      if (pattern.cognitiveLoad === 'light' || energy > 0.5) confidence += 0.1;

      if (confidence > 0.5) {
        bestTimeSlots.push({ hour, dayOfWeek: day, confidence: Math.min(0.95, confidence) });
      }
    }
  }

  // Sort by confidence
  bestTimeSlots.sort((a, b) => b.confidence - a.confidence);

  // Calculate procrastination risk
  let procrastinationRisk: 'low' | 'medium' | 'high' = 'low';
  if (pattern.completionRate < 0.5) procrastinationRisk = 'high';
  else if (pattern.completionRate < 0.8) procrastinationRisk = 'medium';

  return {
    bestTimeSlots: bestTimeSlots.slice(0, 5),
    estimatedCompletionRate: pattern.completionRate,
    suggestedDuration: pattern.actualDuration,
    procrastinationRisk,
  };
}

// Learn from task completion to improve future scheduling
export function learnFromCompletion(taskId: number, completed: boolean, actualDuration: number) {
  const profile = getUserProfile();
  const now = new Date();

  // Update completion patterns
  profile.completionPatterns.push({
    dayOfWeek: now.getDay(),
    hour: now.getHours(),
    completionRate: completed ? 1 : 0,
  });

  // Update average task duration
  const allDurations = profile.completionPatterns.map((p) => {
    // Approximate based on hour (would need more data in real implementation)
    return profile.averageTaskDuration;
  });
  allDurations.push(actualDuration);
  profile.averageTaskDuration =
    allDurations.reduce((a, b) => a + b, 0) / allDurations.length;

  // Detect procrastination triggers (tasks completed at end of day)
  if (!completed && now.getHours() >= 17) {
    profile.procrastinationTriggers.push('late-day');
  }

  saveUserProfile(profile);
}

// Get daily schedule recommendations
export function getDailyRecommendations(
  date: Date = new Date(),
  maxTasks: number = 5
): SchedulingRecommendation[] {
  const incompleteTasks = taskOperations.getAll(false);
  const taskIds = incompleteTasks.map((t) => t.id);

  const allRecommendations = generateAdaptiveSchedule(taskIds, date);

  // Filter for the specific date and limit count
  const dateStr = date.toISOString().split('T')[0];
  return allRecommendations
    .filter((r) => r.scheduledDate === dateStr)
    .slice(0, maxTasks)
    .sort((a, b) => b.priority - a.priority || b.confidence - a.confidence);
}

// Get schedule heatmap data for visualization
export function getScheduleHeatmapData(
  startDate: Date,
  days: number = 30
): { date: string; hour: number; confidence: number; taskCount: number }[] {
  const data: { date: string; hour: number; confidence: number; taskCount: number }[] = [];

  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];

    const recommendations = getDailyRecommendations(date, 10);

    for (const rec of recommendations) {
      const hour = parseInt(rec.scheduledTime.split(':')[0]);
      data.push({
        date: dateStr,
        hour,
        confidence: rec.confidence,
        taskCount: 1,
      });
    }
  }

  return data;
}

// Optimize existing schedule based on new constraints
export function optimizeSchedule(
  existingSchedule: SchedulingRecommendation[],
  newConstraints: {
    unavailableHours?: number[];
    unavailableDays?: number[];
    priorityBoost?: number[];
  }
): SchedulingRecommendation[] {
  const { unavailableHours = [], unavailableDays = [], priorityBoost = [] } = newConstraints;

  return existingSchedule.map((rec) => {
    const date = new Date(rec.scheduledDate);
    const dayOfWeek = date.getDay();
    const hour = parseInt(rec.scheduledTime.split(':')[0]);

    let newConfidence = rec.confidence;
    const newDate = rec.scheduledDate;
    let newTime = rec.scheduledTime;

    // Check if current slot is unavailable
    if (unavailableHours.includes(hour) || unavailableDays.includes(dayOfWeek)) {
      // Find next available slot
      let found = false;
      let tryHour = hour + 1;
      let tryDay = dayOfWeek;

      while (!found && tryDay < 7) {
        while (tryHour < 20) {
          if (!unavailableHours.includes(tryHour) && !unavailableDays.includes(tryDay)) {
            newTime = `${tryHour.toString().padStart(2, '0')}:00`;
            newConfidence *= 0.8; // Reduce confidence for rescheduled tasks
            found = true;
            break;
          }
          tryHour++;
        }
        if (!found) {
          tryHour = 6;
          tryDay++;
        }
      }
    }

    // Apply priority boost
    if (priorityBoost.includes(rec.taskId)) {
      newConfidence = Math.min(0.99, newConfidence + 0.15);
    }

    return {
      ...rec,
      scheduledDate: new Date(newDate).toISOString().split('T')[0],
      scheduledTime: newTime,
      confidence: newConfidence,
    };
  });
}
