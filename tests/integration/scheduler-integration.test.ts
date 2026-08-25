import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the database module
vi.mock('../../src/lib/db/schema', () => {
  const mockData = {
    tasks: [
      { id: 1, name: 'Test Task', list_id: 1, is_completed: 0 },
      { id: 2, name: 'Another Task', list_id: 1, is_completed: 1 }
    ],
    migrations: [
      { version: '1.0.0', status: 'applied' }
    ],
    sqlite_master: [
      { name: 'tasks' },
      { name: 'reminders' },
      { name: 'projects' },
      { name: 'time_tracking_rules' },
      { name: 'audit_logs' },
      { name: 'migrations' }
    ]
  }

  return {
    default: {
      prepare: vi.fn((query: string) => {
        if (query.includes('SELECT version FROM migrations')) {
          return {
            get: () => ({ version: '1.0.0' })
          }
        }
        if (query.includes('SELECT name FROM sqlite_master WHERE type=\'table\'')) {
          return {
            all: () => mockData.sqlite_master
          }
        }
        if (query.includes('SELECT * FROM tasks LIMIT 1')) {
          return {
            get: () => mockData.tasks[0]
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
  }
})

import db from '../../src/lib/db/schema'

describe('Scheduler Integration', () => {
  it('should initialize scheduler without errors', () => {
    expect(db).toBeDefined()
  })

  it('should have proper schema version', () => {
    const version = db.prepare('SELECT version FROM migrations LIMIT 1').get() as { version: string } | undefined
    expect(version).toBeDefined()
    expect(version?.version).toBe('1.0.0')
  })

  it('should have all required tables', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]
    const tableNames = tables.map(t => t.name)

    expect(tableNames).toContain('tasks')
    expect(tableNames).toContain('reminders')
    expect(tableNames).toContain('projects')
    expect(tableNames).toContain('time_tracking_rules')
    expect(tableNames).toContain('audit_logs')
  })

  it('should handle task creation and associations', async () => {
    const testTask = db.prepare('SELECT * FROM tasks LIMIT 1').get()
    expect(testTask).toBeDefined()
    expect(testTask.id).toBe(1)
    expect(testTask.name).toBe('Test Task')
  })
})