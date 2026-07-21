import { createTaskFromNLP } from '../../app/actions/tasks'
import { toggleComplete } from '../../app/actions/tasks'
import { expect, it, describe } from 'vitest'

// Test task creation from NLP
describe('Task creation from NLP', () => {
  it('should create task with deadline from natural language', async () => {
    const result = await createTaskFromNLP('Finish report by Friday 5pm high priority', 1)
    expect(result.name).toBe('Finish report')
    expect(result.deadline).toBeDefined()
    expect(result.priority).toBe('high')
  })

  it('should handle incomplete date input', async () => {
    const result = await createTaskFromNLP('Buy groceries tomorrow', 2)
    expect(result.date).toBeDefined()
    expect(result.deadline).toBeDefined()
  })
})

// Test task updates
describe('Task updates', () => {
  it('should update task description', async () => {
    // First create a task
    const initialTask = await createTaskFromNLP('Draft presentation', 1)
    const updatedTask = await toggleComplete(initialTask.id)
    expect(updatedTask.is_completed).toBe(true)
  })
})