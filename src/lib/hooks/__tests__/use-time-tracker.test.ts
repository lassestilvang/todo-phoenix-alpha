import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Mock the database
vi.mock('@/lib/db/schema', () => ({
  default: {
    prepare: vi.fn().mockReturnThis(),
    run: vi.fn().mockReturnValue({ lastInsertRowid: 1, changes: 1 }),
    all: vi.fn().mockReturnValue([]),
    get: vi.fn().mockReturnValue(null),
  },
  __esModule: true,
}))

vi.mock('@/lib/db/time-tracking-rules', () => ({
  getTimeTrackingManager: vi.fn().mockReturnValue({
    validateStartTime: vi.fn().mockReturnValue({ isValid: true, message: '' }),
    validatePauseTime: vi.fn().mockReturnValue({ isValid: true, message: '' }),
    validateEndTime: vi.fn().mockReturnValue({ isValid: true, message: '' }),
  }),
  initializeTimeTrackingRules: vi.fn(),
}))

import { useTimeTracker } from '../use-time-tracker'

describe('useTimeTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Use fake timers for predictable behavior
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('should initialize timer state', () => {
    const { result } = renderHook(() => useTimeTracker(1))
    expect(result.current).toBeDefined()
    expect(result.current.isRunning).toBe(false)
    expect(result.current.elapsedSeconds).toBe(0)
    expect(result.current.isPaused).toBe(false)
  })

  it('should start timer when startTimer is called', async () => {
    const { result } = renderHook(() => useTimeTracker(1))
    await act(async () => {
      await result.current.startTimer()
    })
    expect(result.current.isRunning).toBe(true)
    expect(result.current.isPaused).toBe(false)
  })

  it('should pause timer when pauseTimer is called', async () => {
    const { result } = renderHook(() => useTimeTracker(1))
    await act(async () => {
      await result.current.startTimer()
    })
    act(() => {
      result.current.pauseTimer()
    })
    expect(result.current.isRunning).toBe(true)
    expect(result.current.isPaused).toBe(true)
  })

  it('should stop timer when stopTimer is called', async () => {
    const { result } = renderHook(() => useTimeTracker(1))
    await act(async () => {
      await result.current.startTimer()
    })
    await act(async () => {
      await result.current.stopTimer()
    })
    expect(result.current.isRunning).toBe(false)
    expect(result.current.elapsedSeconds).toBe(0)
  })

  it('should increment elapsed seconds over time', async () => {
    const { result } = renderHook(() => useTimeTracker(1))
    await act(async () => {
      await result.current.startTimer()
    })
    // Advance timers by 3 seconds
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(result.current.elapsedSeconds).toBe(3)
  })

  it('should reset timer when resetTimer is called', async () => {
    const { result } = renderHook(() => useTimeTracker(1))
    await act(async () => {
      await result.current.startTimer()
    })
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(result.current.elapsedSeconds).toBe(5)
    act(() => {
      result.current.resetTimer()
    })
    expect(result.current.elapsedSeconds).toBe(0)
    expect(result.current.isRunning).toBe(false)
  })

  it('should format time correctly', () => {
    const { result } = renderHook(() => useTimeTracker(1))
    expect(result.current.formatTime(0)).toBe('00:00:00')
    expect(result.current.formatTime(65)).toBe('00:01:05')
    expect(result.current.formatTime(3661)).toBe('01:01:01')
    expect(result.current.formatTime(36000)).toBe('10:00:00')
  })

  it('should handle multiple start/pause cycles', async () => {
    const { result } = renderHook(() => useTimeTracker(1))

    // First cycle
    await act(async () => {
      await result.current.startTimer()
    })
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(result.current.elapsedSeconds).toBe(5)
    act(() => {
      result.current.pauseTimer()
    })
    const elapsed1 = result.current.elapsedSeconds

    // Second cycle
    await act(async () => {
      await result.current.startTimer()
    })
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(result.current.elapsedSeconds).toBe(elapsed1 + 3)
    act(() => {
      result.current.pauseTimer()
    })
    expect(result.current.elapsedSeconds).toBe(elapsed1 + 3)
  })

  it('should provide pomodoro config', () => {
    const { result } = renderHook(() => useTimeTracker(1))
    expect(result.current.pomodoroConfig).toBeDefined()
    expect(result.current.pomodoroConfig.workDurationMinutes).toBe(25)
    expect(result.current.pomodoroConfig.shortBreakMinutes).toBe(5)
  })

  it('should provide session stats', () => {
    const { result } = renderHook(() => useTimeTracker(1))
    expect(result.current.sessionStats).toBeDefined()
    expect(result.current.sessionStats.workSessionsCompleted).toBe(0)
    expect(result.current.sessionStats.totalWorkMinutes).toBe(0)
  })

  it('should not start timer if already running', async () => {
    const { result } = renderHook(() => useTimeTracker(1))
    await act(async () => {
      await result.current.startTimer()
    })
    expect(result.current.isRunning).toBe(true)

    // Try to start again
    await act(async () => {
      await result.current.startTimer()
    })
    expect(result.current.isRunning).toBe(true)
  })

  it('should provide timeUntilNextBreak', () => {
    const { result } = renderHook(() => useTimeTracker(1))
    expect(result.current.timeUntilNextBreak).toBe(0)
  })

  it('should provide getBreakSuggestion function', () => {
    const { result } = renderHook(() => useTimeTracker(1))
    expect(typeof result.current.getBreakSuggestion).toBe('function')
    expect(result.current.breakSuggestion).toBe(null)
  })
})