// Wellness & Burnout Prevention System

import db from './db/schema';

export interface WellnessMetrics {
  totalWorkMinutesToday: number;
  totalWorkMinutesWeek: number;
  avgSessionLength: number;
  breakFrequency: number; // breaks per hour
  energyLevel: 'low' | 'medium' | 'high';
  burnoutRisk: 'low' | 'medium' | 'high';
  stressScore: number; // 0-100
  wellbeingScore: number; // 0-100
  recoveryNeeds: { type: string; priority: 'low' | 'medium' | 'high' }[];
}

export interface RecoverySuggestion {
  type: 'break' | 'walk' | 'exercise' | 'meditation' | 'social';
  durationMinutes: number;
  description: string;
  confidence: number;
  urgency: 'low' | 'medium' | 'high';
}

export interface WorkPattern {
  hour: number;
  dayOfWeek: number;
  productivity: number; // 0-1
  focusLevel: number; // 0-1
  energyLevel: number; // 0-1
}

export interface DailyGoal {
  id: string;
  type: 'work' | 'break' | 'exercise' | 'social' | 'rest';
  targetMinutes: number;
  actualMinutes: number;
  completed: boolean;
}

export interface WellnessDashboardData {
  currentMetrics: WellnessMetrics;
  dailyGoals: DailyGoal[];
  recoverySuggestions: RecoverySuggestion[];
  weeklyTrend: {
    date: string;
    stressScore: number;
    productivity: number;
    wellbeing: number;
  }[];
}

// Default wellness configuration
const DEFAULT_CONFIG = {
  maxDailyWorkMinutes: 480, // 8 hours
  maxWorkBeforeBreak: 50, // minutes
  breakDuration: 10, // minutes
  maxConsecutiveWorkMinutes: 120,
  minBreakBetweenTasks: 15,
  weeklyMaxWorkHours: 45,
  stressThreshold: 70,
};

/**
 * Get current wellness metrics for a user
 */
export function getWellnessMetrics(userId: string = 'default'): WellnessMetrics {
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Get time entries for today
  const todayEntries = db.prepare(`
    SELECT duration_minutes, started_at
    FROM time_entries
    WHERE task_id IN (SELECT id FROM tasks WHERE owner_id = ?)
    AND started_at >= ?
    ORDER BY started_at DESC
  `).all(userId, today) as any[];

  const weekEntries = db.prepare(`
    SELECT duration_minutes, started_at
    FROM time_entries
    WHERE task_id IN (SELECT id FROM tasks WHERE owner_id = ?)
    AND started_at >= ?
    ORDER BY started_at DESC
  `).all(userId, weekAgo) as any[];

  const totalToday = todayEntries.reduce((sum, e) => sum + e.duration_minutes, 0);
  const totalWeek = weekEntries.reduce((sum, e) => sum + e.duration_minutes, 0);

  // Calculate average session length
  const avgSessionLength = todayEntries.length > 0
    ? Math.round(todayEntries.reduce((sum, e) => sum + e.duration_minutes, 0) / todayEntries.length)
    : 0;

  // Calculate break frequency (number of breaks / total hours worked)
  const workHoursToday = totalToday / 60;
  const breakFrequency = workHoursToday > 0
    ? Math.round((todayEntries.length / workHoursToday) * 100) / 100
    : 0;

  // Determine energy level based on session patterns
  const hours = todayEntries.map(e => new Date(e.started_at).getHours());
  const avgHour = hours.length > 0
    ? hours.reduce((a, b) => a + b, 0) / hours.length
    : 12;

  let energyLevel: 'low' | 'medium' | 'high' = 'medium';
  if (avgHour < 9 || avgHour >= 18) energyLevel = 'low';
  else if (avgHour >= 10 && avgHour < 15) energyLevel = 'high';

  // Calculate burnout risk
  let burnoutRisk: 'low' | 'medium' | 'high' = 'low';
  const stressScore = calculateStressScore(todayEntries, totalWeek);
  const wellbeingScore = 100 - stressScore;

  if (totalToday > DEFAULT_CONFIG.maxDailyWorkMinutes || stressScore > DEFAULT_CONFIG.stressThreshold) {
    burnoutRisk = 'high';
  } else if (totalWeek > DEFAULT_CONFIG.weeklyMaxWorkHours * 60 || stressScore > 50) {
    burnoutRisk = 'medium';
  }

  // Generate recovery needs
  const recoveryNeeds = generateRecoveryNeeds(
    todayEntries,
    stressScore,
    totalWeek,
    totalToday
  );

  return {
    totalWorkMinutesToday: totalToday,
    totalWorkMinutesWeek: totalWeek,
    avgSessionLength,
    breakFrequency,
    energyLevel,
    burnoutRisk,
    stressScore,
    wellbeingScore,
    recoveryNeeds,
  };
}

