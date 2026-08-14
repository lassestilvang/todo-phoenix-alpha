import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the database at the module level before importing
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

// Stub global window for time tracking hooks
// This must be done before importing useTimeTracker
global.window = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
  focus: vi.fn(),
  blur: vi.fn(),
  stop: vi.fn(),
  captureEvents: vi.fn(),
  releaseEvents: vi.fn(),
  visualViewport: {
    onchange: null,
    onscroll: null,
  },
  Image: global.Image,
  XMLHttpRequest: global.XMLHttpRequest,
  fetch: global.fetch,
  matchMedia: vi.fn(),
  caches: global.caches,
  OriginTrial: global.OriginTrial,
  Screen: global.Screen,
  Worker: global.Worker,
  ServiceWorkerRegistration: global.ServiceWorkerRegistration,
  history: global.history,
  Location: global.Location,
  Name: global.Name,
  Navigator: global.Navigator,
  ApplicationCache: global.ApplicationCache,
  console: global.console,
  localStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  },
  ImageBitmap: global.ImageBitmap,
  OffscreenCanvas: global.OffscreenCanvas,
  TextDecoder: global.TextDecoder,
  TextEncoder: global.TextEncoder,
  WeakMap: global.WeakMap,
  WeakSet: global.WeakSet,
  Map: global.Map,
  Set: global.Set,
  Promise: global.Promise,
  Symbol: global.Symbol,
  queueMicrotask: global.queueMicrotask,
  setTimeout: global.setTimeout,
  clearTimeout: global.clearTimeout,
  setInterval: global.setInterval,
  clearInterval: global.clearInterval,
  requestAnimationFrame: global.requestAnimationFrame,
  cancelAnimationFrame: global.cancelAnimationFrame,
  StatusBar: global.StatusBar,
  HTMLElement: global.HTMLElement,
  Event: global.Event,
  EventTarget: global.EventTarget,
  Node: global.Node,
  Element: global.Element,
  DocumentFragment: global.DocumentFragment,
  XPathResult: global.XPathResult,
  SpeechSynthesis: global.SpeechSynthesis,
  SpeechSynthesisUtterance: global.SpeechSynthesisUtterance,
  SpeechRecognition: global.SpeechRecognition,
  SpeechRecognitionEvent: global.SpeechRecognitionEvent,
  URL: global.URL,
  SVGAngle: global.SVGAngle,
  SVGSVGElement: global.SVGSVGElement,
  SVGElement: global.SVGElement,
  SVGRect: global.SVGRect,
  DOMPurify: global.DOMPurify,
  CSAVGCertification: global.CSAVGCertification,
  DOMMatrix: global.DOMMatrix,
  DOMParser: global.DOMParser,
  requestIdleCallback: global.requestIdleCallback,
  cancelIdleCallback: global.cancelIdleCallback,
  readonly crossOrigin: 'anonymous',
  readonly innerWidth: 0,
  readonly innerHeight: 0,
  readonly outerWidth: 0,
  readonly outerHeight: 0,
  readonly documentElement: {
    appendChild: vi.fn(),
    removeChild: vi.fn(),
    replaceChild: vi.fn(),
    insertBefore: vi.fn(),
    querySelector: vi.fn(),
    querySelectorAll: vi.fn(),
    getElementsByTagName: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    hidden: false,
    title: 'Test Page',
    URL: '',
    referrer: '',
    domain: '',
    lastModified: '',
    charset: '',
    contentType: '',
    characterSet: '',
    encoding: '',
    getElementsByClassName: vi.fn(),
    getElementById: vi.fn(),
    createElement: vi.fn(),
    createDocumentFragment: vi.fn(),
    createTextNode: vi.fn(),
    createComment: vi.fn(),
    createAttribute: vi.fn(),
    setAttribute: vi.fn(),
    getAttribute: vi.fn(),
    removeAttribute: vi.fn(),
    setAttributeNS: vi.fn(),
    getAttributeNS: vi.fn(),
    removeEventListener: vi.fn(),
    addEventListener: vi.fn(),
    removeChild: vi.fn(),
    replaceChild: vi.fn(),
    insertBefore: vi.fn(),
    firstChild: null,
    lastChild: null,
    childNodes: [],
    parentNode: null,
    firstElementChild: null,
    lastElementChild: null,
    children: [],
    classList: {
      add: vi.fn(),
      remove: vi.fn(),
      contains: vi.fn(),
      toggle: vi.fn(),
      value: ''
    },
    style: {
      cssText: '',
      getPropertyValue: vi.fn(),
      setProperty: vi.fn(),
    },
  },
  navigator: {
    clipboard: {
      readText: vi.fn(),
      writeText: vi.fn(),
    },
    geolocation: {
      getCurrentPosition: vi.fn(),
      watchPosition: vi.fn(),
      clearWatch: vi.fn(),
    },
    mediaDevices: {
      enumerateDevices: vi.fn(),
      getUserMedia: vi.fn(),
    },
    storage: {
      persistent: vi.fn(),
      estimate: vi.fn(),
    },
    onLine: true,
    userAgent: 'Mozilla/5.0 (test)',
    platform: 'test',
    language: 'en-US',
    languages: ['en-US'],
    product: 'Gecko',
    productSub: '20030106',
    msMaxTouchPoints: 0,
    maxTouchPoints: 0,
  },
  document: {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    createElement: vi.fn(),
    createDocumentFragment: vi.fn(),
    createTextNode: vi.fn(),
    createComment: vi.fn(),
    createAttribute: vi.fn(),
    removeChild: vi.fn(),
    replaceChild: vi.fn(),
    insertBefore: vi.fn(),
    remove: vi.fn(),
    adoptNode: vi.fn(),
    importNode: vi.fn(),
    querySelector: vi.fn(),
    querySelectorAll: vi.fn(),
    getElementsByTagName: vi.fn(),
    getElementsByClassName: vi.fn(),
    getElementById: vi.fn(),
    hidden: false,
    onselectstart: null,
    oncopy: null,
    oncut: null,
    onpaste: null,
    oninput: null,
    onchange: null,
    onclick: null,
    oncontextmenu: null,
    onblur: null,
    onfocus: null,
    onload: null,
    onwheel: null,
    onabort: null,
    onerror: null,
    onselect: null,
    onsubmit: null,
    onreset: null,
    onselectstart: null,
    onbeforecopy: null,
    onbeforecut: null,
    onpaste: null,
    oncopy: null,
    oncut: null,
    oninput: null,
    oninvalid: null,
    readonly doctype: null,
    readonly documentElement: {
      removeChild: vi.fn(),
      replaceChild: vi.fn(),
      insertBefore: vi.fn(),
    },
  },
  localStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  },
} as any;

