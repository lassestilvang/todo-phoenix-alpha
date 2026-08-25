import { expect, describe, it, vi, beforeEach } from 'vitest'
import { generatePredictions } from '../services/predictive-scheduling-service'

// Mock the database modules
vi.mock('../db/schema', () => ({
  default: {
    prepare: vi.fn((query: string) => {
      if (query.includes('SELECT version FROM migrations')) {
        return {
          get: () => ({ version: '1.0.0' })
        }
      }
      if (query.includes('SELECT name FROM sqlite_master WHERE type=\'table\'')) {
        return {
          all: () => [
            { name: 'tasks' },
            { name: 'reminders' },
            { name: 'projects' },
            { name: 'time_tracking_rules' },
            { name: 'audit_logs' }
          ]
        }
      }
      if (query.includes('SELECT * FROM tasks LIMIT 1')) {
        return {
          get: () => ({ id: 1, name: 'Test Task', is_completed: 0 })
        }
      }
      if (query.includes('SELECT id FROM lists WHERE is_default = 1')) {
        return {
          get: () => ({ id: 1 })
        }
      }
      return {
        get: () => null,
        all: () => [],
        run: () => ({ changes: () => 0 })
      }
    })
  }
}))

vi.mock('../db/tasks', () => ({
  getAllTasks: vi.fn(() => [
    { id: 1, name: 'Test Task 1', is_completed: 0, priority: 'high', estimate_minutes: 60 },
    { id: 2, name: 'Test Task 2', is_completed: 0, priority: 'medium', estimate_minutes: 90 },
    { id: 3, name: 'Test Task 3', is_completed: 1, priority: 'low', estimate_minutes: 30 }
  ]),
  getTaskById: vi.fn((id: number) => {
    const tasks = [
      { id: 1, name: 'Test Task 1', is_completed: 0, priority: 'high', estimate_minutes: 60 },
      { id: 2, name: 'Test Task 2', is_completed: 0, priority: 'medium', estimate_minutes: 90 },
      { id: 3, name: 'Test Task 3', is_completed: 1, priority: 'low', estimate_minutes: 30 }
    ]
    return tasks.find(t => t.id === id) || null
  })
}))

vi.mock('../db/time_entries', () => ({
  getAll: vi.fn(() => [
    { id: 1, task_id: 1, started_at: '2026-09-01T09:00:00', duration_minutes: 45 },
    { id: 2, task_id: 2, started_at: '2026-09-02T14:00:00', duration_minutes: 60 },
    { id: 3, task_id: 1, started_at: '2026-09-03T10:00:00', duration_minutes: 30 }
  ]),
  getTotalTimeForTask: vi.fn((taskId: number) => {
    const entries = [
      { id: 1, task_id: 1, duration_minutes: 45 },
      { id: 2, task_id: 2, duration_minutes: 60 },
      { id: 3, task_id: 1, duration_minutes: 30 }
    ]
    return entries.filter(e => e.task_id === taskId).reduce((sum, e) => sum + (e.duration_minutes || 0), 0)
  })
}))

describe('PredictiveSchedulingService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generatePredictions', () => {
    it('should generate predictions with 7d timeframe', async () => {
      const result = await generatePredictions('7d')
      expect(result).toBeDefined()
      expect(result).toHaveProperty('predictions')
      expect(result).toHaveProperty('productiveWindows')
      expect(result).toHaveProperty('schedulingSuggestions')
      expect(result).toHaveProperty('summary')
    })

    it('should handle 30d timeframe', async () => {
      const result = await generatePredictions('30d')
      expect(result).toBeDefined()
      expect(result).toHaveProperty('predictions')
      expect(result).toHaveProperty('productiveWindows')
      expect(result).toHaveProperty('schedulingSuggestions')
      expect(result).toHaveProperty('summary')
    })

    it('should handle 90d timeframe', async () => {
      const result = await generatePredictions('90d')
      expect(result).toBeDefined()
      expect(result).toHaveProperty('predictions')
      expect(result).toHaveProperty('productiveWindows')
      expect(result).toHaveProperty('schedulingSuggestions')
      expect(result).toHaveProperty('summary')
    })
  })
})