/**
 * Calculate stress score based on work patterns
 */
function calculateStressScore(
  todayEntries: any[],
  totalWeekMinutes: number
): number {
  let score = 0;

  // Long sessions increase stress
  const longSessions = todayEntries.filter(e => e.duration_minutes > 120);
  score += longSessions.length * 15;

  // Work hours over limit increases stress
  const hoursWorked = todayEntries.reduce((sum, e) => sum + e.duration_minutes, 0) / 60;
  if (hoursWorked > 8) score += (hoursWorked - 8) * 10;
  else if (hoursWorked > 6) score += 10;

  // Week over time increases stress
  if (totalWeekMinutes > 45 * 60) score += 20;
  else if (totalWeekMinutes > 40 * 60) score += 10;

  // Evening work increases stress
  const eveningEntries = todayEntries.filter(e => {
    const hour = new Date(e.started_at).getHours();
    return hour >= 19 || hour <= 7;
  });
  score += eveningEntries.length * 10;

  return Math.min(100, score);
}

/**
 * Generate recovery needs based on work patterns
 */
function generateRecoveryNeeds(
  todayEntries: any[],
  stressScore: number,
  weekMinutes: number,
  todayMinutes: number
): { type: string; priority: 'low' | 'medium' | 'high' }[] {
  const needs: { type: string; priority: 'low' | 'medium' | 'high' }[] = [];

  if (stressScore > 70) {
    needs.push({ type: 'Immediate rest', priority: 'high' });
    needs.push({ type: 'Meditation', priority: 'high' });
  }

  if (todayMinutes > 480) {
    needs.push({ type: 'Extended break', priority: 'medium' });
  }

  if (weekMinutes > 45 * 60) {
    needs.push({ type: 'Time off', priority: 'medium' });
  }

  if (todayEntries.length > 10) {
    needs.push({ type: 'Context switching break', priority: 'low' });
  }

  // Check if it's been too long since last break
  const lastEntry = todayEntries[0];
  if (lastEntry) {
    const minutesAgo = Math.floor(
      (Date.now() - new Date(lastEntry.started_at).getTime()) / 60000
    );
    if (minutesAgo > DEFAULT_CONFIG.maxWorkBeforeBreak) {
      needs.push({ type: 'Short break', priority: 'medium' });
    }
  }

  return needs;
}

/**
 * Get recovery suggestions based on current state
 */
