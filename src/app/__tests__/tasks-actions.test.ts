import { expect, describe, it, vi, beforeEach, afterEach } from 'vitest'
import { createBackup, exportDatabaseAsJson, getPendingReminders, markTaskRunCompleted } from '@/app/actions/tasks'

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
})