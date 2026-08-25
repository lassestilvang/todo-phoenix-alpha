import { expect, describe, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FocusMode } from '../focus-mode'
import { useTimeTracker } from '@/lib/hooks/use-time-tracker'

// Mock the useTimeTracker hook
vi.mock('@/lib/hooks/use-time-tracker', () => ({
  useTimeTracker: vi.fn(() => ({
    startTimer: vi.fn(),
    stopTimer: vi.fn(),
    pauseTimer: vi.fn(),
    resetTimer: vi.fn(),
    elapsedTime: 0,
    isRunning: false,
    currentTaskId: null,
    setCurrentTaskId: vi.fn(),
  })),
}))

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString() },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Mock Audio for sound playback
const audioMock = {
  play: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
  currentTime: 0,
  volume: 1,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}
Object.defineProperty(window, 'Audio', {
  writable: true,
  value: vi.fn(() => audioMock),
})

// Mock notification
Object.defineProperty(window, 'Notification', {
  writable: true,
  value: class Notification {
    static permission = 'granted'
    constructor(public title: string, public options?: NotificationOptions) {}
    close = vi.fn()
    onclick = null
  },
})

describe('FocusMode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should render the component without crashing', () => {
    expect(() => render(<FocusMode />)).not.toThrow()
  })

  it('should have container element', () => {
    const { container } = render(<FocusMode />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('should not throw when interacting with basic elements', () => {
    render(<FocusMode />)
    // Test basic interaction without expecting specific element text
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })
})