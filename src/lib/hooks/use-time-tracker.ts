import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import db from '@/lib/db/schema';
import { getTimeTrackingManager, initializeTimeTrackingRules } from '@/lib/db/time-tracking-rules';

export interface TimeTrackerState {
  isRunning: boolean;
  elapsedSeconds: number;
  isPaused: boolean;
  startTime: Date | null;
  taskId: number;
}

export interface TimeTrackingRule {
  min_duration_minutes: number;
  max_duration_minutes: number;
  require_description: boolean;
  allowed_days: number[];
  allowed_hours_start: string;
  allowed_hours_end: string;
}

export interface PomodoroConfig {
  workDurationMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakInterval: number; // Every N work sessions
  autoStartBreaks: boolean;
  autoStartWork: boolean;
}

export interface SessionStats {
  workSessionsCompleted: number;
  totalWorkMinutes: number;
  totalBreakMinutes: number;
  currentStreak: number;
  longestStreak: number;
}

export interface BreakSuggestion {
  type: 'short' | 'long' | 'custom';
  reason: string;
  durationMinutes: number;
  confidence: number;
}

export interface TimeTrackerReturn {
  isRunning: boolean;
  elapsedSeconds: number;
  isPaused: boolean;
  isLoading: boolean;
  startTimer: () => Promise<void>;
  stopTimer: () => Promise<void>;
  pauseTimer: () => void;
  resetTimer: () => void;
  formatTime: (seconds: number) => string;
  // New intelligent features
  pomodoroConfig: PomodoroConfig;
  updatePomodoroConfig: (config: Partial<PomodoroConfig>) => void;
  sessionStats: SessionStats;
  breakSuggestion: BreakSuggestion | null;
  dismissBreakSuggestion: () => void;
  getBreakSuggestion: () => Promise<BreakSuggestion | null>;
  isBreakTime: boolean;
  timeUntilNextBreak: number; // seconds
}

// Default Pomodoro configuration
const DEFAULT_POMODORO_CONFIG: PomodoroConfig = {
  workDurationMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakInterval: 4, // Every 4 work sessions
  autoStartBreaks: false,
  autoStartWork: false,
};

// Load Pomodoro config from localStorage or use defaults
function loadPomodoroConfig(): PomodoroConfig {
  if (typeof window === 'undefined') return DEFAULT_POMODORO_CONFIG;
  try {
    const stored = localStorage.getItem('todo-pomodoro-config');
    if (stored) {
      return { ...DEFAULT_POMODORO_CONFIG, ...JSON.parse(stored) };
    }
  } catch {
    // Use defaults
  }
  return DEFAULT_POMODORO_CONFIG;
}

// Save Pomodoro config to localStorage
function savePomodoroConfig(config: PomodoroConfig) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('todo-pomodoro-config', JSON.stringify(config));
  } catch {
    // Ignore
  }
}

