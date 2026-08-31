import db from './db/schema';

/**
 * Intelligent Task Recommender Engine
 * Provides personalized task recommendations based on behavior patterns,
 * calendar integration, and context analysis
 */

export interface TaskRecommendation {
  taskId: number;
  taskName: string;
  description: string;
  recommendedTime?: string | null; // ISO timestamp string
  priority: 'high' | 'medium' | 'low';
  confidence: number; // 0-100
  reason: string;
  estimatedMinutes: number;
  tags: string[];
  category: string;
}

export interface UserContext {
  currentTime: Date;
  dayOfWeek: number; // 0-6
  hourOfDay: number; // 0-23
  upcomingDeadlines: number;
  pendingTasks: number;
  completedToday: number;
  typicalSessionLength: number;
  focusLevel: 'high' | 'medium' | 'low';
}

export interface RecommendationContext {
  userId: string;
  userContext: UserContext;
  includeCompleted: boolean;
  maxRecommendations: number;
}

// Database tables are now initialized in src/lib/db/schema.ts
// This module uses the shared db instance from schema.ts

// Analyze user behavior patterns
function analyzeUserBehavior(): {
  peakHours: number[];
  preferredTaskTypes: string[];
  averageSessionLength: number;
  completionRate: number;
  focusPattern: 'morning' | 'afternoon' | 'evening' | 'variable';
} {
  try {
    // Get completed tasks by hour
    const hourlyCompletion = db.prepare(`
      SELECT CAST(strftime('%H', completed_at) AS INTEGER) as hour, COUNT(*) as count
      FROM tasks
      WHERE completed_at IS NOT NULL AND date(completed_at) >= date('now', '-30 days')
      GROUP BY hour
      ORDER BY count DESC
      LIMIT 10
    `).all() as Array<{ hour: number; count: number }>;

    // Get completion rate
    const totalCompleted = db.prepare(`
      SELECT COUNT(*) as count FROM tasks WHERE is_completed = 1 AND date(completed_at) >= date('now', '-30 days')
    `).get() as { count: number };

    const totalCreated = db.prepare(`
      SELECT COUNT(*) as count FROM tasks WHERE date(created_at) >= date('now', '-30 days')
    `).get() as { count: number };

    // Get task types completed
    const taskTypes = db.prepare(`
      SELECT name, COUNT(*) as count
      FROM tasks
      WHERE is_completed = 1 AND date(completed_at) >= date('now', '-30 days')
      GROUP BY name
      ORDER BY count DESC
      LIMIT 10
    `).all() as Array<{ name: string; count: number }>;

    const peakHours = hourlyCompletion.map(h => h.hour);
    const completionRate = totalCreated.count > 0
      ? totalCompleted.count / totalCreated.count
      : 0;

    // Determine focus pattern
    const morningHours = hourlyCompletion.filter(h => h.hour >= 6 && h.hour < 12).reduce((sum, h) => sum + h.count, 0);
    const afternoonHours = hourlyCompletion.filter(h => h.hour >= 12 && h.hour < 18).reduce((sum, h) => sum + h.count, 0);
    const eveningHours = hourlyCompletion.filter(h => h.hour >= 18 && h.hour < 24).reduce((sum, h) => sum + h.count, 0);

    let focusPattern: 'morning' | 'afternoon' | 'evening' | 'variable';
    if (morningHours > afternoonHours && morningHours > eveningHours) {
      focusPattern = 'morning';
    } else if (afternoonHours > morningHours && afternoonHours > eveningHours) {
      focusPattern = 'afternoon';
    } else if (eveningHours > morningHours && eveningHours > afternoonHours) {
      focusPattern = 'evening';
    } else {
      focusPattern = 'variable';
    }

    // Calculate average session length (time between tasks)
    const avgSession = db.prepare(`
      SELECT AVG(estimate_minutes) as avg_estimate
      FROM tasks
      WHERE is_completed = 1 AND date(completed_at) >= date('now', '-30 days')
    `).get() as { avg_estimate: number };

    return {
      peakHours,
      preferredTaskTypes: taskTypes.map(t => t.name),
      averageSessionLength: avgSession.avg_estimate || 30,
      completionRate,
      focusPattern
    };
  } catch (e) {
    console.error('Failed to analyze user behavior:', e);
    return {
      peakHours: [],
      preferredTaskTypes: [],
      averageSessionLength: 30,
      completionRate: 0,
      focusPattern: 'variable'
    };
  }
}

