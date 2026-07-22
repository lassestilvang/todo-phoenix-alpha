import { useState, useEffect, useRef } from "react"
import { startTimer as startTimerAction, stopTimer as stopTimerAction, getActiveTimeEntry } from "@/app/actions/tasks"

export function useTimeTracker(taskId: number) {
  const [isRunning, setIsRunning] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [timeSnapshotId, setTimeSnapshotId] = useState(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Load active time entry from database
    const loadActiveEntry = async () => {
      try {
        const activeEntry = await getActiveTimeEntry(taskId)
        if (activeEntry) {
          const startTime = new Date(activeEntry.started_at)
          const now = new Date()
          const initialElapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000)
          setElapsedSeconds(initialElapsed)
          setIsRunning(true)
        }
      } catch (error) {
        console.error('Failed to load active timer:', error)
      }
    }

    loadActiveEntry()

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [taskId])

  const startTimer = async () => {
    if (isRunning) return

    setIsRunning(true)

    // Create a new time entry in the database
    try {
      await startTimerAction(taskId)
      setTimeSnapshotId(taskId)
    } catch (error) {
      console.error('Failed to start timer:', error)
    }

    intervalRef.current = setInterval(() => {
      setElapsedSeconds(prev => prev + 1)
    }, 1000)
  }

  const stopTimer = async () => {
    if (!isRunning) return

    setIsRunning(false)

    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    // Update the time entry in the database with the stopped time
    try {
      const durationMinutes = Math.floor(elapsedSeconds / 60)
      await stopTimerAction(taskId)
    } catch (error) {
      console.error('Failed to stop timer:', error)
    }
  }

  const resetTimer = () => {
    setIsRunning(false)
    setElapsedSeconds(0)

    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return {
    isRunning,
    elapsedSeconds,
    startTimer,
    stopTimer,
    resetTimer,
    formatTime,
  }
}
