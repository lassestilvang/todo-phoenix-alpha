import db from './db/schema';

/**
 * Gamification system for task management
 */

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'productivity' | 'streak' | 'milestone' | 'consistency' | 'learning' | 'community';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  criteria: {
    type: 'completion' | 'streak' | 'time' | 'tasks' | 'points' | 'custom';
    value: number | string;
    operator: '>=' | '>' | '=' | '<' | '<=';
    timeframe?: 'daily' | 'weekly' | 'monthly' | 'all-time';
  };
  points: number;
  unlockedAt?: string;
}

export interface UserBadge {
  id: string;
  userId: string;
  achievementId: string;
  earnedAt: string;
  points: number;
}

export interface UserStreak {
  id: string;
  userId: string;
  streakType: 'daily-completion' | 'weekly-goal' | 'time-tracking';
  currentValue: number;
  maxStreak: number;
  lastAchievedAt: string;
  streakStart: string;
}

export interface UserLevel {
  id: number;
  userId: string;
  level: number;
  points: number;
  nextLevelPoints: number;
  milestones: {
    level: number;
    unlockedAt: string;
    rewards: string[];
  }[];
}

export interface TaskScore {
  taskId: number;
  estimatedMinutes: number;
  actualMinutes?: number;
  difficulty: number; // 1-5 scale
  pointValue: number; // Difficulty * 10
  bonusPoints: number;
  totalPoints: number;
  completedAt?: string;
}

export interface TeamChallenge {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  goalType: 'tasks' | 'points' | 'streak' | 'completion';
  targetValue: number;
  participants: { userId: string; team: string }[];
    currentProgress: number;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  rewards: string[];
  createdAt: string;
}

export interface Experience {
  userId: string;
  xp: number;
  lastUpdated: string;
  dailyBonusClaimed: boolean;
  streakBonusMultiplier: number; // Based on consecutive days
}

// Achievement definitions
export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-task',
    name: 'First Steps',
    description: 'Complete your first task',
    icon: '🎯',
    category: 'milestone',
    rarity: 'common',
    criteria: {
      type: 'completion',
      value: 1,
      operator: '>='
    },
    points: 10
  },
  {
    id: 'streak-7',
    name: 'Week Warrior',
    description: 'Complete tasks for 7 consecutive days',
    icon: '🔥',
    category: 'streak',
    rarity: 'rare',
    criteria: {
      type: 'streak',
      value: 7,
      operator: '>=',
      timeframe: 'daily'
    },
    points: 100
  },
  {
    id: 'streak-30',
    name: 'Month Master',
    description: 'Complete tasks for 30 consecutive days',
    icon: '🏆',
    category: 'streak',
    rarity: 'epic',
    criteria: {
      type: 'streak',
      value: 30,
      operator: '>=',
      timeframe: 'daily'
    },
    points: 500
  },
  {
    id: 'quick-completions',
    name: 'Speed Demon',
    description: 'Complete 5 tasks in under 15 minutes each',
    icon: '⚡',
    category: 'productivity',
    rarity: 'uncommon',
    criteria: {
      type: 'time',
      value: 15,
      operator: '<',
      timeframe: 'daily'
    },
    points: 50
  },
  {
    id: 'task-master',
    name: 'Task Master',
    description: 'Complete 50 tasks total',
    icon: '🧙',
    category: 'milestone',
    rarity: 'rare',
    criteria: {
      type: 'tasks',
      value: 50,
      operator: '>=',
      timeframe: 'all-time'
    },
    points: 200
  },
  {
    id: 'priority-chooser',
    name: 'Priority Pro',
    description: 'Mark 100 tasks as high priority',
    icon: '🎯',
    category: 'productivity',
    rarity: 'uncommon',
    criteria: {
      type: 'completion',
      value: 100,
      operator: '>=',
      timeframe: 'all-time'
    },
    points: 100
  }
];

export const LEVEL_THRESHOLDS = [100, 250, 500, 1000, 2000, 4000, 7000, 10000];

export const DAILY_BONUS_POINTS = 25;

