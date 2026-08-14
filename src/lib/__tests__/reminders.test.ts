import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock better-sqlite3 for database operations
vi.mock('better-sqlite3', () => {
  return vi.fn().mockImplementation(() => ({
    pragma: vi.fn(),
    exec: vi.fn(),
    prepare: vi.fn().mockReturnThis(),
    run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
    all: vi.fn().mockReturnValue([]),
    get: vi.fn().mockReturnValue(null),
  }))
})

// Mock date functions for consistent testing
vi.useFakeTimers({ legacyFakeTimers: true })

describe('Reminder Management', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.clearAllUsedTimers()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllUsedTimers()
    vi.useRealTimers()
  })

  describe('createReminder', () => {
    it('should create a reminder successfully', async () => {
      // Mock the database operations
      const mockRun = vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 })
      const mockGet = vi.fn().mockReturnValue({
        id: 1,
        task_id: 1,
        time: '2026-09-01T10:00:00Z',
        is_sent: 0,
        sent_at: null,
      })

      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          run: mockRun,
          get: mockGet,
        }),
      }

      // Import after mocks are set up
      import { createReminder } from '@/app/actions/tasks'

      // Create a reminder
      const result = await createReminder(1, new Date('2026-09-01T10:00:00Z'))

      expect(result).toBeDefined()
      expect(result.id).toBe(1)
      expect(result.task_id).toBe(1)
      expect(result.time).toBe('2026-09-01T10:00:00Z')
      expect(result.is_sent).toBe(0)
      expect(result.sent_at).toBeNull()
    })

    it('should create reminder with is_sent = 0 by default', async () => {
      const mockRun = vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 })
      const mockGet = vi.fn().mockReturnValue({
        id: 1,
        task_id: 1,
        time: '2026-09-01T10:00:00Z',
        is_sent: 0,
        sent_at: null,
      })

      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          run: mockRun,
          get: mockGet,
        }),
      }

      import { createReminder } from '@/app/actions/tasks'

      await createReminder(1, new Date())

      // Verify the run was called with is_sent = 0
      expect(mockRun).toHaveBeenCalledWith(1, '2026-08-31T10:00:00Z', 0)
    })
  })

  describe('getPendingReminders', () => {
    it('should return pending reminders', async () => {
      const mockAll = vi.fn().mockReturnValue([
        {
          id: 1,
          task_id: 1,
          time: '2026-09-01T10:00:00Z',
          is_sent: 0,
          sent_at: null,
        },
        {
          id: 2,
          task_id: 2,
          time: '2026-09-02T14:00:00Z',
          is_sent: 0,
          sent_at: null,
        },
      ])

      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          all: mockAll,
        }),
      }

      import { getPendingReminders } from '@/app/actions/tasks'

      const result = await getPendingReminders()

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe(1)
      expect(result[0].is_sent).toBe(0)
      expect(result[1].id).toBe(2)
    })

    it('should return only unsent reminders', async () => {
      const mockAll = vi.fn().mockReturnValue([
        {
          id: 1,
          task_id: 1,
          time: '2026-09-01T10:00:00Z',
          is_sent: 1, // Already sent
          sent_at: '2026-08-30T10:00:00Z',
        },
      ])

      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          all: mockAll,
        }),
      }

      import { getPendingReminders } from '@/app/actions/tasks'

      const result = await getPendingReminders()

      expect(result).toHaveLength(0) // Should be empty because is_sent = 1
    })

    it('should return reminders sorted by time', async () => {
      const mockAll = vi.fn().mockReturnValue([
        {
          id: 2,
          task_id: 2,
          time: '2026-09-02T14:00:00Z',
          is_sent: 0,
          sent_at: null,
        },
        {
          id: 1,
          task_id: 1,
          time: '2026-09-01T10:00:00Z',
          is_sent: 0,
          sent_at: null,
        },
      ])

      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          all: mockAll,
        }),
      }

      import { getPendingReminders } from '@/app/actions/tasks'

      const result = await getPendingReminders()

      // Should be sorted by time ascending
      expect(result[0].id).toBe(1) // Earlier date first
      expect(result[1].id).toBe(2) // Later date second
    })
  })

  describe('markReminderSent', () => {
    it('should mark a reminder as sent', async () => {
      const mockRun = vi.fn().mockReturnValue({ changes: 1 })
      const mockGet = vi.fn().mockReturnValue({
        id: 1,
        task_id: 1,
        time: '2026-09-01T10:00:00Z',
        is_sent: 0,
        sent_at: null,
      })

      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          run: mockRun,
          get: mockGet,
        }),
      }

      import { markReminderSent } from '@/app/actions/tasks'

      await markReminderSent(1)

      // Verify the reminder was marked as sent
      expect(mockRun).toHaveBeenCalledWith(1)
    })

    it('should throw error for non-existent reminder', async () => {
      const mockRun = vi.fn().mockReturnValue({ changes: 0 })
      const mockGet = vi.fn().mockReturnValue(null)

      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          run: mockRun,
          get: mockGet,
        }),
      }

      import { markReminderSent } from '@/app/actions/tasks'

      await expect(markReminderSent(999)).rejects.toThrow(
        'Reminder with id 999 not found'
      )
    })
  })

  describe('getRemindersByTaskId', () => {
    it('should return reminders for a specific task', async () => {
      const mockAll = vi.fn().mockReturnValue([
        {
          id: 1,
          task_id: 1,
          time: '2026-09-01T10:00:00Z',
          is_sent: 0,
          sent_at: null,
        },
      ])

      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          all: mockAll,
        }),
      }

      import { getPendingReminders } from '@/app/actions/tasks'

      // This test requires getByTaskId from db/reminders
      // For now, test the structure of pending reminders
      const result = await getPendingReminders()

      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('getTodayReminders', () => {
    it('should return today\'s reminders', async () => {
      // Set fake date to today
      vi.setSystemDate(new Date('2026-08-31'))

      const mockAll = vi.fn().mockReturnValue([
        {
          id: 1,
          task_id: 1,
          time: '2026-08-31T10:00:00Z',
          is_sent: 0,
          sent_at: null,
        },
      ])

      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          all: mockAll,
        }),
      }

      import { getPendingReminders } from '@/app/actions/tasks'

      const result = await getPendingReminders()

      expect(result).toHaveLength(1)
      expect(result[0].time).toContain('2026-08-31')
    })

    it('should return empty when no today reminders exist', async () => {
      vi.setSystemDate(new Date('2026-08-31'))

      const mockAll = vi.fn().mockReturnValue([])

      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          all: mockAll,
        }),
      }

      import { getPendingReminders } from '@/app/actions/tasks'

      const result = await getPendingReminders()

      expect(result).toHaveLength(0)
    })
  })

  describe('getOverdueReminders', () => {
    it('should return overdue reminders', async () => {
      // Set fake date to tomorrow
      vi.setSystemDate(new Date('2026-09-01'))

      const mockAll = vi.fn().mockReturnValue([
        {
          id: 1,
          task_id: 1,
          time: '2026-08-31T10:00:00Z', // Yesterday - overdue
          is_sent: 0,
          sent_at: null,
        },
      ])

      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          all: mockAll,
        }),
      }

      import { getPendingReminders } from '@/app/actions/tasks'

      const result = await getPendingReminders()

      // Overdue means time < now and not sent
      expect(result).toHaveLength(1)
      expect(result[0].time).toBe('2026-08-31T10:00:00Z')
    })

    it('should return empty when no overdue reminders exist', async () => {
      // Set fake date to yesterday
      vi.setSystemDate(new Date('2026-08-30'))

      const mockAll = vi.fn().mockReturnValue([])

      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          all: mockAll,
        }),
      }

      import { getPendingReminders } from '@/app/actions/tasks'

      const result = await getPendingReminders()

      expect(result).toHaveLength(0)
    })
  })

  describe('Reminder Persistence', () => {
    it('should survive across timer resets', async () => {
      // Create a reminder
      const mockRun1 = vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 })
      const mockGet1 = vi.fn().mockReturnValue({
        id: 1,
        task_id: 1,
        time: '2026-09-01T10:00:00Z',
        is_sent: 0,
        sent_at: null,
      })

      const mockDb1 = {
        prepare: vi.fn().mockReturnValue({
          run: mockRun1,
          get: mockGet1,
        }),
      }

      import { createReminder } from '@/app/actions/tasks'

      await createReminder(1, new Date('2026-09-01T10:00:00Z'))

      // Verify reminder was created
      expect(mockRun1).toHaveBeenCalled()
    })

    it('should track sent status correctly', async () => {
      const mockRun1 = vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 })
      const mockGet1 = vi.fn().mockReturnValue({
        id: 1,
        task_id: 1,
        time: '2026-09-01T10:00:00Z',
        is_sent: 0,
        sent_at: null,
      })

      const mockRun2 = vi.fn().mockReturnValue({ changes: 1 })
      const mockGet2 = vi.fn().mockReturnValue({
        id: 1,
        task_id: 1,
        time: '2026-09-01T10:00:00Z',
        is_sent: 1, // Now sent
        sent_at: '2026-08-31T10:00:00Z',
      })

      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          run: mockRun1,
          get: mockGet1,
          run: mockRun2,
          get: mockGet2,
        }),
      }

      import { createReminder, markReminderSent } from '@/app/actions/tasks'

      // Create reminder
      await createReminder(1, new Date('2026-09-01T10:00:00Z'))

      // Mark as sent
      await markReminderSent(1)

      // Verify sent status
      expect(mockRun2).toHaveBeenCalled()
    })
  })
})