export function getRecoverySuggestions(
  userId: string = 'default'
): RecoverySuggestion[] {
  const metrics = getWellnessMetrics(userId);
  const suggestions: RecoverySuggestion[] = [];

  // Break suggestions based on session length
  if (metrics.avgSessionLength > DEFAULT_CONFIG.maxWorkBeforeBreak) {
    suggestions.push({
      type: 'break',
      durationMinutes: DEFAULT_CONFIG.breakDuration,
      description: 'Time for a short break - step away from the screen',
      confidence: 0.9,
      urgency: 'high',
    });
  }

  // Walking suggestion for low energy
  if (metrics.energyLevel === 'low' || metrics.burnoutRisk === 'high') {
    suggestions.push({
      type: 'walk',
      durationMinutes: 15,
      description: 'Take a walk to boost energy and focus',
      confidence: 0.85,
      urgency: metrics.burnoutRisk === 'high' ? 'high' : 'medium',
    });
  }

  // Exercise for physical wellbeing
  if (metrics.totalWorkMinutesWeek > 30 * 60) {
    suggestions.push({
      type: 'exercise',
      durationMinutes: 30,
      description: 'Physical activity to counteract prolonged sitting',
      confidence: 0.7,
      urgency: 'medium',
    });
  }

  // Meditation for high stress
  if (metrics.stressScore > 50) {
    suggestions.push({
      type: 'meditation',
      durationMinutes: 10,
      description: 'Mindfulness meditation to reduce stress',
      confidence: 0.8,
      urgency: 'high',
    });
  }

  // Social connection
  if (metrics.totalWorkMinutesWeek > 35 * 60) {
    suggestions.push({
      type: 'social',
      durationMinutes: 20,
      description: 'Connect with colleagues or friends for wellbeing',
      confidence: 0.6,
      urgency: 'low',
    });
  }

  return suggestions.sort((a, b) => {
    const urgencyOrder = { high: 0, medium: 1, low: 2 };
    return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
  });
}

/**
 * Generate daily wellness goals
 */
export function generateDailyGoals(
  userId: string = 'default'
): DailyGoal[] {
  const metrics = getWellnessMetrics(userId);
  const today = new Date().toISOString().split('T')[0];

  const goals: DailyGoal[] = [
    {
      id: `work_${today}`,
      type: 'work',
      targetMinutes: Math.min(480, DEFAULT_CONFIG.maxDailyWorkMinutes),
      actualMinutes: metrics.totalWorkMinutesToday,
      completed: metrics.totalWorkMinutesToday >= 480,
    },
    {
      id: `break_${today}`,
      type: 'break',
      targetMinutes: DEFAULT_CONFIG.maxWorkBeforeBreak,
      actualMinutes: 0,
      completed: false,
    },
    {
      id: `exercise_${today}`,
      type: 'exercise',
      targetMinutes: 30,
      actualMinutes: 0,
      completed: false,
    },
    {
      id: `social_${today}`,
      type: 'social',
      targetMinutes: 20,
      actualMinutes: 0,
      completed: false,
    },
  ];

  // Add recovery goal if needed
  if (metrics.recoveryNeeds.length > 0) {
    goals.push({
      id: `recovery_${today}`,
      type: 'rest',
      targetMinutes: 15,
      actualMinutes: 0,
      completed: false,
    });
  }

  return goals;
}

/**
 * Get work pattern analysis for visualization
 */
export function getWorkPatternAnalysis(
  userId: string = 'default'
): WorkPattern[] {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const entries = db.prepare(`
    SELECT started_at, duration_minutes
    FROM time_entries
    WHERE task_id IN (SELECT id FROM tasks WHERE owner_id = ?)
    AND started_at >= ?
    ORDER BY started_at DESC
  `).all(userId, weekAgo) as any[];

  // Aggregate by hour and day
  const patterns: Map<string, { productivity: number; count: number }> = new Map();

  entries.forEach(entry => {
    const date = new Date(entry.started_at);
    const hour = date.getHours();
    const dayOfWeek = date.getDay();
    const key = `${dayOfWeek}-${hour}`;

    const existing = patterns.get(key);
    if (existing) {
      existing.productivity += entry.duration_minutes;
      existing.count++;
    } else {
      patterns.set(key, {
        productivity: entry.duration_minutes,
        count: 1,
      });
    }
  });

  // Convert to patterns with normalized values
  const maxProductivity = Math.max(
    ...Array.from(patterns.values()).map(p => p.productivity),
    1
  );

  const workPatterns: WorkPattern[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 6; hour <= 20; hour++) {
      const key = `${day}-${hour}`;
      const data = patterns.get(key);

      workPatterns.push({
        hour,
        dayOfWeek: day,
        productivity: data ? data.productivity / maxProductivity : 0,
        focusLevel: data && data.count > 3 ? 0.8 : data ? 0.5 : 0,
        energyLevel: data ? data.productivity / maxProductivity : 0,
      });
    }
  }

  return workPatterns;
}

/**
 * Get wellness recommendations for the day
 */