export function useTimeTracker(taskId: number): TimeTrackerReturn {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [pomodoroConfig, setPomodoroConfigState] = useState<PomodoroConfig>(loadPomodoroConfig);
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    workSessionsCompleted: 0,
    totalWorkMinutes: 0,
    totalBreakMinutes: 0,
    currentStreak: 0,
    longestStreak: 0,
  });
  const [breakSuggestion, setBreakSuggestion] = useState<BreakSuggestion | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const snapshotIdRef = useRef<number | null>(null);
  const lastBreakSuggestionAt = useRef(0);
  const isBreakTimeRef = useRef(false);
  const pomodoroSessionCountRef = useRef(0);

  // Load saved time snapshot from database on mount
  useEffect(() => {
    if (!taskId) return;

    try {
      // Initialize time tracking rules
      initializeTimeTrackingRules();

      // Load saved snapshot
      const snapshot = db.prepare(`
        SELECT * FROM time_tracking_snapshots
        WHERE task_id = ? AND user_id = 'default'
        ORDER BY updated_at DESC
        LIMIT 1
      `).get(taskId) as any;

      if (snapshot) {
        snapshotIdRef.current = snapshot.id;
        setElapsedSeconds(snapshot.elapsed_seconds || 0);

        if (snapshot.is_running === 1 && snapshot.last_start_time) {
          const startTime = new Date(snapshot.last_start_time);
          const now = new Date();
          const additionalSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
          setElapsedSeconds(prev => prev + additionalSeconds);
          setIsRunning(true);
          setIsPaused(false);
        }
      }
    } catch (error) {
      console.error('Failed to load time snapshot:', error);
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  // Suggest a break (called when user explicitly takes a break or auto-suggests)
  const suggestBreak = useCallback(() => {
    setBreakSuggestion({
      type: 'short',
      reason: 'Time to take a break - productivity research suggests regular breaks improve focus',
      durationMinutes: pomodoroConfig.shortBreakMinutes,
      confidence: 0.95,
    });
    lastBreakSuggestionAt.current = elapsedSeconds;
    isBreakTimeRef.current = true;
  }, [elapsedSeconds, pomodoroConfig.shortBreakMinutes]);

  // Handle window blur/unload to persist timer state
  useEffect(() => {
    const handleBlur = () => {
      // Persist current state when window loses focus
      saveSnapshot();

      // Check if it's time for a break when losing focus
      if (isRunning && !isPaused && pomodoroConfig.autoStartBreaks) {
        suggestBreak();
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      saveSnapshot();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        saveSnapshot();
      } else {
        // User returned - check break status after coming back
        setBreakSuggestion(null);
      }
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isRunning, elapsedSeconds, isPaused, taskId, pomodoroConfig.autoStartBreaks, suggestBreak]);

  // Persist timer state to database
  const saveSnapshot = useCallback(() => {
    if (!taskId) return;

    try {
      const lastStartTime = isRunning && isPaused === false
        ? new Date().toISOString()
        : null;

      if (snapshotIdRef.current) {
        // Update existing snapshot
        db.prepare(`
          UPDATE time_tracking_snapshots
          SET is_running = ?,
              elapsed_seconds = ?,
              last_start_time = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          isRunning ? 1 : 0,
          elapsedSeconds,
          lastStartTime,
          snapshotIdRef.current
        );
      } else {
        // Create new snapshot
        const result = db.prepare(`
          INSERT INTO time_tracking_snapshots
            (task_id, user_id, is_running, elapsed_seconds, last_start_time)
          VALUES (?, 'default', ?, ?, ?)
        `).run(
          taskId,
          isRunning ? 1 : 0,
          elapsedSeconds,
          lastStartTime
        );
        snapshotIdRef.current = result.lastInsertRowid as number;
      }
    } catch (error) {
      console.error('Failed to save time snapshot:', error);
    }
  }, [taskId, isRunning, elapsedSeconds, isPaused]);

  // Start timer
  const startTimer = useCallback(async () => {
    if (isRunning && !isPaused) return;

    // Validate against time tracking rules
    try {
      const manager = getTimeTrackingManager();
      const validation = manager.validateStartTime(taskId, new Date());
      if (!validation.isValid) {
        console.warn('Timer start validation:', validation.message);
      }
    } catch (e) {
      console.error('Time tracking validation failed:', e);
    }

    setIsRunning(true);
    setIsPaused(false);

    if (isPaused) {
      // Resuming from pause, add remaining time
      const resumeTime = new Date();
      const newSnapshot = db.prepare(`
        INSERT INTO time_tracking_snapshots
          (task_id, user_id, is_running, elapsed_seconds, last_start_time)
        VALUES (?, 'default', 1, ?, ?)
      `).run(taskId, elapsedSeconds, resumeTime.toISOString());
      snapshotIdRef.current = newSnapshot.lastInsertRowid as number;
    } else {
      // Fresh start
      db.prepare(`
        INSERT INTO time_entries (task_id, started_at)
        VALUES (?, ?)
      `).run(taskId, new Date().toISOString());

      const snapshot = db.prepare(`
        INSERT INTO time_tracking_snapshots
          (task_id, user_id, is_running, elapsed_seconds, last_start_time)
        VALUES (?, 'default', 1, 0, ?)
      `).run(taskId, new Date().toISOString());
      snapshotIdRef.current = snapshot.lastInsertRowid as number;
    }

    intervalRef.current = setInterval(() => {
      setElapsedSeconds(prev => {
        const newSeconds = prev + 1;
        // Save every 10 seconds to persist progress
        if (newSeconds % 10 === 0) {
          saveSnapshot();
        }
        return newSeconds;
      });
    }, 1000);
  }, [isRunning, isPaused, elapsedSeconds, taskId, saveSnapshot]);

  // Stop timer
  const stopTimer = useCallback(async () => {
    if (!isRunning) return;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setIsRunning(false);
    setIsPaused(false);

    const endTime = new Date().toISOString();

    try {
      // Stop the time entry
      db.prepare(`
        UPDATE time_entries
        SET stopped_at = ?, duration_minutes = ?
        WHERE task_id = ? AND stopped_at IS NULL
        ORDER BY id DESC
        LIMIT 1
      `).run(endTime, Math.floor(elapsedSeconds / 60), taskId);

      // Update task actual_minutes
      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;
      if (task) {
        db.prepare(`
          UPDATE tasks
          SET actual_minutes = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(task.actual_minutes + Math.floor(elapsedSeconds / 60), taskId);
      }

      // Clear snapshot
      if (snapshotIdRef.current) {
        db.prepare(`
          UPDATE time_tracking_snapshots
          SET is_running = 0,
              last_start_time = NULL,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(snapshotIdRef.current);
      }

      setElapsedSeconds(0);
    } catch (error) {
      console.error('Failed to stop timer:', error);
    }
  }, [isRunning, elapsedSeconds, taskId]);

  // Pause timer
  const pauseTimer = useCallback(() => {
    if (!isRunning || isPaused) return;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setIsPaused(true);

    if (snapshotIdRef.current) {
      db.prepare(`
        UPDATE time_tracking_snapshots
        SET is_running = 0,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(snapshotIdRef.current);
    }
  }, [isRunning, isPaused]);

  // Reset timer
  const resetTimer = () => {
    setIsRunning(false);
    setIsPaused(false);
    setElapsedSeconds(0);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Clear time entry without saving duration
    db.prepare(`
      DELETE FROM time_entries WHERE task_id = ? AND stopped_at IS NULL ORDER BY id DESC LIMIT 1
    `).run(taskId);
  };

  // Format time display
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate break suggestion: check if enough work time has passed
  const checkBreakSuggestion = useCallback(() => {
    if (!isRunning || isPaused) {
      setBreakSuggestion(null);
      isBreakTimeRef.current = false;
      return;
    }

    const workTimeMinutes = elapsedSeconds / 60;
    const workIntervalMinutes = pomodoroConfig.workDurationMinutes;

    // Check if we've reached the work interval threshold
    if (workTimeMinutes >= workIntervalMinutes) {
      // Calculate how long since last suggestion
      const secondsSinceLast = elapsedSeconds - lastBreakSuggestionAt.current;

      // Only suggest once per work interval, unless break was taken
      if (!isBreakTimeRef.current || secondsSinceLast >= workIntervalMinutes * 60) {
        const reason = workTimeMinutes >= workIntervalMinutes * 2
          ? 'Extended focus session - take a longer break'
          : 'Pomodoro cycle complete - take a short break';

        setBreakSuggestion({
          type: workTimeMinutes >= workIntervalMinutes * 2 ? 'long' : 'short',
          reason,
          durationMinutes: workTimeMinutes >= workIntervalMinutes * 2
            ? pomodoroConfig.longBreakMinutes
            : pomodoroConfig.shortBreakMinutes,
          confidence: 0.9,
        });
        lastBreakSuggestionAt.current = elapsedSeconds;
        isBreakTimeRef.current = true;
      }
    } else {
      // Calculate time until next break
      const minutesUntilNext = workIntervalMinutes - workTimeMinutes;
      const secondsUntilNext = Math.max(0, minutesUntilNext * 60 - elapsedSeconds % (workIntervalMinutes * 60));
      // We can expose timeUntilNextBreak if needed, but for now we just track internally
      isBreakTimeRef.current = false;
    }
  }, [isRunning, isPaused, elapsedSeconds, pomodoroConfig.workDurationMinutes, lastBreakSuggestionAt]);

  // Dismiss current break suggestion and reset the timer
  const dismissBreakSuggestion = useCallback(() => {
    setBreakSuggestion(null);
    // Update last suggestion time so we don't suggest again immediately
    lastBreakSuggestionAt.current = elapsedSeconds;
    isBreakTimeRef.current = false;
  }, [elapsedSeconds]);

  // Get current break suggestion
  const getBreakSuggestion = async (): Promise<BreakSuggestion | null> => {
    return breakSuggestion;
  };

  // Update Pomodoro configuration
  const updatePomodoroConfig = useCallback((newConfig: Partial<PomodoroConfig>) => {
    const updatedConfig = { ...pomodoroConfig, ...newConfig };
    setPomodoroConfigState(updatedConfig);
    savePomodoroConfig(updatedConfig);
  }, [pomodoroConfig]);

  // Update session stats
  const updateSessionStats = useCallback((isBreak: boolean) => {
    setSessionStats(prev => {
      const totalWorkMinutes = Math.floor((prev.totalWorkMinutes * (prev.workSessionsCompleted || 1) + (isBreak ? 0 : 1)) / (prev.workSessionsCompleted || 1) + 1);
      const newSessionCount = (prev.workSessionsCompleted || 0) + (isBreak ? 0 : 1);
      const newBreakMinutes = isBreak ? 0 : (prev.totalBreakMinutes || 0) + (isBreak ? pomodoroConfig.shortBreakMinutes : 0);

      // Calculate streaks
      const newStreak = isBreak ? 0 : (prev.currentStreak || 0) + 1;
      const newLongestStreak = Math.max(prev.longestStreak || 0, newStreak);

      return {
        workSessionsCompleted: newSessionCount,
        totalWorkMinutes: newSessionCount > 0 ? Math.round(totalWorkMinutes * 10) / 10 : 0,
        totalBreakMinutes: Math.round((prev.totalBreakMinutes || 0) + (isBreak ? 0 : pomodoroConfig.shortBreakMinutes * 10) / 10),
        currentStreak: newStreak,
        longestStreak: newLongestStreak,
      };
    });
  }, [pomodoroConfig]);

  // Calculate time until next break
  const timeUntilNextBreak = useMemo(() => {
    if (!isRunning || isPaused) return 0;
    const elapsedMinutes = elapsedSeconds / 60;
    const remainder = elapsedMinutes % pomodoroConfig.workDurationMinutes;
    const remaining = pomodoroConfig.workDurationMinutes - remainder;
    return remaining > 0 ? Math.round(remaining * 60) : 0;
  }, [isRunning, isPaused, elapsedSeconds, pomodoroConfig.workDurationMinutes]);

  // Check for break suggestions every second while timer is running
  useEffect(() => {
    if (!isRunning || isPaused) return;

    // Check every second for break suggestions
    const interval = setInterval(() => {
      checkBreakSuggestion();
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, isPaused, elapsedSeconds, pomodoroConfig.workDurationMinutes, checkBreakSuggestion]);

  return {
    isRunning,
    elapsedSeconds,
    isPaused,
    isLoading,
    startTimer,
    stopTimer,
    pauseTimer,
    resetTimer,
    formatTime,
    // New intelligent features
    pomodoroConfig,
    updatePomodoroConfig,
    sessionStats,
    breakSuggestion,
    dismissBreakSuggestion,
    getBreakSuggestion,
    isBreakTime: !!isBreakTimeRef.current,
    timeUntilNextBreak: timeUntilNextBreak,
  };
}