// Get current user context
function getUserContext(): UserContext {
  const now = new Date();

  // Get upcoming deadlines count
  const upcomingDeadlines = db.prepare(`
    SELECT COUNT(*) as count FROM tasks
    WHERE deadline <= datetime('now', '+7 days')
    AND is_completed = 0
  `).get() as { count: number };

  // Get pending tasks count
  const pendingTasks = db.prepare(`
    SELECT COUNT(*) as count FROM tasks
    WHERE is_completed = 0
  `).get() as { count: number };

  // Get completed today count
  const today = now.toISOString().split('T')[0];
  const completedToday = db.prepare(`
    SELECT COUNT(*) as count FROM tasks
    WHERE is_completed = 1 AND date(completed_at) = ?
  `).get(today) as { count: number };

  // Calculate typical session length from behavior
  const behavior = analyzeUserBehavior();

  // Determine focus level based on time of day
  const hour = now.getHours();
  let focusLevel: 'high' | 'medium' | 'low';
  if (hour >= 9 && hour < 12) focusLevel = 'high';
  else if (hour >= 14 && hour < 17) focusLevel = 'high';
  else if (hour >= 20 && hour < 23) focusLevel = 'medium';
  else focusLevel = 'low';

  return {
    currentTime: now,
    dayOfWeek: now.getDay(),
    hourOfDay: hour,
    upcomingDeadlines: upcomingDeadlines.count,
    pendingTasks: pendingTasks.count,
    completedToday: completedToday.count,
    typicalSessionLength: behavior.averageSessionLength,
    focusLevel
  };
}

// Generate task recommendations
export async function generateTaskRecommendations(
  context: RecommendationContext
): Promise<TaskRecommendation[]> {
  const { userContext, maxRecommendations = 5 } = context;
  const behavior = analyzeUserBehavior();

  try {
    // Get pending tasks
    const pendingTasks = db.prepare(`
      SELECT id, name, description, deadline, priority, estimate_minutes, tags
      FROM tasks
      WHERE is_completed = 0
      ORDER BY
        CASE priority
          WHEN 'high' THEN 3
          WHEN 'medium' THEN 2
          ELSE 1
        END DESC,
        deadline ASC
    `).all() as Array<{
      id: number;
      name: string;
      description: string;
      deadline: string | null;
      priority: string;
      estimate_minutes: number;
      tags: string | null;
    }>;

    // Score each task
    const scoredTasks = pendingTasks.map(task => {
      let score = 0;
      const reasons: string[] = [];
      let recommendedTime: Date | undefined;

      // 1. Deadline proximity score
      if (task.deadline) {
        const deadline = new Date(task.deadline);
        const daysUntilDeadline = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

        if (daysUntilDeadline <= 1) {
          score += 50;
          reasons.push('Due tomorrow!');
        } else if (daysUntilDeadline <= 3) {
          score += 30;
          reasons.push('Due in 3 days');
        } else if (daysUntilDeadline <= 7) {
          score += 15;
          reasons.push('Due this week');
        }
      }

      // 2. Priority score
      const priorityScore = task.priority === 'high' ? 40 : task.priority === 'medium' ? 20 : 10;
      score += priorityScore;
      reasons.push(`Priority: ${task.priority}`);

      // 3. Session length match
      if (task.estimate_minutes && task.estimate_minutes <= (userContext.typicalSessionLength * 1.5)) {
        score += 10;
        reasons.push('Fits your typical session length');
      }

      // 4. Time of day optimization
      const taskHour = behavior.peakHours[0] || 9;
      if (Math.abs(userContext.hourOfDay - taskHour) <= 2) {
        score += 15;
        reasons.push('Recommended for your peak hours');
        recommendedTime = new Date();
        recommendedTime.setHours(taskHour, 0, 0, 0);
      }

      // 5. Tag-based preferences
      if (task.tags) {
        try {
          const taskTags = JSON.parse(task.tags);
          const matchingTags = taskTags.filter((tag: string) =>
            behavior.preferredTaskTypes.some(pt => pt.includes(tag))
          );
          if (matchingTags.length > 0) {
            score += 10;
            reasons.push('Matches your preferred task types');
          }
        } catch { /* ignore JSON parse errors */ }
      }

      // 6. Completion pattern matching
      if (behavior.focusPattern === 'morning' && userContext.hourOfDay < 12) {
        score += 10;
        reasons.push('Fits your morning focus pattern');
      } else if (behavior.focusPattern === 'afternoon' && userContext.hourOfDay >= 14) {
        score += 10;
        reasons.push('Fits your afternoon focus pattern');
      }

      // Calculate confidence based on score
      const confidence = Math.min(100, Math.round((score / 150) * 100));

      return {
        taskId: task.id,
        taskName: task.name,
        description: task.description || '',
        recommendedTime: recommendedTime?.toISOString(),
        priority: task.priority as 'high' | 'medium' | 'low',
        confidence,
        reason: reasons.join('; '),
        estimatedMinutes: task.estimate_minutes || 30,
        tags: task.tags ? JSON.parse(task.tags) : [],
        category: 'recommended'
      };
    });

    // Sort by score and return top recommendations
    const sortedRecommendations = scoredTasks
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxRecommendations);

    return sortedRecommendations;
  } catch (e) {
    console.error('Failed to generate recommendations:', e);
    return [];
  }
}