export function getWellnessRecommendations(
  userId: string = 'default'
): {
  energyOptimalHours: number[];
  breakSchedule: { hour: number; type: string }[];
  recoveryUrgency: 'low' | 'medium' | 'high';
  dailyTarget: { work: number; break: number; exercise: number };
} {
  const metrics = getWellnessMetrics(userId);
  const suggestions = getRecoverySuggestions(userId);

  // Find optimal hours based on past patterns
  const patterns = getWorkPatternAnalysis(userId);
  const energyHours = patterns
    .filter(p => p.energyLevel > 0.6)
    .sort((a, b) => b.energyLevel - a.energyLevel)
    .slice(0, 5)
    .map(p => p.hour);

  // Generate break schedule
  const breakSchedule = [];
  const workMinutesToday = metrics.totalWorkMinutesToday;
  const breakInterval = Math.max(30, DEFAULT_CONFIG.maxWorkBeforeBreak);

  for (let i = breakInterval; i <= 480; i += breakInterval) {
    const hour = Math.floor(i / 60);
    const minute = i % 60;
    breakSchedule.push({
      hour,
      type: minute === 0 ? 'short break' : 'extended break',
    });
  }

  // Calculate daily targets
  const dailyTarget = {
    work: Math.min(480, DEFAULT_CONFIG.maxDailyWorkMinutes),
    break: Math.floor(480 / breakInterval) * 10, // 10 min breaks
    exercise: 30,
  };

  return {
    energyOptimalHours: energyHours,
    breakSchedule,
    recoveryUrgency: metrics.burnoutRisk === 'high' ? 'high' : metrics.stressScore > 60 ? 'medium' : 'low',
    dailyTarget,
  };
}

/**
 * Check if user is at risk of burnout and generate intervention
 */
export function checkBurnoutRisk(
  userId: string = 'default'
): {
  isAtRisk: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  interventions: string[];
} {
  const metrics = getWellnessMetrics(userId);
  const interventions: string[] = [];

  let isAtRisk = false;
  let riskLevel: 'low' | 'medium' | 'high' = 'low';

  if (metrics.burnoutRisk === 'high' || metrics.stressScore > 80) {
    isAtRisk = true;
    riskLevel = 'high';
    interventions.push('Take immediate break - you have been working too long');
    interventions.push('Consider reducing today\'s workload');
    interventions.push('Reach out to manager or team for support');
  } else if (metrics.burnoutRisk === 'medium' || metrics.stressScore > 60) {
    isAtRisk = true;
    riskLevel = 'medium';
    interventions.push('Schedule a proper lunch break');
    interventions.push('Take short breaks every hour');
    interventions.push('Consider delegating or deferring non-critical tasks');
  } else if (metrics.stressScore > 40) {
    isAtRisk = true;
    riskLevel = 'low';
    interventions.push('Take a 10-minute break to maintain productivity');
  }

  return { isAtRisk, riskLevel, interventions };
}

/**
 * Get wellness dashboard data
 */
export function getWellnessDashboardData(
  userId: string = 'default'
): WellnessDashboardData {
  const metrics = getWellnessMetrics(userId);
  const recoverySuggestions = getRecoverySuggestions(userId);
  const dailyGoals = generateDailyGoals(userId);

  // Generate weekly trend
  const weekTrend = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    // Get data for this day
    const dayEntries = db.prepare(`
      SELECT duration_minutes, started_at
      FROM time_entries
      WHERE task_id IN (SELECT id FROM tasks WHERE owner_id = ?)
      AND started_at LIKE ?
    `).all(userId, `${dateStr}%`) as any[];

    const stressScore = calculateStressScore(dayEntries, 0);
    weekTrend.push({
      date: dateStr,
      stressScore,
      productivity: Math.min(100, dayEntries.reduce((sum, e) => sum + e.duration_minutes, 0) / 480 * 100),
      wellbeing: 100 - stressScore,
    });
  }

  return {
    currentMetrics: metrics,
    dailyGoals,
    recoverySuggestions,
    weeklyTrend: weekTrend,
  };
}