export const gamificationOperations = {
  // Calculate points for task completion
  calculateTaskPoints: (task: TaskScore): number => {
    let points = task.pointValue + task.bonusPoints;

    // Time bonus for fast completion
    if (task.actualMinutes && task.actualMinutes < task.estimatedMinutes) {
      const timeRatio = task.estimatedMinutes / task.actualMinutes;
      points += Math.floor(points * 0.1 * timeRatio);
    }

    // First task bonus
    if (task.taskId === 1) {
      points += 50;
    }

    return points;
  },

  // Award points to user
  awardPoints: (userId: string, points: number, source: string): number => {
    const experience = db.prepare(
      'SELECT xp FROM user_experience WHERE user_id = ?'
    ).get(userId) as { xp: number } | undefined;

    const currentXp = experience?.xp || 0;
    const newXp = currentXp + points;

    if (experience) {
      db.prepare(
        'UPDATE user_experience SET xp = ?, last_updated = CURRENT_TIMESTAMP WHERE user_id = ?'
      ).run(newXp, userId);
    } else {
      db.prepare(
        'INSERT INTO user_experience (user_id, xp, last_updated) VALUES (?, ?, CURRENT_TIMESTAMP)'
      ).run(userId, newXp);
    }

    return newXp;
  },

  // Get user level
  getUserLevel: (userId: string): number => {
    const experience = db.prepare(
      'SELECT xp FROM user_experience WHERE user_id = ?'
    ).get(userId) as { xp: number } | undefined;

    const xp = experience?.xp || 0;
    let level = 1;

    for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
      if (xp >= LEVEL_THRESHOLDS[i]) {
        level++;
      }
    }

    return level;
  },

  // Check and award achievements
  checkAchievements: (userId: string, criteria: Achievement['criteria']): Achievement[] => {
    const unlocked: Achievement[] = [];

    // Get user stats
    const totalCompleted = db.prepare(
      'SELECT COUNT(*) as count FROM tasks WHERE is_completed = 1'
    ).get() as { count: number };

    for (const achievement of ACHIEVEMENTS) {
      if (achievement.criteria.type === criteria.type) {
        const shouldUnlock = gamificationOperations.evaluateCriteria(achievement.criteria, criteria.value);

        if (shouldUnlock) {
          // Check if already unlocked
          const alreadyUnlocked = db.prepare(
            'SELECT id FROM user_badges WHERE user_id = ? AND achievement_id = ?'
          ).get(userId, achievement.id);

          if (!alreadyUnlocked) {
            // Award badge
            db.prepare(
              'INSERT INTO user_badges (user_id, achievement_id, earned_at, points) VALUES (?, ?, CURRENT_TIMESTAMP, ?)'
            ).run(userId, achievement.id, achievement.points);

            // Award points
            gamificationOperations.awardPoints(userId, achievement.points, 'achievement');

            unlocked.push(achievement);
          }
        }
      }
    }

    return unlocked;
  },

  evaluateCriteria: (criteria: Achievement['criteria'], value: number | string): boolean => {
    const current = value;

    switch (criteria.operator) {
      case '>=': return Number(current) >= Number(criteria.value);
      case '>': return Number(current) > Number(criteria.value);
      case '=': return Number(current) === Number(criteria.value);
      case '<': return Number(current) < Number(criteria.value);
      case '<=': return Number(current) <= Number(criteria.value);
      default: return false;
    }
  },

  // Get user badges
  getUserBadges: (userId: string): UserBadge[] => {
    return db.prepare(
      `SELECT ub.*, a.name as achievement_name, a.description, a.icon, a.category, a.rarity, a.points as achievement_points
       FROM user_badges ub
       JOIN achievements a ON ub.achievement_id = a.id
       WHERE ub.user_id = ?
       ORDER BY ub.earned_at DESC`
    ).all(userId) as UserBadge[] & { achievement_name: string, description: string, icon: string, category: string, rarity: string, achievement_points: number }[];
  },

  // Get user streak
  getUserStreak: (userId: string, streakType?: string): UserStreak[] => {
    const query = streakType
      ? 'SELECT * FROM user_streaks WHERE user_id = ? AND streak_type = ? ORDER BY last_achieved_at DESC'
      : 'SELECT * FROM user_streaks WHERE user_id = ? ORDER BY last_achieved_at DESC';

    return db.prepare(query).all(userId, streakType || '') as UserStreak[];
  },

  // Update streak on task completion
  updateStreak: (userId: string, streakType: 'daily-completion' | 'weekly-goal' | 'time-tracking'): UserStreak => {
    const today = new Date().toISOString().split('T')[0];
    const existing = db.prepare(
      'SELECT * FROM user_streaks WHERE user_id = ? AND streak_type = ?'
    ).get(userId, streakType) as UserStreak | undefined;

    let streak: UserStreak;

    if (existing) {
      const lastDate = existing.lastAchievedAt.split('T')[0];

      if (lastDate === today) {
        return existing; // Already streaked today
      }

      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      if (lastDate === yesterday) {
        // Continue streak
        const newValue = existing.currentValue + 1;
        const maxStreak = Math.max(existing.maxStreak, newValue);

        db.prepare(
          'UPDATE user_streaks SET current_value = ?, max_streak = ?, last_achieved_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).run(newValue, maxStreak, existing.id);

        streak = { ...existing, currentValue: newValue, maxStreak, lastAchievedAt: new Date().toISOString() };
      } else {
        // Reset streak
        db.prepare(
          'UPDATE user_streaks SET current_value = 1, streak_start = CURRENT_TIMESTAMP, last_achieved_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).run(existing.id);

        streak = { ...existing, currentValue: 1, streakStart: new Date().toISOString(), lastAchievedAt: new Date().toISOString() };
      }
    } else {
      // Create new streak
      const result = db.prepare(
        'INSERT INTO user_streaks (user_id, streak_type, current_value, max_streak, streak_start, last_achieved_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
      ).run(userId, streakType, 1, 1);

      streak = {
        id: result.lastInsertRowid as string,
        userId,
        streakType,
        currentValue: 1,
        maxStreak: 1,
        streakStart: new Date().toISOString(),
        lastAchievedAt: new Date().toISOString()
      };
    }

    return streak;
  },

  // Claim daily bonus
  claimDailyBonus: (userId: string): boolean => {
    const today = new Date().toISOString().split('T')[0];
    const exp = db.prepare(
      'SELECT * FROM user_experience WHERE user_id = ?'
    ).get(userId) as any;

    const expDate = exp?.last_bonus_claimed?.split('T')[0];

    if (expDate === today) {
      return false; // Already claimed
    }

    const bonusXp = DAILY_BONUS_POINTS;
    const multiplier = gamificationOperations.getStreakMultiplier(userId);
    const finalBonus = Math.floor(bonusXp * multiplier);

    if (exp) {
      db.prepare(
        'UPDATE user_experience SET xp = xp + ?, last_bonus_claimed = CURRENT_TIMESTAMP, streak_bonus_multiplier = ? WHERE user_id = ?'
      ).run(finalBonus, multiplier, userId);
    } else {
      db.prepare(
        'INSERT INTO user_experience (user_id, xp, last_bonus_claimed, streak_bonus_multiplier) VALUES (?, ?, CURRENT_TIMESTAMP, ?)'
      ).run(userId, finalBonus, multiplier);
    }

    return true;
  },

  // Get streak multiplier
  getStreakMultiplier: (userId: string): number => {
    const streak = gamificationOperations.getUserStreak(userId, 'daily-completion');
    const current = streak[0]?.currentValue || 0;

    if (current >= 30) return 2.0;
    if (current >= 14) return 1.5;
    if (current >= 7) return 1.2;
    return 1.0;
  },

  // Team challenges
  createTeamChallenge: (challenge: TeamChallenge): string => {
    const result = db.prepare(`
      INSERT INTO team_challenges (
        name, description, start_date, end_date, goal_type, target_value, status, rewards, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      challenge.name,
      challenge.description,
      challenge.startDate,
      challenge.endDate,
      challenge.goalType,
      challenge.targetValue,
      challenge.status,
      JSON.stringify(challenge.rewards)
    );

    return result.lastInsertRowid as string;
  },

  joinTeamChallenge: (challengeId: string, userId: string, team: string): void => {
    db.prepare(
      'INSERT INTO team_challenge_participants (challenge_id, user_id, team) VALUES (?, ?, ?)'
    ).run(challengeId, userId, team);
  },

  getTeamChallengeProgress: (challengeId: string, team: string): number => {
    const result = db.prepare(
      'SELECT current_progress FROM team_challenges WHERE id = ?'
    ).get(challengeId);

    return result?.current_progress || 0;
  },

  // Leaderboard
  getLeaderboard: (period: 'daily' | 'weekly' | 'monthly' | 'all-time' = 'weekly', limit = 10): { userId: string; points: number; badges: number }[] => {
    const query = `
      SELECT user_id, SUM(points) as points
      FROM gamification_events
      WHERE created_at >= datetime('now', ?)
      GROUP BY user_id
      ORDER BY points DESC
      LIMIT ?
    `;

    const modifier = period === 'daily' ? '-1 day' :
                    period === 'weekly' ? '-7 days' :
                    period === 'monthly' ? '-30 days' : '';

    return db.prepare(query).all(modifier, limit) as { user_id: string; points: number }[];
  }
};

// Initialize database tables
const initGamificationDatabase = () => {
  if (typeof window === 'undefined') {
    try {
      const Database = require('better-sqlite3');
      const dbPath = require('path').join(process.cwd(), 'data', 'planner.db');
      const dbInstance = new Database(dbPath);

      dbInstance.exec(
        `CREATE TABLE IF NOT EXISTS user_experience (
          user_id TEXT PRIMARY KEY,
          xp INTEGER DEFAULT 0,
          last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_bonus_claimed DATETIME,
          streak_bonus_multiplier REAL DEFAULT 1.0
        )`
      );

      dbInstance.exec(`CREATE TABLE IF NOT EXISTS user_badges (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          achievement_id TEXT NOT NULL,
          earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          points INTEGER DEFAULT 0
        )`);

      dbInstance.exec(`CREATE TABLE IF NOT EXISTS user_streaks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          streak_type TEXT NOT NULL,
          current_value INTEGER DEFAULT 0,
          max_streak INTEGER DEFAULT 0,
          streak_start DATETIME,
          last_achieved_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

      dbInstance.exec(`CREATE TABLE IF NOT EXISTS achievements (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          icon TEXT,
          category TEXT NOT NULL,
          rarity TEXT NOT NULL,
          criteria_json TEXT NOT NULL,
          points INTEGER DEFAULT 0
        )`);

      dbInstance.exec(`CREATE TABLE IF NOT EXISTS gamification_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          points INTEGER DEFAULT 0,
          metadata TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

      dbInstance.exec(`CREATE TABLE IF NOT EXISTS team_challenges (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          start_date DATETIME NOT NULL,
          end_date DATETIME NOT NULL,
          goal_type TEXT NOT NULL,
          target_value INTEGER NOT NULL,
          current_progress INTEGER DEFAULT 0,
          status TEXT DEFAULT 'pending',
          rewards TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

      dbInstance.exec(`CREATE TABLE IF NOT EXISTS team_challenge_participants (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          challenge_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          team TEXT NOT NULL,
          joined_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

      console.log('Gamification database tables created successfully');
    } catch (error) {
      console.warn('Failed to initialize gamification database:', error);
    }
  }
};

// Seed achievements
const seedAchievements = () => {
  if (typeof window === 'undefined') {
    const count = db.prepare('SELECT COUNT(*) as count FROM achievements').get() as { count: number };
    if (count.count === 0) {
      for (const achievement of ACHIEVEMENTS) {
        db.prepare(
          'INSERT INTO achievements (id, name, description, icon, category, rarity, criteria_json, points) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(
          achievement.id,
          achievement.name,
          achievement.description,
          achievement.icon,
          achievement.category,
          achievement.rarity,
          JSON.stringify(achievement.criteria),
          achievement.points
        );
      }
    }
  }
};

initGamificationDatabase();
seedAchievements();

export { gamificationOperations, ACHIEVEMENTS, LEVEL_THRESHOLDS, DAILY_BONUS_POINTS };