// Get smart task scheduling suggestions
export async function getSmartScheduleSuggestions(): Promise<Array<{
  taskId: number;
  taskName: string;
  suggestedTime: string;
  duration: number;
  reason: string;
}>> {
  try {
    const behavior = analyzeUserBehavior();
    const userContext = getUserContext();

    // Get high priority tasks with deadlines
    const urgentTasks = db.prepare(`
      SELECT id, name, deadline, estimate_minutes, priority
      FROM tasks
      WHERE is_completed = 0 AND priority = 'high'
      ORDER BY deadline ASC
      LIMIT 5
    `).all() as Array<{
      id: number;
      name: string;
      deadline: string;
      estimate_minutes: number;
      priority: string;
    }>;

    // Generate schedule suggestions
    const suggestions = urgentTasks.map(task => {
      const deadline = new Date(task.deadline);
      const daysUntilDeadline = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

      // Calculate when to start based on deadline and estimated time
      const daysNeeded = Math.ceil(task.estimate_minutes / userContext.typicalSessionLength);
      const startDate = new Date(Date.now());
      startDate.setDate(startDate.getDate() + Math.max(0, daysUntilDeadline - daysNeeded));

      // Find best time of day based on peak hours
      const bestHour = behavior.peakHours[0] || 9;
      startDate.setHours(bestHour, 0, 0, 0);

      return {
        taskId: task.id,
        taskName: task.name,
        suggestedTime: startDate.toISOString(),
        duration: task.estimate_minutes,
        reason: `Start ${daysNeeded} days before deadline (due in ${daysUntilDeadline} days)`
      };
    });

    return suggestions;
  } catch (e) {
    console.error('Failed to get schedule suggestions:', e);
    return [];
  }
}

// Record user interaction with a recommendation
export function recordRecommendationInteraction(
  userId: string,
  taskId: number,
  action: 'shown' | 'clicked' | 'completed' | 'dismissed'
): void {
  try {
    db.prepare(`
      INSERT INTO task_recommendations (user_id, task_id, recommendation_type, confidence)
      VALUES (?, ?, ?, ?)
    `).run(userId, taskId, action, 50);
  } catch (e) {
    console.error('Failed to record recommendation interaction:', e);
  }
}

