import db from '../db/schema';

/**
 * Enhanced Analytics Dashboard
 * Provides comprehensive productivity insights
 */

export interface ProductivityMetrics {
  dailyProductivity: number;
  weeklyProductivity: number;
  monthlyProductivity: number;
  completionRate: number;
  estimatedVsActual: { estimated: number; actual: number; variance: number };
}

export interface TaskEfficiency {
  taskId: number;
  taskName: string;
  estimatedMinutes: number;
  actualMinutes: number;
  accuracy: number; // How close estimation was to actual
  efficiencyScore: number; // Weighted score
}

export interface WeeklyReport {
  weekStart: string;
  weekEnd: string;
  tasksCreated: number;
  tasksCompleted: number;
  totalTimeTracked: number;
  productivityScore: number;
  streakDays: number;
  topTasks: Array<{ id: number; name: string; duration: number }>;
  insights: string[];
}

export interface AchievementData {
  name: string;
  icon: string;
  rarity: string;
  earned_at: string;
}

// Get comprehensive analytics dashboard data
export function getEnhancedAnalyticsDashboard(): {
  taskStats: Record<string, any>;
  productivityMetrics: ProductivityMetrics;
  topProjects: any[];
  dailyActivity: any[];
  taskEfficiency: TaskEfficiency[];
  weeklyReports: WeeklyReport[];
  achievements: AchievementData[];
} {
  try {
    // Task completion stats
    const taskStats = {
      total: db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number },
      completed: db.prepare('SELECT COUNT(*) as count FROM tasks WHERE is_completed = 1').get() as { count: number },
      inProgress: db.prepare("SELECT COUNT(*) as count FROM tasks WHERE is_completed = 0 AND status = 'in_progress'").get() as { count: number },
      pending: db.prepare("SELECT COUNT(*) as count FROM tasks WHERE is_completed = 0 AND status = 'pending'").get() as { count: number },
      overdue: db.prepare("SELECT COUNT(*) as count FROM tasks WHERE deadline < datetime('now') AND is_completed = 0").get() as { count: number },
      totalTimeTracked: db.prepare('SELECT SUM(duration_minutes) as total FROM time_entries').get() as { total: number },
      totalAttachments: db.prepare('SELECT COUNT(*) as count FROM attachments').get() as { count: number }
    };

    // Productivity metrics
    const productivityMetrics: ProductivityMetrics = {
      dailyProductivity: calculateDailyProductivity(),
      weeklyProductivity: calculateWeeklyProductivity(),
      monthlyProductivity: calculateMonthlyProductivity(),
      completionRate: calculateCompletionRate(),
      estimatedVsActual: getEstimatedVsActual()
    };

    // Top projects (using labels as a proxy since projects table exists)
    const topProjects = db.prepare(`
      SELECT l.name, COUNT(tl.task_id) as taskCount
      FROM labels l
      JOIN task_labels tl ON l.id = tl.label_id
      JOIN tasks t ON tl.task_id = t.id
      WHERE t.is_completed = 1
      GROUP BY l.id, l.name
      ORDER BY taskCount DESC
      LIMIT 5
    `).all() as any[];

    // Daily activity (last 30 days)
    const dailyActivity = db.prepare(`
      SELECT
        date,
        COUNT(*) as tasksCreated,
        SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) as tasksCompleted
      FROM tasks
      WHERE date >= date('now', '-30 days')
      GROUP BY date
      ORDER BY date DESC
    `).all() as any[];

    // Task efficiency data
    const taskEfficiency = getTaskEfficiencyData();

    // Weekly reports (last 12 weeks)
    const weeklyReports = getWeeklyReports(12);

    // Recent achievements
    const achievements = getRecentAchievements();

    return {
      taskStats: {
        total: taskStats.total.count,
        completed: taskStats.completed.count,
        inProgress: taskStats.inProgress.count,
        pending: taskStats.pending.count,
        overdue: taskStats.overdue.count,
        totalTimeTracked: taskStats.totalTimeTracked.total || 0,
        totalAttachments: taskStats.totalAttachments.count
      },
      productivityMetrics,
      topProjects,
      dailyActivity,
      taskEfficiency,
      weeklyReports,
      achievements
    };
  } catch (e) {
    console.error('Failed to get enhanced analytics:', e);
    return {
      taskStats: {},
      productivityMetrics: {} as ProductivityMetrics,
      topProjects: [],
      dailyActivity: [],
      taskEfficiency: [],
      weeklyReports: [],
      achievements: []
    };
  }
}

