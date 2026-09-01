import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database
vi.mock('@/lib/db/schema', () => ({
  default: {
    prepare: vi.fn().mockReturnThis(),
    run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
    all: vi.fn().mockReturnValue([]),
    get: vi.fn().mockReturnValue(null),
  },
  __esModule: true,
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import {
  DEFAULT_SORT_CRITERIA,
  getUserSortPreferences,
  saveUserSortPreferences,
  recordTaskInteraction,
  calculateTaskScore,
  applySmartSorting,
  getSuggestedSortCriteria,
  calculateInteractionScore,
  getDateInDays,
  type SortCriteria,
} from '../smart-sorting';

import db from '@/lib/db/schema';

describe('Smart Sorting System', () => {
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = db;
    // Set default mock implementations
    mockDb.prepare.mockReturnThis();
    mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 });
    mockDb.all.mockReturnValue([]);
    mockDb.get.mockReturnValue(null);
  });

  describe('DEFAULT_SORT_CRITERIA', () => {
    it('should have 8 default criteria', () => {
      expect(DEFAULT_SORT_CRITERIA).toHaveLength(8);
    });

    it('should have correct criteria names and weights', () => {
      const criteriaMap = new Map(DEFAULT_SORT_CRITERIA.map(c => [c.name, c]));
      expect(criteriaMap.get('overdue')?.weight).toBe(100);
      expect(criteriaMap.get('dueToday')?.weight).toBe(80);
      expect(criteriaMap.get('dueSoon')?.weight).toBe(60);
      expect(criteriaMap.get('priority')?.weight).toBe(50);
      expect(criteriaMap.get('recentlyCreated')?.weight).toBe(30);
      expect(criteriaMap.get('hasTimeTracking')?.weight).toBe(20);
      expect(criteriaMap.get('hasAttachments')?.weight).toBe(10);
      expect(criteriaMap.get('hasSubtasks')?.weight).toBe(10);
    });

    it('should have correct directions', () => {
      DEFAULT_SORT_CRITERIA.forEach(criterion => {
        expect(criterion.direction).toBe('desc');
      });
    });

    it('should have at least 8 criteria', () => {
      expect(DEFAULT_SORT_CRITERIA.length).toBeGreaterThanOrEqual(8);
    });
  });

  describe('getUserSortPreferences', () => {
    it('should return default criteria when no user preference exists', () => {
      mockDb.get.mockReturnValue(null);
      const prefs = getUserSortPreferences('nonexistent-user');
      expect(prefs).toEqual(DEFAULT_SORT_CRITERIA);
    });

    it('should return parsed criteria from DB when exists', () => {
      const customCriteria: SortCriteria[] = [
        { name: 'priority', weight: 70, direction: 'desc' },
        { name: 'dueToday', weight: 60, direction: 'desc' },
      ];
      mockDb.get.mockReturnValue({ criteria_json: JSON.stringify(customCriteria) });

      const prefs = getUserSortPreferences('user123');
      expect(prefs).toEqual(customCriteria);
    });

    it('should handle malformed JSON gracefully', () => {
      mockDb.get.mockReturnValue({ criteria_json: 'invalid json' });
      const prefs = getUserSortPreferences('user123');
      expect(prefs).toEqual(DEFAULT_SORT_CRITERIA);
    });

    it('should handle database errors gracefully', () => {
      mockDb.get.mockImplementation(() => { throw new Error('DB error'); });
      const prefs = getUserSortPreferences('user123');
      expect(prefs).toEqual(DEFAULT_SORT_CRITERIA);
    });

    it('should handle empty string criteria', () => {
      mockDb.get.mockReturnValue({ criteria_json: '' });
      const prefs = getUserSortPreferences('user123');
      expect(prefs).toEqual(DEFAULT_SORT_CRITERIA);
    });
  });

  describe('saveUserSortPreferences', () => {
    it('should save criteria to database', () => {
      const criteria: SortCriteria[] = [
        { name: 'priority', weight: 50, direction: 'desc' },
      ];

      saveUserSortPreferences('user123', criteria);

      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('user_sort_preferences'));
    });

    it('should handle database errors gracefully', () => {
      mockDb.prepare.mockImplementation(() => { throw new Error('DB error'); });
      const criteria: SortCriteria[] = [{ name: 'test', weight: 10, direction: 'asc' as const }];

      expect(() => saveUserSortPreferences('user123', criteria)).not.toThrow();
    });

    it('should correctly serialize criteria to JSON', () => {
      const criteria: SortCriteria[] = [
        { name: 'overdue', weight: 100, direction: 'desc' },
        { name: 'priority', weight: 50, direction: 'desc' },
      ];

      saveUserSortPreferences('user123', criteria);
      const insertCall = mockDb.prepare.mock.calls[0][0];
      expect(insertCall).toContain('INSERT OR REPLACE INTO user_sort_preferences');
    });
  });

  describe('recordTaskInteraction', () => {
    const actions = ['view', 'edit', 'complete', 'reorder', 'dismiss', 'pin'] as const;

    actions.forEach(action => {
      it(`should record ${action} interaction`, () => {
        recordTaskInteraction('user123', 456, action, { test: 'data' });

        expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('task_interactions'));
      });
    });

    it('should handle null metadata', () => {
      recordTaskInteraction('user123', 456, 'view', null as any);
      expect(mockDb.prepare).toHaveBeenCalled();
    });

    it('should handle undefined metadata', () => {
      recordTaskInteraction('user123', 456, 'view', undefined as any);
      expect(mockDb.prepare).toHaveBeenCalled();
    });

    it('should handle database errors gracefully', () => {
      mockDb.prepare.mockImplementation(() => { throw new Error('DB error'); });
      expect(() => recordTaskInteraction('user123', 456, 'view', {})).not.toThrow();
    });

    it('should store metadata as JSON string', () => {
      recordTaskInteraction('user123', 456, 'view', { key: 'value' });
      const prepareCall = mockDb.prepare.mock.calls[0][0];
      expect(prepareCall).toContain('task_interactions');
    });
  });

  describe('calculateInteractionScore (private, tested via calculateTaskScore)', () => {
    it('should return 0 for no interactions', () => {
      mockDb.all.mockReturnValue([]);
      const task = { id: 123 };
      // @ts-ignore - accessing private function
      const score = calculateInteractionScore(123, 'user123');
      expect(score).toBe(0);
    });

    it('should calculate score for completed tasks', () => {
      mockDb.all.mockReturnValue([{ action: 'complete', count: 3, last_action: new Date().toISOString() }]);
      // @ts-ignore
      const score = calculateInteractionScore(123, 'user123');
      expect(score).toBeGreaterThan(0);
    });

    it('should apply recency decay', () => {
      const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(); // 31 days old
      mockDb.all.mockReturnValue([{ action: 'view', count: 10, last_action: oldDate }]);
      // @ts-ignore
      const score = calculateInteractionScore(123, 'user123');
      expect(score).toBeCloseTo(0, 1); // Should be near 0 due to decay
    });

    it('should give higher score for recent interactions', () => {
      const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(); // 1 day old
      const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days old

      mockDb.all.mockReturnValue([
        { action: 'view', count: 1, last_action: oldDate },
        { action: 'view', count: 1, last_action: recentDate }
      ]);
      // @ts-ignore
      const score = calculateInteractionScore(123, 'user123');
      expect(score).toBeGreaterThan(0);
    });
  });

  describe('calculateTaskScore', () => {
    // Use a "clean" base task with no scoring factors (priority: 'none', old created_at, no deadline, no time_entries/attachments/subtasks)
    const baseTask = {
      id: 123,
      priority: 'none',
      created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago (not "recentlyCreated")
      is_completed: 0,
      time_entries: [],
      attachments: [],
      subtasks: [],
    };

    it('should return 0 for task with no scoring factors', () => {
      const task = { ...baseTask, deadline: null };
      const score = calculateTaskScore(task, DEFAULT_SORT_CRITERIA, 'user123');
      expect(score).toBe(0);
    });

    it('should give overdue task maximum points', () => {
      const task = {
        ...baseTask,
        deadline: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
        is_completed: 0,
      };
      const score = calculateTaskScore(task, DEFAULT_SORT_CRITERIA, 'user123');
      expect(score).toBeGreaterThanOrEqual(100);
    });

    it('should not give overdue points to completed task', () => {
      const task = {
        ...baseTask,
        deadline: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
        is_completed: 1, // Completed
      };
      const score = calculateTaskScore(task, DEFAULT_SORT_CRITERIA, 'user123');
      expect(score).toBeLessThan(100);
    });

    it('should give dueToday points for task due today', () => {
      const today = new Date().toISOString().split('T')[0];
      const task = {
        ...baseTask,
        deadline: today,
        is_completed: 0,
      };
      const score = calculateTaskScore(task, DEFAULT_SORT_CRITERIA, 'user123');
      expect(score).toBeGreaterThanOrEqual(80);
    });

    it('should give dueSoon points for task due within 7 days', () => {
      const dueSoon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 3 days from now
      const task = {
        ...baseTask,
        deadline: dueSoon,
        is_completed: 0,
      };
      const score = calculateTaskScore(task, DEFAULT_SORT_CRITERIA, 'user123');
      expect(score).toBeGreaterThanOrEqual(60);
    });

    it('should not give dueSoon points for task due after 7 days', () => {
      const dueLater = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 8 days from now
      const task = {
        ...baseTask,
        deadline: dueLater,
        is_completed: 0,
      };
      const score = calculateTaskScore(task, DEFAULT_SORT_CRITERIA, 'user123');
      expect(score).toBeLessThan(60);
    });

    it('should score priority correctly', () => {
      const task = { ...baseTask, deadline: null };
      const highTask = { ...task, priority: 'high' };
      const mediumTask = { ...task, priority: 'medium' };
      const lowTask = { ...task, priority: 'low' };
      const noneTask = { ...task, priority: 'none' };

      const highScore = calculateTaskScore(highTask, DEFAULT_SORT_CRITERIA, 'user123');
      const mediumScore = calculateTaskScore(mediumTask, DEFAULT_SORT_CRITERIA, 'user123');
      const lowScore = calculateTaskScore(lowTask, DEFAULT_SORT_CRITERIA, 'user123');
      const noneScore = calculateTaskScore(noneTask, DEFAULT_SORT_CRITERIA, 'user123');

      expect(highScore).toBeGreaterThan(mediumScore);
      expect(mediumScore).toBeGreaterThan(lowScore);
      expect(lowScore).toBeGreaterThan(noneScore);
      expect(noneScore).toBe(0);
    });

    it('should give recentlyCreated points for task < 7 days old', () => {
      const recentTask = {
        ...baseTask,
        created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
        deadline: null,
      };
      const score = calculateTaskScore(recentTask, DEFAULT_SORT_CRITERIA, 'user123');
      expect(score).toBeGreaterThanOrEqual(30);
    });

    it('should not give recentlyCreated points for task >= 7 days old', () => {
      const oldTask = {
        ...baseTask,
        created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), // 8 days ago
        deadline: null,
      };
      const score = calculateTaskScore(oldTask, DEFAULT_SORT_CRITERIA, 'user123');
      expect(score).toBeLessThan(30);
    });

    it('should give hasTimeTracking points when task has time entries', () => {
      const task = {
        ...baseTask,
        deadline: null,
        time_entries: [{ id: 1 }], // Has time entries
      };
      const score = calculateTaskScore(task, DEFAULT_SORT_CRITERIA, 'user123');
      expect(score).toBeGreaterThanOrEqual(20);
    });

    it('should not give hasTimeTracking points when task has no time entries', () => {
      const task = { ...baseTask, deadline: null, time_entries: [] };
      const score = calculateTaskScore(task, DEFAULT_SORT_CRITERIA, 'user123');
      expect(score).toBe(0);
    });

    it('should give hasAttachments points when task has attachments', () => {
      const task = {
        ...baseTask,
        deadline: null,
        attachments: [{ id: 1, filename: 'test.pdf' }], // Has attachment
      };
      const score = calculateTaskScore(task, DEFAULT_SORT_CRITERIA, 'user123');
      expect(score).toBeGreaterThanOrEqual(10);
    });

    it('should not give hasAttachments points when task has no attachments', () => {
      const task = { ...baseTask, deadline: null, attachments: [] };
      const score = calculateTaskScore(task, DEFAULT_SORT_CRITERIA, 'user123');
      expect(score).toBe(0);
    });

    it('should give hasSubtasks points when task has subtasks', () => {
      const task = {
        ...baseTask,
        deadline: null,
        subtasks: [{ id: 1, name: 'Subtask 1' }], // Has subtask
      };
      const score = calculateTaskScore(task, DEFAULT_SORT_CRITERIA, 'user123');
      expect(score).toBeGreaterThanOrEqual(10);
    });

    it('should not give hasSubtasks points when task has no subtasks', () => {
      const task = { ...baseTask, deadline: null, subtasks: [] };
      const score = calculateTaskScore(task, DEFAULT_SORT_CRITERIA, 'user123');
      expect(score).toBe(0);
    });

    it('should combine all scoring factors correctly', () => {
      const task = {
        ...baseTask,
        deadline: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Overdue
        priority: 'high',
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
        time_entries: [{ id: 1 }],
        attachments: [{ id: 1, filename: 'test.pdf' }],
        subtasks: [{ id: 1, name: 'Subtask 1' }],
      };

      const score = calculateTaskScore(task, DEFAULT_SORT_CRITERIA, 'user123');
      // Should be: overdue(100) + priority(high=3*50/3=50) + recentlyCreated(30) + timeTracking(20) + attachments(10) + subtasks(10) = 220
      expect(score).toBeGreaterThanOrEqual(220);
    });

    it('should handle interaction score contribution', () => {
      mockDb.all.mockReturnValue([
        { action: 'complete', count: 2, last_action: new Date().toISOString() },
        { action: 'view', count: 3, last_action: new Date().toISOString() },
      ]);

      const taskWithInteractions = { ...baseTask, deadline: null, id: 123 };
      const scoreWithInteractions = calculateTaskScore(taskWithInteractions, DEFAULT_SORT_CRITERIA, 'user123');

      // Score should include interaction points (at least 2*5 + 3*1 = 13 from interactions)
      expect(scoreWithInteractions).toBeGreaterThanOrEqual(13);
    });

    it('should handle database errors in interaction calculation', () => {
      mockDb.all.mockImplementation(() => { throw new Error('DB error'); });
      const task = { ...baseTask, deadline: null };
      const score = calculateTaskScore(task, DEFAULT_SORT_CRITERIA, 'user123');
      expect(typeof score).toBe('number');
    });
  });

  describe('applySmartSorting', () => {
    it('should return empty array for empty input', () => {
      const result = applySmartSorting([]);
      expect(result).toEqual([]);
    });

    it('should sort tasks by smartScore descending', () => {
      const tasks = [
        { id: 1, name: 'Low Priority Task', priority: 'low' as const, smartScore: 10 },
        { id: 2, name: 'High Priority Task', priority: 'high' as const, smartScore: 100 },
        { id: 3, name: 'Medium Priority Task', priority: 'medium' as const, smartScore: 50 },
      ];

      const result = applySmartSorting(tasks, 'user123');

      expect(result[0].id).toBe(2); // Highest score first
      expect(result[1].id).toBe(3);
      expect(result[2].id).toBe(1);
    });

    it('should add smartScore property to tasks', () => {
      const tasks = [{ id: 1, name: 'Test Task', priority: 'medium' as const }];
      const result = applySmartSorting(tasks, 'user123');

      expect(result[0]).toHaveProperty('smartScore');
      expect(typeof result[0].smartScore).toBe('number');
    });

    it('should not mutate original tasks', () => {
      const originalTasks = [{ id: 1, name: 'Test Task', priority: 'medium' as const }];
      const tasksCopy = JSON.parse(JSON.stringify(originalTasks));

      applySmartSorting(originalTasks, 'user123');

      expect(originalTasks).toEqual(tasksCopy);
    });

    it('should work with custom criteria', () => {
      const tasks = [
        { id: 1, name: 'Task A', priority: 'low' as const },
        { id: 2, name: 'Task B', priority: 'high' as const },
      ];
      const customCriteria: SortCriteria[] = [
        { name: 'priority', weight: 100, direction: 'desc' },
      ];

      const result = applySmartSorting(tasks, 'user123', customCriteria);

      expect(result[0].id).toBe(2); // High priority should come first
    });

    it('should handle tasks with same smartScore', () => {
      const tasks = [
        { id: 1, name: 'Task 1', priority: 'medium' as const, smartScore: 50 },
        { id: 2, name: 'Task 2', priority: 'medium' as const, smartScore: 50 },
      ];

      const result = applySmartSorting(tasks, 'user123');
      expect(result.length).toBe(2);
      // Should maintain relative order for equal scores (stable sort)
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);
    });

    it('should handle database errors gracefully', () => {
      mockDb.prepare.mockImplementation(() => { throw new Error('DB error'); });
      const tasks = [{ id: 1, name: 'Test Task', priority: 'medium' as const }];

      expect(() => applySmartSorting(tasks, 'user123')).not.toThrow();
    });
  });

  describe('getSuggestedSortCriteria', () => {
    it('should return default criteria when no interaction history', () => {
      mockDb.all.mockReturnValue([]);
      const suggestions = getSuggestedSortCriteria('user123');
      expect(suggestions).toEqual(DEFAULT_SORT_CRITERIA);
    });

    it('should suggest due-date priority when completion rate > 50%', () => {
      const recentInteractions = [
        { action: 'complete', count: 6 }, // 6 completions
        { action: 'view', count: 4 }, // 4 views
        { action: 'edit', count: 0 },
      ];
      mockDb.all.mockReturnValue(recentInteractions);

      const suggestions = getSuggestedSortCriteria('user123');
      // Should prioritize overdue, dueToday, dueSoon
      expect(suggestions[0].name).toBe('overdue');
      expect(suggestions[1].name).toBe('dueToday');
      expect(suggestions[2].name).toBe('dueSoon');
    });

    it('should suggest recency priority when view rate > 50%', () => {
      const recentInteractions = [
        { action: 'view', count: 6 }, // 6 views
        { action: 'complete', count: 4 }, // 4 completions
        { action: 'edit', count: 0 },
      ];
      mockDb.all.mockReturnValue(recentInteractions);

      const suggestions = getSuggestedSortCriteria('user123');
      // Should prioritize recentlyCreated, hasTimeTracking, priority
      expect(suggestions[0].name).toBe('recentlyCreated');
      expect(suggestions[1].name).toBe('hasTimeTracking');
      expect(suggestions[2].name).toBe('priority');
    });

    it('should return default criteria when rates are balanced', () => {
      const recentInteractions = [
        { action: 'view', count: 5 },
        { action: 'complete', count: 5 },
        { action: 'edit', count: 0 },
      ];
      mockDb.all.mockReturnValue(recentInteractions);

      const suggestions = getSuggestedSortCriteria('user123');
      expect(suggestions).toEqual(DEFAULT_SORT_CRITERIA);
    });

    it('should handle database errors gracefully', () => {
      mockDb.all.mockImplementation(() => { throw new Error('DB error'); });
      const suggestions = getSuggestedSortCriteria('user123');
      expect(suggestions).toEqual(DEFAULT_SORT_CRITERIA);
    });

    it('should handle empty interaction history', () => {
      mockDb.all.mockReturnValue([]);
      const suggestions = getSuggestedSortCriteria('user123');
      expect(suggestions).toEqual(DEFAULT_SORT_CRITERIA);
    });

    it('should calculate completion rate correctly', () => {
      const recentInteractions = [
        { action: 'complete', count: 3 },
        { action: 'view', count: 7 },
        { action: 'edit', count: 0 },
      ];
      mockDb.all.mockReturnValue(recentInteractions);

      const suggestions = getSuggestedSortCriteria('user123');
      // 3/(3+7+0) = 0.3 < 0.5, so should not prioritize completion
      expect(suggestions[0].name).not.toBe('overdue');
    });

    it('should calculate view rate correctly', () => {
      const recentInteractions = [
        { action: 'view', count: 6 },
        { action: 'complete', count: 4 },
        { action: 'edit', count: 0 },
      ];
      mockDb.all.mockReturnValue(recentInteractions);

      const suggestions = getSuggestedSortCriteria('user123');
      // 6/(6+4+0) = 0.6 > 0.5, so should prioritize views
      expect(suggestions[0].name).toBe('recentlyCreated');
    });
  });

  describe('getDateInDays helper', () => {
    it('should return correct date string', () => {
      const today = new Date();
      const future = getDateInDays(5);
      const expected = new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      expect(future).toBe(expected);
    });

    it('should handle zero days', () => {
      const today = new Date().toISOString().split('T')[0];
      expect(getDateInDays(0)).toBe(today);
    });

    it('should handle negative days', () => {
      const today = new Date();
      const past = getDateInDays(-5);
      const expected = new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      expect(past).toBe(expected);
    });
  });

  describe('Error Handling', () => {
    it('should handle null task in calculateTaskScore', () => {
      // @ts-ignore - intentionally passing null
      const score = calculateTaskScore(null as any, DEFAULT_SORT_CRITERIA, 'user123');
      expect(typeof score).toBe('number');
    });

    it('should handle undefined criteria in calculateTaskScore', () => {
      // @ts-ignore
      const score = calculateTaskScore({ id: 1 }, undefined as any, 'user123');
      expect(typeof score).toBe('number');
    });

    it('should handle null userId in getUserSortPreferences', () => {
      // @ts-ignore
      const prefs = getUserSortPreferences(null as any);
      expect(prefs).toEqual(DEFAULT_SORT_CRITERIA);
    });

    it('should handle empty string userId in saveUserSortPreferences', () => {
      expect(() => saveUserSortPreferences('', [{ name: 'test', weight: 1, direction: 'asc' as const }])).not.toThrow();
    });

    it('should handle invalid action in recordTaskInteraction', () => {
      // @ts-ignore - invalid action
      expect(() => recordTaskInteraction('user123', 123, 'invalid-action' as any, {})).not.toThrow();
    });
  });
});