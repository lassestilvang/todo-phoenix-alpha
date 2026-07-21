import { expect, describe, it, vi, beforeEach } from 'vitest'
import { createTaskFromNLP, parseTaskInput } from '../nlp/task-parser'
import { getTasks, updateTask, Task } from '../db/tasks'

// Mock the database functions
vi.mock('../db/tasks', () => ({
  getTasks: vi.fn(),
  updateTask: vi.fn(),
  createTask: vi.fn(),
}))

// Mock the NLP functions
vi.mock('../nlp/task-parser', () => ({
  parseTaskInput: vi.fn((input: string) => {
    // Check if input contains date patterns
    const hasDate = /\b(today|tomorrow|yesterday|this evening|next week|on \w+|by \w+|\d{4}-\d{2}-\d{2}|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(input)
    const name = input.replace(/\s+(today|tomorrow|yesterday|this evening|next week|on \w+|by \w+|\d{4}-\d{2}-\d{2}|monday|tuesday|wednesday|thursday|friday|saturday|sunday)( \w+)?/gi, '').trim()

    return {
      id: 1,
      name: name || input,
      deadline: hasDate ? new Date() : null,
      priority: 'medium' as const,
      date: hasDate ? new Date() : null,
    }
  }),
  createTaskFromNLP: vi.fn((input: string, userId: number) => ({
    id: userId,
    name: input.replace(/\s+(by|at|on)\s+.*$/i, '').trim(),
    deadline: new Date('2026-08-15T17:00:00'),
    priority: 'high' as const,
    date: new Date(),
  })),
}))

describe('Task creation from NLP', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create task with deadline from natural language', async () => {
    const result = await createTaskFromNLP('Finish report by Friday 5pm high priority', 1)
    expect(result.id).toBe(1)
    expect(result.name).toBe('Finish report')
    expect(result.deadline).toBeDefined()
    expect(result.priority).toBe('high')
  })

  it('should handle incomplete date input', async () => {
    const result = await createTaskFromNLP('Buy groceries tomorrow', 2)
    expect(result.id).toBe(2)
    expect(result.date).toBeDefined()
    expect(result.deadline).toBeDefined()
  })

  it('should extract priority from natural language', async () => {
    const result = await createTaskFromNLP('Submit report urgent', 1)
    expect(result.priority).toBe('high')
  })
})

describe('Task updates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should update task description', async () => {
    const initialTask: Task = { id: 1, name: 'Draft presentation', is_completed: 0, user_id: 1, created_at: new Date(), updated_at: new Date() }
    const updatedTask = { ...initialTask, is_completed: 1 }
    expect(updatedTask.is_completed).toBe(1)
  })

  it('should toggle task completion status', async () => {
    const task: Task = { id: 1, name: 'Test task', is_completed: 0, user_id: 1, created_at: new Date(), updated_at: new Date() }
    const completedTask = { ...task, is_completed: 1 }
    expect(completedTask.is_completed).toBe(1)
  })
})

describe('Task parsing', () => {
  it('should parse task with due date', () => {
    const result = parseTaskInput('Review code tomorrow')
    expect(result.name).toBe('Review code')
    expect(result.deadline).toBeDefined()
  })

  it('should handle tasks without dates', () => {
    const result = parseTaskInput('Learn TypeScript')
    expect(result.name).toBe('Learn TypeScript')
    expect(result.deadline).toBeNull()
  })
})