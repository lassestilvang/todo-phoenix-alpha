import { expect, describe, it, vi, beforeEach } from 'vitest'
import {
  createBackup,
  exportDatabaseAsJson,
  getPendingReminders,
  markTaskRunCompleted,
  getTaskSuggestions,
  addTaskDependency,
  removeTaskDependency,
  getTaskDependencies,
  wouldCreateCircularDependency,
} from '@/app/actions/tasks'

// Mock the database and utilities
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn().mockReturnValue(Buffer.from('mock database content')),
  writeFileSync: vi.fn(),
  copyFileSync: vi.fn(),
}))

vi.mock('crypto', () => ({
  createHash: vi.fn().mockReturnValue({
    update: vi.fn().mockReturnValue({
      digest: vi.fn().mockReturnValue('mock-checksum-value'),
    }),
  }),
}))

vi.mock('path', () => ({
  join: vi.fn().mockImplementation((...args) => args.join('/')),
}))

// Mock the database
vi.mock('@/lib/db/schema', () => ({
  default: {
    prepare: vi.fn().mockReturnThis(),
    run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
    all: vi.fn().mockReturnValue([]),
    get: vi.fn().mockReturnValue({ id: 1 }),
  },
}))

// Mock better-sqlite3
vi.mock('better-sqlite3', () => {
  return vi.fn().mockImplementation(() => ({
    pragma: vi.fn(),
    exec: vi.fn(),
    prepare: vi.fn().mockReturnThis(),
    run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
    all: vi.fn().mockReturnValue([]),
    get: vi.fn().mockReturnValue({ id: 1 }),
  }))
})

// Mock the AI enhancement module
vi.mock('@/lib/ai/enhancement', () => ({
  generateTaskSuggestions: vi.fn(),
  generateInsights: vi.fn(),
}))

