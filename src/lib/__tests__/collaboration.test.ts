import { describe, it, expect, vi, beforeEach } from 'vitest'
import { taskOperations } from '../db/tasks'

describe('Task Collaboration Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Hook structure', () => {
    it('should export a useTaskCollaboration function', async () => {
      const { useTaskCollaboration } = await import('../hooks/use-collaboration')
      expect(useTaskCollaboration).toBeDefined()
      expect(typeof useTaskCollaboration).toBe('function')
    })

    it('should export a useGeneralCollaboration function', async () => {
      const { useGeneralCollaboration } = await import('../hooks/use-collaboration')
      expect(useGeneralCollaboration).toBeDefined()
      expect(typeof useGeneralCollaboration).toBe('function')
    })
  })

  describe('taskOperations', () => {
    it('should get all tasks', () => {
      const tasks = taskOperations.getAll(true)
      expect(Array.isArray(tasks)).toBe(true)
    })

    it('should get all active tasks', () => {
      const tasks = taskOperations.getAll(false)
      expect(Array.isArray(tasks)).toBe(true)
    })

    it('should get tasks by list ID', () => {
      const tasks = taskOperations.getByListId(1, true)
      expect(Array.isArray(tasks)).toBe(true)
    })

    it('should find task by ID', () => {
      const task = taskOperations.getById(1)
      expect(typeof task).toBe('object')
    })
  })
})
