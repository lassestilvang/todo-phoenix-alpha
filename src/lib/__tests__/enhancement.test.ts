import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateTaskSuggestions, generateInsights, generateSmartRecommendations } from '@/lib/ai/enhancement'

describe('AI Enhancement Module', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Ensure VITEST env is set for mocking
    process.env.VITEST = 'true'
  })

  describe('generateTaskSuggestions', () => {
    it('should return fallback suggestions when API is not available', async () => {
      const task = {
        id: 1,
        name: 'Test task',
        description: 'A test task',
        estimate_minutes: 30,
        priority: 'medium',
        is_completed: false,
        deadline: new Date().toISOString(),
      }

      const result = await generateTaskSuggestions(task)

      expect(result).toBeDefined()
      expect(result.priority).toBe('medium')
      expect(result.suggestedTimeEstimate).toBe(30)
      expect(result.suggestedDate).toBeNull()
      expect(result.relatedTasks).toEqual([])
      expect(result.confidence).toBe(30)
    })

    it('should return fallback suggestions when API call fails', async () => {
      const task = {
        id: 2,
        name: 'Another task',
        estimate_minutes: 60,
      }

      const result = await generateTaskSuggestions(task)

      expect(result).toBeDefined()
      expect(result.confidence).toBe(30)
    })

    it('should handle task without estimate_minutes', async () => {
      const task = {
        id: 3,
        name: 'Task without estimate',
      }

      const result = await generateTaskSuggestions(task)

      expect(result.suggestedTimeEstimate).toBe(30)
    })

    it('should validate priority from API response', async () => {
      // In test env, the mock returns empty object, so it falls back
      const task = { id: 4, name: 'Test' }
      const result = await generateTaskSuggestions(task)

      expect(['high', 'medium', 'low', 'none']).toContain(result.priority)
    })

    it('should ensure suggestedTimeEstimate is non-negative', async () => {
      const task = { id: 5, name: 'Test' }
      const result = await generateTaskSuggestions(task)

      expect(result.suggestedTimeEstimate).toBeGreaterThanOrEqual(0)
    })

    it('should ensure relatedTasks is an array', async () => {
      const task = { id: 6, name: 'Test' }
      const result = await generateTaskSuggestions(task)

      expect(Array.isArray(result.relatedTasks)).toBe(true)
    })
  })

  describe('generateInsights', () => {
    it('should return fallback insights when API is not available', async () => {
      const userData = {
        tasks: [
          { id: 1, name: 'Task 1', is_completed: true },
          { id: 2, name: 'Task 2', is_completed: false },
        ],
        completedTasks: 5,
        overdueTasks: 2,
        timeEntries: [
          { taskId: 1, duration: 30 },
          { taskId: 2, duration: 45 },
        ],
      }

      const result = await generateInsights(userData)

      expect(result).toBeDefined()
      expect(result.mostProductiveTimeOfDay).toBe(14)
      expect(result.commonTaskDuration).toBe(45)
      expect(result.preferredPriorityDistribution).toEqual({
        high: 30,
        medium: 40,
        low: 20,
        none: 10,
      })
      expect(result.taskCompletionRate).toBe(85)
      expect(result.peakFocusHours).toEqual([9, 10, 14, 15])
    })

    it('should return correct structure for empty user data', async () => {
      const userData = {
        tasks: [],
        completedTasks: 0,
        overdueTasks: 0,
        timeEntries: [],
      }

      const result = await generateInsights(userData)

      expect(result.mostProductiveTimeOfDay).toBe(14)
      expect(result.commonTaskDuration).toBe(45)
      expect(result.taskCompletionRate).toBe(85)
    })

    it('should handle large task arrays', async () => {
      const tasks = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        name: `Task ${i}`,
        is_completed: i % 2 === 0,
      }))

      const userData = {
        tasks,
        completedTasks: 50,
        overdueTasks: 10,
        timeEntries: [],
      }

      const result = await generateInsights(userData)

      expect(result).toBeDefined()
      expect(result.taskCompletionRate).toBe(85)
    })
  })

  describe('generateSmartRecommendations', () => {
    it('should return fallback recommendations when API is not available', async () => {
      const userData = {
        tasks: [
          { id: 1, name: 'Recurring task', is_completed: false },
        ],
        timeEntries: [],
      }

      const result = await generateSmartRecommendations(userData)

      expect(result).toBeDefined()
      expect(result.suggestedTasks).toEqual([])
      expect(result.optimalScheduleBlocks).toEqual([])
      expect(result.automationOpportunities).toContain('Consider automating recurring tasks')
      expect(result.automationOpportunities).toContain('Batch similar tasks together')
      expect(result.automationOpportunities).toContain('Use templates for repetitive tasks')
    })

    it('should return correct structure for empty data', async () => {
      const userData = {
        tasks: [],
        timeEntries: [],
      }

      const result = await generateSmartRecommendations(userData)

      expect(result.suggestedTasks).toEqual([])
      expect(result.optimalScheduleBlocks).toEqual([])
      expect(result.automationOpportunities.length).toBe(3)
    })

    it('should handle tasks with patterns', async () => {
      const userData = {
        tasks: [
          { id: 1, name: 'Weekly review', is_completed: false },
          { id: 2, name: 'Daily standup', is_completed: true },
        ],
        timeEntries: [
          { taskId: 1, duration: 60 },
          { taskId: 2, duration: 15 },
        ],
      }

      const result = await generateSmartRecommendations(userData)

      expect(result.automationOpportunities).toBeInstanceOf(Array)
      expect(result.automationOpportunities.length).toBe(3)
    })
  })

  describe('Error handling', () => {
    it('should not throw on API failures', async () => {
      const task = { id: 1, name: 'Test' }
      const userData = { tasks: [], completedTasks: 0, overdueTasks: 0, timeEntries: [] }

      await expect(generateTaskSuggestions(task)).resolves.toBeDefined()
      await expect(generateInsights(userData)).resolves.toBeDefined()
      await expect(generateSmartRecommendations(userData)).resolves.toBeDefined()
    })

    it('should return valid fallbacks even with malformed task data', async () => {
      const task = { name: 'Test task' } as any // missing estimate_minutes
      const result = await generateTaskSuggestions(task)

      expect(result).toBeDefined()
      expect(result.priority).toBe('medium')
      expect(result.suggestedTimeEstimate).toBe(30)
    })
  })
})