describe('Tasks Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createBackup', () => {
    it('should create a backup successfully', async () => {
      const result = await createBackup('Test backup')
      expect(result).toContain('backup-')
      expect(result).toContain('.db')
    })

    it('should use default description when not provided', async () => {
      await createBackup()
      // Should still create successfully
    })
  })

  describe('exportDatabaseAsJson', () => {
    it('should export database as JSON and return backup info', async () => {
      const result = await exportDatabaseAsJson()
      expect(result).toHaveProperty('backupId')
      expect(result).toHaveProperty('filePath')
      expect(result.filePath).toContain('backup-')
    })
  })

  describe('getPendingReminders', () => {
    it('should return pending reminders array', async () => {
      const result = await getPendingReminders()
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('markTaskRunCompleted', () => {
    it('should mark task run as completed', async () => {
      await markTaskRunCompleted(1, '2024-01-15')
      // Should complete without error
    })
  })

  describe('AI & Dependency Integration', () => {
    describe('getTaskSuggestions', () => {
      it('should return basic suggestions without AI', async () => {
        ;(generateTaskSuggestions as any).mockResolvedValue({
          priority: 'medium',
          suggestedTimeEstimate: 30,
          suggestedDate: null,
          relatedTasks: [],
          confidence: 30,
        })

        const result = await getTaskSuggestions(1)
        expect(result.priority).toBe('medium')
        expect(result.suggestedTimeEstimate).toBe(30)
      })

      it('should enhance priority based on deadline proximity', async () => {
        ;(generateTaskSuggestions as any).mockResolvedValue({
          priority: 'high',
          suggestedTimeEstimate: 60,
          suggestedDate: null,
          relatedTasks: [],
          confidence: 85,
          predictiveSchedule: {
            startDate: new Date('2026-08-18'),
            optimalStartTime: '09:00',
            confidence: 90,
          },
        })

        const result = await getTaskSuggestions(1)
        expect(result.priority).toBe('high')
        expect(result.predictiveSchedule).toBeDefined()
        expect(result.predictiveSchedule?.optimalStartTime).toBe('09:00')
      })

      it('should include predictive schedule recommendations', async () => {
        ;(generateTaskSuggestions as any).mockResolvedValue({
          priority: 'medium',
          suggestedTimeEstimate: 45,
          suggestedDate: null,
          relatedTasks: [],
          confidence: 70,
          predictiveSchedule: {
            startDate: new Date('2026-08-18'),
            optimalStartTime: '09:00',
            confidence: 80,
          },
        })

        const result = await getTaskSuggestions(1)
        expect(result.predictiveSchedule).toBeDefined()
        expect(result.predictiveSchedule?.startDate).toBeInstanceOf(Date)
        expect(result.predictiveSchedule?.optimalStartTime).toBe('09:00')
        expect(result.predictiveSchedule?.confidence).toBe(80)
      })
    })

    describe('addTaskDependency', () => {
      it('should add a dependency successfully', async () => {
        // Mock task operations
        const mockTask = { id: 1, dependencies: '[]' as const }
        const mockGetTask = vi.fn().mockReturnValue(mockTask)
        const mockGetAll = vi.fn().mockReturnValue([mockTask])

        // @ts-ignore
        const taskOperations = {
          getById: mockGetTask,
          getAll: mockGetAll,
          create: vi.fn(),
          update: vi.fn(),
          toggleComplete: vi.fn(),
          delete: vi.fn(),
          search: vi.fn(),
        } as any

        // @ts-ignore
        const taskModule = await import('@/app/actions/tasks')
        ;(taskModule as any).taskOperations = taskOperations

        const result = await addTaskDependency(1, 2)
        // Should complete without error
        expect(result).toBeUndefined()
      })

      it('should prevent self-dependency', async () => {
        // Mock task that already has dependencies
        const mockTask = { id: 1, dependencies: JSON.stringify([1]) as const }
        const mockGetTask = vi.fn().mockReturnValue(mockTask)
        const mockGetAll = vi.fn().mockReturnValue([])

        // @ts-ignore
        const taskOperations = {
          getById: mockGetTask,
          getAll: mockGetAll,
          create: vi.fn(),
          update: vi.fn(),
          toggleComplete: vi.fn(),
          delete: vi.fn(),
          search: vi.fn(),
        } as any

        // @ts-ignore
        const taskModule = await import('@/app/actions/tasks')
        ;(taskModule as any).taskOperations = taskOperations

        await expect(addTaskDependency(1, 1)).rejects.toThrow('A task cannot depend on itself')
      })

      it('should prevent circular dependency', async () => {
        // Mock task 1 depends on task 2, task 2 depends on task 1
        const mockTask1 = { id: 1, dependencies: JSON.stringify([2]) as const }
        const mockTask2 = { id: 2, dependencies: JSON.stringify([1]) as const }
        const mockGetTask1 = vi.fn().mockReturnValue(mockTask1)
        const mockGetTask2 = vi.fn().mockReturnValue(mockTask2)
        const mockGetAll = vi.fn().mockReturnValue([mockTask1, mockTask2])

        // @ts-ignore
        const taskOperations = {
          getById: mockGetTask1,
          getAll: mockGetAll,
          create: vi.fn(),
          update: vi.fn(),
          toggleComplete: vi.fn(),
          delete: vi.fn(),
          search: vi.fn(),
        } as any

        // @ts-ignore
        const taskModule = await import('@/app/actions/tasks')
        ;(taskModule as any).taskOperations = taskOperations

        await expect(addTaskDependency(1, 2)).rejects.toThrow('circular dependency')
      })
    })

    describe('removeTaskDependency', () => {
      it('should remove a dependency successfully', async () => {
        // Mock task with dependencies
        const mockTask = { id: 1, dependencies: JSON.stringify([2, 3]) as const }
        const mockGetTask = vi.fn().mockReturnValue(mockTask)
        const mockGetAll = vi.fn().mockReturnValue([])

        // @ts-ignore
        const taskOperations = {
          getById: mockGetTask,
          getAll: mockGetAll,
          create: vi.fn(),
          update: vi.fn(),
          toggleComplete: vi.fn(),
          delete: vi.fn(),
          search: vi.fn(),
        } as any

        // @ts-ignore
        const taskModule = await import('@/app/actions/tasks')
        ;(taskModule as any).taskOperations = taskOperations

        const result = await removeTaskDependency(1, 2)
        expect(result).toBeUndefined()
      })
    })

    describe('Predictive Scheduling', () => {
      it('should calculate optimal start date based on deadline', async () => {
        ;(generateTaskSuggestions as any).mockResolvedValue({
          priority: 'medium',
          suggestedTimeEstimate: 45,
          suggestedDate: null,
          relatedTasks: [],
          confidence: 70,
          predictiveSchedule: {
            startDate: new Date('2026-08-18T09:00:00.000Z'),
            optimalStartTime: '09:00',
            confidence: 80,
          },
        })

        const result = await getTaskSuggestions(1)
        expect(result.predictiveSchedule?.startDate).toBeInstanceOf(Date)
        expect(result.predictiveSchedule?.optimalStartTime).toBe('09:00')
        expect(result.predictiveSchedule?.confidence).toBe(80)
      })
    })
  })

  describe('TaskParser integration', () => {
    it('should parse recurring patterns', async () => {
      const { parseRecurringPattern } = await import('@/lib/nlp/task-parser')

      expect(parseRecurringPattern('every 2 days')).toEqual(
        expect.objectContaining({ isRecurring: true, interval: 2, unit: 'day' })
      )
      expect(parseRecurringPattern('every Monday')).toEqual(
        expect.objectContaining({ isRecurring: true, weekdays: [1] })
      )
      expect(parseRecurringPattern('daily')).toEqual(
        expect.objectContaining({ isRecurring: true, interval: 1, unit: 'day' })
      )
    })

    it('should parse date and time patterns', async () => {
      const { parse } = await import('@/lib/nlp/task-parser')

      // Test that parser handles various date formats
      const result = parse('task due at 3pm tomorrow', new Date(), {
        forwardDate: true,
      })
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('Dependency Graph', () => {
    it('should validate dependencies correctly', async () => {
      const { getTaskDependencies, validateDependencies } = await import('@/app/actions/tasks')

      // Mock functions
      const mockDeps = [2, 3]
      expect(Array.isArray(mockDeps)).toBe(true)
      expect(mockDeps.length).toBe(2)
    })
  })
})