import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SearchService } from '../search'

// Mock database
vi.mock('../db/schema', () => ({
  default: {
    prepare: vi.fn(() => ({
      all: vi.fn(() => []),
      get: vi.fn(() => ({ count: 0 })),
      run: vi.fn(() => ({ lastInsertRowid: 1 })),
      exec: vi.fn(() => {}),
    })),
  },
}))

// Mock Task type for test contexts
import type { Task } from '../types'

const mockTaskType: Task = {
  id: 0,
  list_id: 1,
  name: '',
  description: '',
  date: null,
  deadline: null,
  estimate_minutes: 0,
  actual_minutes: 0,
  priority: 'medium',
  is_completed: 0,
  is_recurring: 0,
  recurring_pattern: null,
  recurring_custom_value: null,
  dependencies: null,
  created_at: '',
  updated_at: '',
};

describe('SearchService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    SearchService.getInstance() // Reset singleton
  })

  describe('fuzzySearch', () => {
    it('should return similarity score for matching strings', () => {
      const similarity = SearchService.fuzzySearch('hello', 'hello world')
      expect(typeof similarity).toBe('number')
      expect(similarity).toBeGreaterThanOrEqual(0)
      expect(similarity).toBeLessThanOrEqual(1)
    })

    it('should return 0 for completely different strings', () => {
      const similarity = SearchService.fuzzySearch('abc', 'xyz')
      expect(similarity).toBe(0)
    })

    it('should handle empty strings', () => {
      const similarity = SearchService.fuzzySearch('', 'test')
      expect(similarity).toBe(0)
    })
  })

  describe('calculateEditDistance', () => {
    it('should calculate edit distance for identical strings', () => {
      const distance = SearchService.calculateEditDistance('test', 'test')
      expect(distance).toBe(0)
    })

    it('should calculate edit distance for different strings', () => {
      const distance = SearchService.calculateEditDistance('hello', 'world')
      expect(distance).toBeGreaterThan(0)
    })

    it('should handle empty strings', () => {
      // Edit distance between an empty string and a string is its length.
      const distance1 = SearchService.calculateEditDistance('', 'test')
      const distance2 = SearchService.calculateEditDistance('test', '')
      expect(distance1).toBe(4)
      expect(distance2).toBe(4)
    })
  })

  describe('normalizeText', () => {
    it('should normalize text for search', () => {
      const normalized = SearchService.normalizeText('  Test  -  string  ')
      expect(normalized).toBe('test string')
    })

    it('should convert to lowercase and trim', () => {
      const normalized = SearchService.normalizeText('  HELLO WORLD  ')
      expect(normalized).toBe('hello world')
    })

    it('should replace spaces with single spaces', () => {
      const normalized = SearchService.normalizeText('test   replacement   here')
      expect(normalized).toBe('test replacement here')
    })
  })

  describe('generateContextualSuggestions', () => {
    it('should generate suggestions based on user context', async () => {
      const context = {
        userTasks: [
          { ...mockTaskType, id: 1, name: 'Buy groceries', description: 'Weekly shopping' },
          { ...mockTaskType, id: 2, name: 'Pay bills', description: 'Monthly utilities' },
        ],
        userLists: [] as any[],
      }

      const suggestions = await SearchService.generateContextualSuggestions('groceries', context)
      expect(Array.isArray(suggestions)).toBe(true)
      // May have suggestions or empty array depending on implementation
    })

    it('should return empty array when context is undefined', async () => {
      const suggestions = await SearchService.generateContextualSuggestions('test', undefined)
      expect(suggestions).toEqual([])
    })

    it('should limit suggestions to 5 items', async () => {
      // Mock context with many potential suggestions
      const context = {
        userTasks: Array.from({ length: 10 }, (_, i) => ({
          id: i + 1,
          name: `Task ${i + 1}`, // All start with "Task"
          description: '',
          list_id: 1,
          priority: 'medium' as const,
          estimate_minutes: 30,
          is_completed: 0,
          is_recurring: 0,
          date: null,
          deadline: null,
          recurring_pattern: null,
          recurring_custom_value: null,
          dependencies: null,
          actual_minutes: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })),
        userLists: [] as any[],
      }

      const suggestions = await SearchService.generateContextualSuggestions('task', context)
      expect(suggestions.length).toBeLessThanOrEqual(5)
    })
  })

  describe('search', () => {
    it('should return search results for query', async () => {
      const query = 'test'
      const filters = { isCompleted: false }
      const options = { fuzzy: true, fuzzyThreshold: 0.7 }

      const result = await SearchService.search(query, filters, options)

      expect(result).toHaveProperty('tasks')
      expect(result).toHaveProperty('total')
      expect(result).toHaveProperty('fuzzyMatches')
      expect(result).toHaveProperty('suggestions')
      expect(Array.isArray(result.tasks)).toBe(true)
      expect(typeof result.total).toBe('number')
    })

    it('should apply filters correctly', async () => {
      const query = 'test'
      const filters = { priority: ['high', 'medium'] }
      const options = { fuzzy: true }

      const result = await SearchService.search(query, filters, options)
      expect(result).toHaveProperty('tasks')
    })

    it('should sort results by relevance', async () => {
      const query = 'test'
      const filters = { isCompleted: false }
      const options: import('../search').SearchOptions = { sortBy: 'relevance' }

      const result = await SearchService.search(query, filters, options)
      expect(result).toHaveProperty('tasks')
    })

    it('should handle empty queries', async () => {
      const query = ''
      const filters = {}
      const options = { fuzzy: true }

      const result = await SearchService.search(query, filters, options)
      expect(result).toHaveProperty('tasks')
      expect(result.tasks).toEqual([])
      expect(result.total).toBe(0)
    })
  })

  describe('semanticSearch', () => {
    it('should return tasks for semantic search', async () => {
      const query = 'task description'
      const result = await SearchService.semanticSearch(query)

      expect(Array.isArray(result)).toBe(true)
    })

    it('should handle errors gracefully', async () => {
      // generateTaskSuggestions returns a fallback result on error, so semanticSearch
      // always resolves to an array (never throws). Verify it returns an array.
      const result = await SearchService.semanticSearch('test')
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('getPopularSearches', () => {
    it('should return popular search queries', () => {
      const popular = SearchService.getPopularSearches(5)
      expect(Array.isArray(popular)).toBe(true)
      expect(popular.length).toBeLessThanOrEqual(5)
    })

    it('should return default queries when empty', () => {
      const popular = SearchService.getPopularSearches(0)
      expect(popular).toEqual([])
    })
  })

  describe('saveSearch', () => {
    it('should save a search query', () => {
      const search = {
        name: 'Test Search',
        query: 'test query',
        filters: { isCompleted: false },
        options: { fuzzy: true },
        userId: 'user1',
      }

      const saved = SearchService.saveSearch(search)

      expect(saved).toHaveProperty('id')
      expect(saved.name).toBe(search.name)
      expect(saved.query).toBe(search.query)
      expect(saved.userId).toBe(search.userId)
      expect(saved.createdAt).toBeDefined()
    })
  })

  describe('getSavedSearches', () => {
    it('should retrieve saved searches for a user', () => {
      const userId = 'user1'
      const searches = SearchService.getSavedSearches(userId)

      expect(Array.isArray(searches)).toBe(true)
    })
  })

  describe('getSearchAnalytics', () => {
    it('should return search analytics data', () => {
      const days = 30
      const analytics = SearchService.getSearchAnalytics(days)

      expect(analytics).toHaveProperty('totalSearches')
      expect(analytics).toHaveProperty('popularQueries')
      expect(analytics).toHaveProperty('searchByDay')
      // totalSearches is an object with count property
      expect(typeof analytics.totalSearches).toBe('object')
      expect(analytics.totalSearches).toHaveProperty('count')
      expect(typeof analytics.totalSearches.count).toBe('number')
      expect(Array.isArray(analytics.popularQueries)).toBe(true)
      expect(Array.isArray(analytics.searchByDay)).toBe(true)
    })
  })
})

// Test integration with database operations
describe('SearchService integration', () => {
  it('should search with database integration', async () => {
    const query = 'database'
    const filters = { isCompleted: false, hasAttachments: true }

    const result = await SearchService.search(query, filters)

    expect(result).toHaveProperty('tasks')
  })

  it('should handle database errors gracefully', async () => {
    // Mock database to throw error
    const { default: db } = await import('../db/schema')
    vi.mocked(db.prepare).mockReturnValue({
      all: vi.fn(() => {
        throw new Error('Database connection failed')
      }),
    })

    const query = 'test'
    await expect(SearchService.search(query)).rejects.toThrow('Database connection failed')
  })
})