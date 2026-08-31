import { describe, it, expect, beforeEach } from 'vitest'
import { TaskDecompositionEngine, taskDecompositionEngine } from '@/lib/ai/task-decomposition-engine'

describe('TaskDecompositionEngine', () => {
  let engine: TaskDecompositionEngine

  beforeEach(() => {
    engine = new TaskDecompositionEngine()
  })

  describe('Basic decomposition', () => {
    it('should decompose a task into subtasks', () => {
      const result = engine.decomposeTask('Implement new feature', 'Build a new task creation flow')

      expect(result).toBeDefined()
      expect(result.parentTask).toBeDefined()
      expect(result.parentTask.name).toBe('Implement new feature')
      expect(result.subtasks).toBeInstanceOf(Array)
      expect(result.subtasks.length).toBeGreaterThan(0)
      expect(result.totalEstimatedMinutes).toBeGreaterThan(0)
      expect(result.suggestedOrder).toBeInstanceOf(Array)
      expect(result.dependencies).toBeInstanceOf(Object)
    })

    it('should set default list_id to 1 (Inbox)', () => {
      const result = engine.decomposeTask('Test task', 'A test description')
      expect(result.parentTask.list_id).toBe(1)
    })

    it('should estimate minutes on parent task', () => {
      const result = engine.decomposeTask('Test task', 'A test description')
      expect(result.parentTask.estimate_minutes).toBe(result.totalEstimatedMinutes)
    })
  })

  describe('Pattern matching', () => {
    it('should match project planning pattern', () => {
      const result = engine.decomposeTask('Plan the project', 'Create a roadmap strategy')
      const subtaskNames = result.subtasks.map(s => s.name)
      expect(subtaskNames.some(n => n.includes('scope') || n.includes('project'))).toBe(true)
    })

    it('should match feature development pattern', () => {
      const result = engine.decomposeTask('Build a new feature', 'Implement the feature')
      const subtaskNames = result.subtasks.map(s => s.name)
      expect(subtaskNames.some(n => n.includes('feature') || n.includes('design') || n.includes('Implementation'))).toBe(true)
    })

    it('should match research pattern', () => {
      const result = engine.decomposeTask('Research competitors', 'Analyze the market and evaluate options')
      const subtaskNames = result.subtasks.map(s => s.name)
      expect(subtaskNames.some(n => n.includes('research') || n.includes('sources') || n.includes('Analyze'))).toBe(true)
    })

    it('should match meeting prep pattern', () => {
      const result = engine.decomposeTask('Prepare for meeting', 'Set up the presentation call')
      const subtaskNames = result.subtasks.map(s => s.name)
      expect(subtaskNames.some(n => n.includes('agenda') || n.includes('meeting') || n.includes('materials'))).toBe(true)
    })

    it('should match content creation pattern', () => {
      const result = engine.decomposeTask('Write a blog post', 'Draft the article content')
      const subtaskNames = result.subtasks.map(s => s.name)
      console.log('Content creation subtask names:', subtaskNames)
      expect(subtaskNames.some(n => n.toLowerCase().includes('outline') || n.toLowerCase().includes('draft') || n.toLowerCase().includes('article'))).toBe(true)
    })

    it('should match learning pattern', () => {
      const result = engine.decomposeTask('Learn new skill', 'Study the course material')
      const subtaskNames = result.subtasks.map(s => s.name)
      console.log('Learning subtask names:', subtaskNames)
      expect(subtaskNames.some(n => n.toLowerCase().includes('learn') || n.toLowerCase().includes('objectives') || n.toLowerCase().includes('study'))).toBe(true)
    })

    it('should fall back to generic pattern when no match', () => {
      const result = engine.decomposeTask('Do something random', 'A non-categorized task')
      expect(result.subtasks.length).toBeGreaterThan(0)
      expect(result.subtasks[0].name).toContain('Do something random')
    })
  })

  describe('Priority inference', () => {
    it('should set high priority for urgent tasks', () => {
      const result = engine.decomposeTask('Fix critical bug', 'This is urgent and asap')
      expect(result.parentTask.priority).toBe('high')
    })

    it('should set low priority for someday/maybe tasks', () => {
      const result = engine.decomposeTask('Maybe do this later', 'A someday task')
      expect(result.parentTask.priority).toBe('low')
    })

    it('should default to medium priority', () => {
      const result = engine.decomposeTask('Regular task', 'A normal task')
      expect(result.parentTask.priority).toBe('medium')
    })

    it('should set medium priority when energy level is low', () => {
      const result = engine.decomposeTask('Some task', 'Description', {
        energyLevel: 'low'
      })
      expect(result.parentTask.priority).toBe('medium')
    })
  })

  describe('Subtask generation', () => {
    it('should generate subtasks with proper structure', () => {
      const result = engine.decomposeTask('Test task', 'Description')
      const subtask = result.subtasks[0]

      expect(subtask.id).toMatch(/^subtask-/)
      expect(subtask.name).toBeDefined()
      expect(subtask.description).toBeDefined()
      expect(subtask.estimatedMinutes).toBeGreaterThan(0)
      expect(subtask.priority).toBeDefined()
      expect(subtask.order).toBeGreaterThanOrEqual(0)
      expect(subtask.rationale).toBeDefined()
    })

    it('should set first subtask as high priority', () => {
      const result = engine.decomposeTask('Test task', 'Description')
      expect(result.subtasks[0].priority).toBe('high')
    })

    it('should set last subtask as medium priority', () => {
      const result = engine.decomposeTask('Test task', 'Description')
      const lastIndex = result.subtasks.length - 1
      expect(result.subtasks[lastIndex].priority).toBe('medium')
    })

    it('should respect maxSubtasks config', () => {
      const customEngine = new TaskDecompositionEngine({ maxSubtasks: 2 })
      const result = customEngine.decomposeTask('Test task', 'Description')
      expect(result.subtasks.length).toBeLessThanOrEqual(2)
    })

    it('should respect minTaskDuration config', () => {
      const customEngine = new TaskDecompositionEngine({ minTaskDuration: 50 })
      const result = customEngine.decomposeTask('Test task', 'Description')
      result.subtasks.forEach(subtask => {
        expect(subtask.estimatedMinutes).toBeGreaterThanOrEqual(50)
      })
    })

    it('should adjust estimates for small task size', () => {
      const result = engine.decomposeTask('Test task', 'Description', {
        preferredTaskSize: 'small',
        energyLevel: 'high'
      })
      // With small tasks and high energy, estimates should be reduced
      expect(result.totalEstimatedMinutes).toBeGreaterThan(0)
    })

    it('should adjust estimates for large task size', () => {
      const result = engine.decomposeTask('Test task', 'Description', {
        preferredTaskSize: 'large'
      })
      expect(result.totalEstimatedMinutes).toBeGreaterThan(0)
    })
  })

  describe('Dependency calculation', () => {
    it('should calculate dependencies between subtasks', () => {
      const result = engine.decomposeTask('Test task', 'Description')
      expect(result.dependencies).toBeDefined()

      // At least one subtask (not the first) should have a dependency
      const depKeys = Object.keys(result.dependencies)
      expect(depKeys.length).toBeGreaterThan(0)
    })

    it('should not create dependencies for first subtask', () => {
      const result = engine.decomposeTask('Test task', 'Description')
      expect(result.dependencies[0]).toBeUndefined()
    })
  })

  describe('Suggested order', () => {
    it('should return a valid topological ordering', () => {
      const result = engine.decomposeTask('Test task', 'Description')
      expect(result.suggestedOrder.length).toBe(result.subtasks.length)

      // All indices should be present
      const uniqueIndices = new Set(result.suggestedOrder)
      expect(uniqueIndices.size).toBe(result.subtasks.length)
    })

    it('should respect dependencies in ordering', () => {
      const result = engine.decomposeTask('Test task', 'Description')

      // For each dependency, the dependency should come before the dependent
      result.suggestedOrder.forEach((taskIndex, position) => {
        const deps = result.dependencies[taskIndex] || []
        deps.forEach(depIndex => {
          expect(result.suggestedOrder.indexOf(depIndex)).toBeLessThan(position)
        })
      })
    })
  })

  describe('Custom patterns', () => {
    it('should allow adding custom patterns', () => {
      engine.addCustomPattern('coding', {
        keywords: ['code'],
        template: [
          { name: 'Write code', estimate: 60, rationale: 'Implement solution' },
          { name: 'Test code', estimate: 30, rationale: 'Verify implementation' },
        ]
      })

      const result = engine.decomposeTask('Code the solution', 'Write some code')
      const subtaskNames = result.subtasks.map(s => s.name)
      expect(subtaskNames.some(n => n.includes('code') || n.includes('Code'))).toBe(true)
    })
  })

  describe('Singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(taskDecompositionEngine).toBeDefined()
      expect(taskDecompositionEngine.decomposeTask).toBeDefined()
    })
  })

  describe('Configuration', () => {
    it('should use default config when no config provided', () => {
      const result = engine.decomposeTask('Test', 'Description')
      expect(result.subtasks.length).toBeLessThanOrEqual(10) // default maxSubtasks
    })

    it('should use default config values', () => {
      const customEngine = new TaskDecompositionEngine({
        maxDepth: 5,
        minTaskDuration: 20,
        maxSubtasks: 8,
        includeEstimates: false,
        includeDependencies: false
      })
      const result = customEngine.decomposeTask('Test task', 'Description')
      expect(result.dependencies).toEqual({}) // No dependencies when config disables them
    })
  })

  describe('Subtask name customization', () => {
    it('should customize subtask names for meetings', () => {
      const result = engine.decomposeTask('Meeting with team', 'Prepare for the meeting')
      const subtaskNames = result.subtasks.map(s => s.name)
      expect(subtaskNames.some(n => n.toLowerCase().includes('meeting'))).toBe(true)
    })

    it('should customize subtask names for features', () => {
      const result = engine.decomposeTask('Feature implementation', 'Build a new feature')
      const subtaskNames = result.subtasks.map(s => s.name)
      expect(subtaskNames.some(n => n.toLowerCase().includes('feature'))).toBe(true)
    })

    it('should customize subtask names for research', () => {
      const result = engine.decomposeTask('Research project', 'Investigate research topics')
      const subtaskNames = result.subtasks.map(s => s.name)
      expect(subtaskNames.some(n => n.toLowerCase().includes('research'))).toBe(true)
    })
  })
})