// Calculate daily productivity (tasks completed today / total tasks created today)
function calculateDailyProductivity(): number {
  const today = new Date().toISOString().split('T')[0];
  const completedToday = db.prepare(
    "SELECT COUNT(*) as count FROM tasks WHERE date(date) = ? AND is_completed = 1"
  ).get(today) as { count: number };

  const createdToday = db.prepare(
    "SELECT COUNT(*) as count FROM tasks WHERE date(date) = ?"
  ).get(today) as { count: number };

  if (createdToday.count === 0) return 100;
  return Math.round((completedToday.count / createdToday.count) * 100);
}

// Calculate weekly productivity
function calculateWeeklyProductivity(): number {
  const totalCompleted = db.prepare(
    "SELECT COUNT(*) as count FROM tasks WHERE date(completed_at) >= date('now', '-7 days')"
  ).get() as { count: number };

  const totalCreated = db.prepare(
    "SELECT COUNT(*) as count FROM tasks WHERE date(created_at) >= date('now', '-7 days')"
  ).get() as { count: number };

  if (totalCreated.count === 0) return 100;
  return Math.round((totalCompleted.count / totalCreated.count) * 100);
}

// Calculate monthly productivity
function calculateMonthlyProductivity(): number {
  const totalCompleted = db.prepare(
    "SELECT COUNT(*) as count FROM tasks WHERE date(completed_at) >= date('now', '-30 days')"
  ).get() as { count: number };

  const totalCreated = db.prepare(
    "SELECT COUNT(*) as count FROM tasks WHERE date(created_at) >= date('now', '-30 days')"
  ).get() as { count: number };

  if (totalCreated.count === 0) return 100;
  return Math.round((totalCompleted.count / totalCreated.count) * 100);
}

// Calculate overall completion rate
function calculateCompletionRate(): number {
  const total = db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number };
  const completed = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE is_completed = 1').get() as { count: number };

  if (total.count === 0) return 0;
  return Math.round((completed.count / total.count) * 100);
}

// Get estimated vs actual time analysis
function getEstimatedVsActual(): { estimated: number; actual: number; variance: number } {
  const result = db.prepare(`
    SELECT
      SUM(estimate_minutes) as totalEstimated,
      SUM(actual_minutes) as totalActual
    FROM tasks
    WHERE is_completed = 1
  `).get() as { totalEstimated: number; totalActual: number };

  const estimated = result?.totalEstimated || 0;
  const actual = result?.totalActual || 0;
  const variance = estimated > 0 ? ((actual - estimated) / estimated) * 100 : 0;

  return { estimated, actual, variance: Math.round(variance) };
}

// Get task efficiency data
function getTaskEfficiencyData(): TaskEfficiency[] {
  const tasks = db.prepare(`
    SELECT id, name, estimate_minutes, actual_minutes
    FROM tasks
    WHERE is_completed = 1 AND estimate_minutes > 0 AND actual_minutes > 0
    ORDER BY created_at DESC
    LIMIT 20
  `).all() as any[];

  return tasks.map(task => {
    const accuracy = task.estimate_minutes > 0
      ? Math.max(0, 100 - Math.abs((task.actual_minutes - task.estimate_minutes) / task.estimate_minutes) * 100)
      : 0;

    return {
      taskId: task.id,
      taskName: task.name,
      estimatedMinutes: task.estimate_minutes,
      actualMinutes: task.actual_minutes,
      accuracy: Math.round(accuracy),
      efficiencyScore: Math.round(accuracy * 0.7 + (task.actual_minutes < task.estimate_minutes ? 100 : 0) * 0.3)
    };
  });
}

