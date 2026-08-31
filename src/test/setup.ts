import '@testing-library/jest-dom'
import { vi, beforeAll, afterAll } from 'vitest'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock database schema (for tests that don't override it)
vi.mock('@/lib/db/schema', () => ({
  default: {
    prepare: vi.fn().mockImplementation((query: string) => {
      // Handle different query types
      if (query.includes('SELECT COUNT(*) as count FROM search_analytics')) {
        // For search analytics count query
        return {
          all: vi.fn(() => []),
          get: vi.fn(() => ({ count: 0 })),
          run: vi.fn(() => ({ lastInsertRowid: 1 })),
          exec: vi.fn(() => {}),
        };
      } else if (query.includes('SELECT * FROM tasks WHERE id = ?')) {
        // For task lookup by ID - return a sample task
        return {
          all: vi.fn(() => []),
          get: vi.fn(() => ({
            id: 1,
            name: 'Test Task',
            description: 'Test Description',
            priority: 'medium' as const,
            estimate_minutes: 30,
            date: null,
            deadline: null,
            is_completed: 0,
            is_recurring: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })),
          run: vi.fn(() => ({ lastInsertRowid: 1 })),
          exec: vi.fn(() => {}),
        };
      } else if (query.includes('SELECT * FROM tasks')) {
        // For getting all tasks
        return {
          all: vi.fn(() => [
            {
              id: 1,
              name: 'Test Task 1',
              description: 'Test Description 1',
              priority: 'high' as const,
              estimate_minutes: 60,
              date: null,
              deadline: null,
              is_completed: 0,
              is_recurring: 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            },
            {
              id: 2,
              name: 'Test Task 2',
              description: 'Test Description 2',
              priority: 'medium' as const,
              estimate_minutes: 30,
              date: null,
              deadline: null,
              is_completed: 0,
              is_recurring: 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          ]),
          get: vi.fn(() => undefined),
          run: vi.fn(() => ({ lastInsertRowid: 1 })),
          exec: vi.fn(() => {}),
        };
      } else {
        // Default mock for other queries
        return {
          all: vi.fn(() => []),
          get: vi.fn(() => undefined),
          run: vi.fn(() => ({ lastInsertRowid: 1 })),
          exec: vi.fn(() => {}),
        };
      }
    }),
  },
}))

// Suppress console.error in tests (optional, for cleaner output)
const originalError = console.error
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})
afterAll(() => {
  console.error = originalError
})