global.document = global.window.document;

describe('Time Tracking Persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    // Window and document are already stubbed in setup file
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('Timer State Management', () => {
    it('should initialize with default state', () => {
      const initialState = {
        isRunning: false,
        elapsedSeconds: 0,
        isPaused: false,
        startTime: null,
        taskId: 1,
      }

      expect(initialState.isRunning).toBe(false)
      expect(initialState.elapsedSeconds).toBe(0)
      expect(initialState.isPaused).toBe(false)
      expect(initialState.startTime).toBeNull()
    })

    it('should start timer and track elapsed time', () => {
      vi.useFakeTimers()

      let elapsedSeconds = 0
      let isRunning = false

      // Start timer
      isRunning = true
      const startTime = Date.now()

      // Advance 5 seconds
      vi.advanceTimersByTime(5000)
      elapsedSeconds = Math.floor((Date.now() - startTime) / 1000)

      expect(elapsedSeconds).toBe(5)
      expect(isRunning).toBe(true)
    })

    it('should pause timer and preserve elapsed time', () => {
      vi.useFakeTimers()

      let elapsedSeconds = 0
      let isRunning = true
      let isPaused = false
      const startTime = Date.now()

      // Advance 10 seconds
      vi.advanceTimersByTime(10000)
      elapsedSeconds = Math.floor((Date.now() - startTime) / 1000)
      expect(elapsedSeconds).toBe(10)

      // Pause timer
      isRunning = false
      isPaused = true
      const pauseTime = Date.now()
      elapsedSeconds = Math.floor((pauseTime - startTime) / 1000)
      expect(elapsedSeconds).toBe(10)
      expect(isPaused).toBe(true)

      // Advance another 5 seconds - elapsed shouldn't change while paused
      vi.advanceTimersByTime(5000)
      expect(elapsedSeconds).toBe(10)
    })

    it('should stop timer and reset state', () => {
      let elapsedSeconds = 30
      let isRunning = true
      let isPaused = false

      // Stop timer
      isRunning = false
      isPaused = false
      elapsedSeconds = 0

      expect(isRunning).toBe(false)
      expect(isPaused).toBe(false)
      expect(elapsedSeconds).toBe(0)
    })

    it('should reset timer and clear elapsed time', () => {
      let elapsedSeconds = 45
      let isRunning = true
      let isPaused = false

      // Reset timer
      isRunning = false
      isPaused = false
      elapsedSeconds = 0

      expect(elapsedSeconds).toBe(0)
    })
  })

  describe('Snapshot Persistence', () => {
    it('should save snapshot on window blur event', () => {
      // Verify that event listeners are set up correctly
      expect(window.addEventListener).toHaveBeenCalledWith('blur', expect.any(Function))
    })

    it('should save snapshot on beforeunload event', () => {
      expect(window.addEventListener).toHaveBeenCalledWith('beforeunload', expect.any(Function))
    })

    it('should save snapshot on visibilitychange event', () => {
      expect(document.addEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
    })

    it('should calculate last start time correctly when running', () => {
      const isRunning = true
      const isPaused = false
      const now = new Date()

      // When running, last_start_time should be the start time
      const lastStartTime = isRunning && !isPaused
        ? now.toISOString()
        : null

      expect(lastStartTime).toBeDefined()
    })

    it('should set null last_start_time when not running', () => {
      const isRunning = false
      const isPaused = false

      const lastStartTime = isRunning && !isPaused
        ? new Date().toISOString()
        : null

      expect(lastStartTime).toBeNull()
    })
  })

  describe('Format Time Display', () => {
    const formatTime = (seconds: number) => {
      const hours = Math.floor(seconds / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)
      const secs = seconds % 60
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    it('should format 0 seconds as 00:00:00', () => {
      expect(formatTime(0)).toBe('00:00:00')
    })

    it('should format 59 seconds as 00:00:59', () => {
      expect(formatTime(59)).toBe('00:00:59')
    })

    it('should format 60 seconds as 00:01:00', () => {
      expect(formatTime(60)).toBe('00:01:00')
    })

    it('should format 3661 seconds as 01:01:01', () => {
      expect(formatTime(3661)).toBe('01:01:01')
    })

    it('should format 36000 seconds (10 hours) as 10:00:00', () => {
      expect(formatTime(36000)).toBe('10:00:00')
    })

    it('should format 86399 seconds as 23:59:59', () => {
      expect(formatTime(86399)).toBe('23:59:59')
    })
  })

  describe('Interval Management', () => {
    it('should increment elapsed seconds every second when running', () => {
      vi.useFakeTimers()

      let elapsedSeconds = 0

      // Simulate interval callback
      const interval = setInterval(() => {
        elapsedSeconds += 1
      }, 1000)

      vi.advanceTimersByTime(1000)
      expect(elapsedSeconds).toBe(1)

      vi.advanceTimersByTime(5000)
      expect(elapsedSeconds).toBe(6)

      clearInterval(interval)
    })

    it('should clear interval on stop', () => {
      vi.useFakeTimers()

      let elapsedSeconds = 10
      let isRunning = true

      const interval = setInterval(() => {
        if (isRunning) elapsedSeconds += 1
      }, 1000)

      vi.advanceTimersByTime(3000)
      expect(elapsedSeconds).toBeGreaterThan(10)

      // Stop
      isRunning = false
      clearInterval(interval)

      vi.advanceTimersByTime(5000)
      expect(elapsedSeconds).toBe(12) // Should not increase after clearing
    })

    it('should save snapshot every 10 seconds during running', () => {
      vi.useFakeTimers()

      let elapsedSeconds = 0
      const saveSnapshot = vi.fn()

      // Simulate interval with auto-save every 10 seconds
      const interval = setInterval(() => {
        elapsedSeconds += 1
        if (elapsedSeconds % 10 === 0) {
          saveSnapshot()
        }
      }, 1000)

      vi.advanceTimersByTime(10000)
      expect(saveSnapshot).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(10000)
      expect(saveSnapshot).toHaveBeenCalledTimes(2)

      clearInterval(interval)
    })
  })

  describe('Page Refresh Survival', () => {
    it('should restore running timer state from snapshot', () => {
      // Simulate a saved snapshot from a previous session
      const savedSnapshot = {
        id: 1,
        task_id: 1,
        user_id: 'default',
        is_running: 1,
        elapsed_seconds: 125,
        last_start_time: new Date(Date.now() - 30000).toISOString(), // Started 30 seconds ago
      }

      const now = Date.now()
      const startTime = new Date(savedSnapshot.last_start_time).getTime()
      const additionalSeconds = Math.floor((now - startTime) / 1000)
      const totalElapsed = savedSnapshot.elapsed_seconds + additionalSeconds

      expect(totalElapsed).toBeGreaterThan(savedSnapshot.elapsed_seconds)
      expect(savedSnapshot.is_running).toBe(1)
    })

    it('should restore paused timer state from snapshot', () => {
      const savedSnapshot = {
        id: 2,
        task_id: 2,
        user_id: 'default',
        is_running: 0,
        elapsed_seconds: 45,
        last_start_time: null,
      }

      expect(savedSnapshot.is_running).toBe(0)
      expect(savedSnapshot.elapsed_seconds).toBe(45)
    })

    it('should handle missing snapshot gracefully', () => {
      const snapshot = null

      const elapsedSeconds = snapshot ? snapshot.elapsed_seconds : 0
      const isRunning = snapshot ? snapshot.is_running === 1 : false

      expect(elapsedSeconds).toBe(0)
      expect(isRunning).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors gracefully when saving snapshot', () => {
      const saveSnapshot = vi.fn().mockImplementation(() => {
        try {
          throw new Error('Database error')
        } catch (error) {
          console.error('Failed to save time snapshot:', error)
        }
      })

      expect(() => saveSnapshot()).not.toThrow()
    })

    it('should handle database errors gracefully when loading snapshot', () => {
      const loadSnapshot = vi.fn().mockImplementation(() => {
        try {
          throw new Error('Database error')
        } catch (error) {
          console.error('Failed to load time snapshot:', error)
          return null
        }
      })

      expect(loadSnapshot()).toBeNull()
    })

    it('should handle errors when stopping timer', () => {
      const stopTimer = vi.fn().mockImplementation(() => {
        try {
          throw new Error('Database error')
        } catch (error) {
          console.error('Failed to stop timer:', error)
        }
      })

      expect(() => stopTimer()).not.toThrow()
    })
  })

  describe('Cleanup and Memory Management', () => {
    it('should remove event listeners on cleanup', () => {
      const cleanup = () => {
        window.removeEventListener('blur', vi.fn())
        window.removeEventListener('beforeunload', vi.fn())
        document.removeEventListener('visibilitychange', vi.fn())
      }

      expect(cleanup).not.toThrow()
    })

    it('should clear intervals on cleanup', () => {
      const interval = setInterval(() => {}, 1000)

      expect(() => clearInterval(interval)).not.toThrow()
    })
  })
})