// Get weekly reports
function getWeeklyReports(weeks: number): WeeklyReport[] {
  const reports: WeeklyReport[] = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - (weekStart.getDay() + i * 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    const tasksCreated = db.prepare(
      "SELECT COUNT(*) as count FROM tasks WHERE date(created_at) >= ? AND date(created_at) <= ?"
    ).get(weekStartStr, weekEndStr) as { count: number };

    const tasksCompleted = db.prepare(
      "SELECT COUNT(*) as count FROM tasks WHERE date(completed_at) >= ? AND date(completed_at) <= ?"
    ).get(weekStartStr, weekEndStr) as { count: number };

    const totalTime = db.prepare(
      "SELECT SUM(duration_minutes) as total FROM time_entries WHERE date(started_at) >= ? AND date(started_at) <= ?"
    ).get(weekStartStr, weekEndStr) as { total: number };

    const productivityScore = tasksCreated.count > 0
      ? Math.round((tasksCompleted.count / tasksCreated.count) * 100)
      : 100;

    const topTasks = db.prepare(`
      SELECT id, name, duration_minutes
      FROM tasks t
      JOIN (
        SELECT task_id, SUM(duration_minutes) as duration_minutes
        FROM time_entries
        WHERE date(started_at) >= ? AND date(started_at) <= ?
        GROUP BY task_id
        ORDER BY duration_minutes DESC
        LIMIT 3
      ) te ON t.id = te.task_id
    `).all(weekStartStr, weekEndStr) as any[];

    // Generate insights for the week
    const insights: string[] = [];
    if (productivityScore >= 80) insights.push('Great productivity this week!');
    else if (productivityScore < 50) insights.push('Consider reviewing task estimation accuracy');

    if (totalTime.total > 2000) insights.push('High time investment detected');

    reports.push({
      weekStart: weekStartStr,
      weekEnd: weekEndStr,
      tasksCreated: tasksCreated.count,
      tasksCompleted: tasksCompleted.count,
      totalTimeTracked: totalTime.total || 0,
      productivityScore,
      streakDays: calculateStreakDays(weekStartStr, weekEndStr),
      topTasks: topTasks.map(t => ({
        id: t.id,
        name: t.name,
        duration: t.duration_minutes || 0
      })),
      insights
    });
  }

  return reports;
}

// Calculate streak days for a week
function calculateStreakDays(weekStart: string, weekEnd: string): number {
  let streak = 0;
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];

    const completed = db.prepare(
      "SELECT COUNT(*) as count FROM tasks WHERE date(completed_at) = ?"
    ).get(dateStr) as { count: number };

    if (completed.count > 0) streak++;
  }

  return streak;
}

// Get recent achievements
function getRecentAchievements(): AchievementData[] {
  return db.prepare(`
    SELECT a.name, a.icon, a.rarity, ub.earned_at
    FROM user_badges ub
    JOIN achievements a ON ub.achievement_id = a.id
    ORDER BY ub.earned_at DESC
    LIMIT 10
  `).all() as AchievementData[];
}

// Get personalized insights based on user data
export function getPersonalizedInsights(userId: string = 'default'): string[] {
  const insights: string[] = [];

  // Check completion rate
  const completionRate = calculateCompletionRate();
  if (completionRate < 50) {
    insights.push('Your completion rate is below 50%. Consider breaking large tasks into smaller ones.');
  } else if (completionRate > 90) {
    insights.push('Excellent work! Your completion rate is outstanding.');
  }

  // Check estimation accuracy
  const efficiencyData = getTaskEfficiencyData();
  if (efficiencyData.length > 0) {
    const avgAccuracy = efficiencyData.reduce((sum, t) => sum + t.accuracy, 0) / efficiencyData.length;
    if (avgAccuracy < 50) {
      insights.push('Your time estimates are often inaccurate. Try being more specific with estimates.');
    } else if (avgAccuracy > 80) {
      insights.push('Your task estimation skills are excellent!');
    }
  }

  // Check streak
  const streak = getRecentStreak();
  if (streak >= 7) {
    insights.push(`🔥 You\'re on a ${streak}-day completion streak!`);
  }

  // Check overdue tasks
  const overdue = db.prepare(
    "SELECT COUNT(*) as count FROM tasks WHERE deadline < datetime('now') AND is_completed = 0"
  ).get() as { count: number };

  if (overdue.count > 5) {
    insights.push(`You have ${overdue.count} overdue tasks. Consider reviewing and reprioritizing.`);
  }

  return insights;
}

// Get recent streak (consecutive days with completed tasks)
function getRecentStreak(): number {
  let streak = 0;
  const today = new Date();

  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    const completed = db.prepare(
      "SELECT COUNT(*) as count FROM tasks WHERE date(completed_at) = ? AND is_completed = 1"
    ).get(dateStr) as { count: number };

    if (completed.count > 0) {
      streak++;
    } else if (streak > 0) {
      break;
    }
  }

  return streak;
}

export {
  calculateDailyProductivity,
  calculateWeeklyProductivity,
  calculateMonthlyProductivity,
  calculateCompletionRate,
  getEstimatedVsActual,
  getTaskEfficiencyData,
  getWeeklyReports,
  calculateStreakDays,
  getRecentAchievements
};
