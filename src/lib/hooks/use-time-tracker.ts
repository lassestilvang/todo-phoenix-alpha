import { useState, useEffect, useRef, useCallback } from "react";
import db from '@/lib/db/schema';
import { getTimeTrackingManager, initializeTimeTrackingRules } from '@/lib/db/time-tracking-rules';

export interface TimeTrackerState {
  isRunning: boolean;
  elapsedSeconds: number;
  isPaused: boolean;
  startTime: Date | null;
  taskId: number;
}

export function useTimeTracker(taskId: number) {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const snapshotIdRef = useRef<number | null>(null);

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

  // Handle window blur/unload to persist timer state
  useEffect(() => {
    const handleBlur = () => {
      // Persist current state when window loses focus
      saveSnapshot();
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      saveSnapshot();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        saveSnapshot();
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
  }, [isRunning, elapsedSeconds, isPaused, taskId]);

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
  };
}