// Get recommendation statistics
export function getRecommendationStats(userId: string = 'default'): {
  totalShown: number;
  totalClicked: number;
  totalCompleted: number;
  clickThroughRate: number;
  completionRate: number;
} {
  try {
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_shown,
        SUM(CASE WHEN recommendation_type = 'clicked' THEN 1 ELSE 0 END) as total_clicked,
        SUM(CASE WHEN recommendation_type = 'completed' THEN 1 ELSE 0 END) as total_completed
      FROM task_recommendations
      WHERE user_id = ?
    `).get(userId) as {
      total_shown: number;
      total_clicked: number;
      total_completed: number;
    };

    const totalShown = stats.total_shown;
    const totalClicked = stats.total_clicked;
    const totalCompleted = stats.total_completed;

    return {
      totalShown,
      totalClicked,
      totalCompleted,
      clickThroughRate: totalShown > 0 ? Math.round((totalClicked / totalShown) * 100) : 0,
      completionRate: totalClicked > 0 ? Math.round((totalCompleted / totalClicked) * 100) : 0
    };
  } catch (e) {
    console.error('Failed to get recommendation stats:', e);
    return {
      totalShown: 0,
      totalClicked: 0,
      totalCompleted: 0,
      clickThroughRate: 0,
      completionRate: 0
    };
  }
}

// Get personalized task list based on behavior patterns
export async function getPersonalizedTaskList(
  maxTasks: number = 20
): Promise<TaskRecommendation[]> {
  try {
    const userContext = getUserContext();

    // Get tasks with comprehensive filtering
    const tasks = db.prepare(`
      SELECT id, name, description, deadline, priority, estimate_minutes, tags, created_at
      FROM tasks
      WHERE is_completed = 0
      ORDER BY
        CASE priority
          WHEN 'high' THEN 3
          WHEN 'medium' THEN 2
          ELSE 1
        END DESC,
        COALESCE(deadline, '9999-12-31') ASC,
        created_at ASC
      LIMIT ?
    `).all(maxTasks) as Array<{
      id: number;
      name: string;
      description: string;
      deadline: string | null;
      priority: string;
      estimate_minutes: number;
      tags: string | null;
      created_at: string;
    }>;

    // Score each task
    const scoredTasks = tasks.map(task => {
      let score = 0;
      const reasons: string[] = [];

      // Deadline proximity
      if (task.deadline) {
        const daysUntil = Math.ceil((new Date(task.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (daysUntil <= 0) {
          score += 50;
          reasons.push('Overdue!');
        } else if (daysUntil <= 1) {
          score += 40;
          reasons.push('Due tomorrow');
        } else if (daysUntil <= 3) {
          score += 25;
          reasons.push('Due soon');
        } else {
          score += 5;
          reasons.push('Has deadline');
        }
      } else {
        score += 5;
        reasons.push('No deadline');
      }

      // Priority boost
      score += task.priority === 'high' ? 30 : task.priority === 'medium' ? 15 : 5;

      // Time estimate fit
      if (task.estimate_minutes && task.estimate_minutes <= userContext.typicalSessionLength) {
        score += 10;
        reasons.push('Short task');
      }

      return {
        taskId: task.id,
        taskName: task.name,
        description: task.description || '',
        recommendedTime: undefined,
        priority: task.priority as 'high' | 'medium' | 'low',
        confidence: Math.min(100, score),
        reason: reasons.join('; '),
        estimatedMinutes: task.estimate_minutes || 30,
        tags: task.tags ? JSON.parse(task.tags) : [],
        category: 'personalized'
      };
    });

    return scoredTasks.sort((a, b) => b.confidence - a.confidence);
  } catch (e) {
    console.error('Failed to get personalized task list:', e);
    return [];
  }
}

// Export non-inline functions (the rest use inline `export function`)
export {
  analyzeUserBehavior,
  getUserContext
};