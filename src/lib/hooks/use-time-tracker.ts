import { useState, useEffect, useRef } from "react"

export function useTimeTracker(taskId: number) {
  const [isRunning, setIsRunning] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Check if there's an active time entry for this task
    // This would typically come from the database
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [taskId])

  const startTimer = () => {
    if (isRunning) return
    
    setIsRunning(true)
    // Create a new time entry in the database
    // This would be a server action call
    
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
    // This would be a server action call
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
