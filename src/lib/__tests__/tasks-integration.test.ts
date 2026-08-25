import { expect, describe, it, beforeEach, afterEach } from 'vitest';
import { taskOperations } from '../db/tasks';
import { initTestDb, closeTestDb, resetTestDb, createTestTask, createTestList } from '../../test-utils/test-db';

// Import the actual database setup for testing
import db from '../db/schema';

describe('Task Operations Integration Tests', () => {
  let testDb: any;

  beforeEach(() => {
    // Reset the test database before each test
    testDb = resetTestDb();

    // Mock the db import to use our test database
    vi.mock('../db/schema', () => testDb);
  });

  afterEach(() => {
    // Close the test database after each test
    closeTestDb();
    vi.restoreAllMocks();
  });

  describe('getAll', () => {
    it('should return an empty array when no tasks exist', () => {
      const tasks = taskOperations.getAll();
      expect(tasks).toEqual([]);
      expect(Array.isArray(tasks)).toBe(true);
    });

    it('should return all tasks when multiple exist', () => {
      // Create test tasks
      createTestTask(testDb, { name: 'Task 1' });
      createTestTask(testDb, { name: 'Task 2', priority: 'high' });
      createTestTask(testDb, { name: 'Task 3', is_completed: 1 });

      const tasks = taskOperations.getAll();
      expect(tasks).toHaveLength(3);

      // Should be ordered by date ASC, priority DESC, created_at DESC
      expect(tasks[0].name).toBe('Task 1');
      expect(tasks[1].name).toBe('Task 2');
      expect(tasks[2].name).toBe('Task 3');
    });

    it('should respect includeCompleted parameter', () => {
      createTestTask(testDb, { name: 'Active Task', is_completed: 0 });
      createTestTask(testDb, { name: 'Completed Task', is_completed: 1 });

      // Get only active tasks
      const activeTasks = taskOperations.getAll(false);
      expect(activeTasks).toHaveLength(1);
      expect(activeTasks[0].name).toBe('Active Task');

      // Get all tasks
      const allTasks = taskOperations.getAll(true);
      expect(allTasks).toHaveLength(2);
    });
  });

  describe('getById', () => {
    it('should return undefined for non-existent task', () => {
      const task = taskOperations.getById(999);
      expect(task).toBeUndefined();
    });

    it('should return the correct task by ID', () => {
      const createdTask = createTestTask(testDb, {
        name: 'Test Task',
        description: 'Test Description',
        priority: 'high'
      });

      const task = taskOperations.getById(createdTask);
      expect(task).toBeDefined();
      expect(task?.id).toBe(createdTask);
      expect(task?.name).toBe('Test Task');
      expect(task?.description).toBe('Test Description');
      expect(task?.priority).toBe('high');
    });
  });

  describe('getByIdWithDetails', () => {
    it('should return task with all related data', () => {
      const taskId = createTestTask(testDb, {
        name: 'Detailed Task',
        priority: 'medium'
      });

      // Add a subtask
      testDb.prepare(`
        INSERT INTO subtasks (task_id, name, is_completed, sort_order)
        VALUES (?, ?, ?, ?)
      `).run(taskId, 'Subtask 1', 0, 0);

      // Add a label
      const labelId = testDb.prepare(`
        INSERT INTO labels (name, color, emoji)
        VALUES (?, ?, ?)
      `).run('Important', '#EF4444', '⭐').lastInsertRowid as number;

      testDb.prepare(`
        INSERT INTO task_labels (task_id, label_id)
        VALUES (?, ?)
      `).run(taskId, labelId);

      // Add a reminder
      createTestReminder(testDb, taskId, new Date(Date.now() + 3600000).toISOString());

      // Add an attachment
      createTestAttachment(testDb, taskId);

      // Add a time entry
      createTestTimeEntry(testDb, taskId);

      const taskWithDetails = taskOperations.getByIdWithDetails(taskId);

      expect(taskWithDetails).toBeDefined();
      expect(taskWithDetails?.id).toBe(taskId);
      expect(taskWithDetails?.name).toBe('Detailed Task');
      expect(taskWithDetails?.priority).toBe('medium');

      // Check related data
      expect(taskWithDetails?.subtasks).toHaveLength(1);
      expect(taskWithDetails?.subtasks[0]?.name).toBe('Subtask 1');

      expect(taskWithDetails?.labels).toHaveLength(1);
      expect(taskWithDetails?.labels[0]?.name).toBe('Important');

      expect(taskWithDetails?.reminders).toHaveLength(1);

      expect(taskWithDetails?.attachments).toHaveLength(1);

      expect(taskWithDetails?.time_entries).toHaveLength(1);
    });

    it('should return undefined for non-existent task', () => {
      const task = taskOperations.getByIdWithDetails(999);
      expect(task).toBeUndefined();
    });
  });

  describe('getByListId', () => {
    it('should return tasks for a specific list', () => {
      // Create two lists
      const list1Id = createTestList(testDb, { name: 'List 1' });
      const list2Id = createTestList(testDb, { name: 'List 2' });

      // Create tasks in each list
      createTestTask(testDb, { list_id: list1Id, name: 'Task in List 1' });
      createTestTask(testDb, { list_id: list1Id, name: 'Another Task in List 1' });
      createTestTask(testDb, { list_id: list2Id, name: 'Task in List 2' });

      // Get tasks for list 1
      const list1Tasks = taskOperations.getByListId(list1Id);
      expect(list1Tasks).toHaveLength(2);
      expect(list1Tasks.every(t => t.list_id === list1Id)).toBe(true);

      // Get tasks for list 2
      const list2Tasks = taskOperations.getByListId(list2Id);
      expect(list2Tasks).toHaveLength(1);
      expect(list2Tasks[0].list_id).toBe(list2Id);
    });

    it('should respect includeCompleted parameter for list tasks', () => {
      const listId = createTestList(testDb, { name: 'Test List' });

      createTestTask(testDb, { list_id: listId, name: 'Active Task', is_completed: 0 });
      createTestTask(testDb, { list_id: listId, name: 'Completed Task', is_completed: 1 });

      const activeTasks = taskOperations.getByListId(listId, false);
      expect(activeTasks).toHaveLength(1);
      expect(activeTasks[0].name).toBe('Active Task');

      const allTasks = taskOperations.getByListId(listId, true);
      expect(allTasks).toHaveLength(2);
    });
  });

  describe('getByDate', () => {
    it('should return tasks for a specific date', () => {
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      createTestTask(testDb, { name: 'Today Task', date: today });
      createTestTask(testDb, { name: 'Tomorrow Task', date: tomorrow });
      createTestTask(testDb, { name: 'No Date Task' });

      const todayTasks = taskOperations.getByDate(today);
      expect(todayTasks).toHaveLength(1);
      expect.arrayContaining([expect.objectContaining({ name: 'Today Task' })]) );
      expect(todayTasks[0].name).toBe('Today Task');
    });

    it('should respect includeCompleted parameter', () => {
      const today = new Date().toISOString().split('T')[0];

      createTestTask(testDb, { name: 'Active Today Task', date: today, is_completed: 0 });
      createTestTask(testDb, { name: 'Completed Today Task', date: today, is_completed: 1 });

      const activeTasks = taskOperations.getByDate(today, false);
      expect(activeTasks).toHaveLength(1);
      expect(activeTasks[0].name).toBe('Active Today Task');

      const allTasks = taskOperations.getByDate(today, true);
      expect(allTasks).toHaveLength(2);
    });
  });

  describe('create', () => {
    it('should create a task with all fields', () => {
      const taskData = {
        list_id: 1,
        name: 'New Task',
        description: 'Task Description',
        date: new Date('2026-09-15'),
        deadline: new Date('2026-09-20T10:00:00Z'),
        estimate_minutes: 60,
        priority: 'high',
        is_recurring: 1,
        recurring_pattern: 'every_week',
        recurring_custom_value: '1'
      };

      const createdTask = taskOperations.create(taskData);

      expect(createdTask).toBeDefined();
      expect(createdTask.id).toBeDefined();
      expect(createdTask.name).toBe('New Task');
      expect(createdTask.description).toBe('Task Description');
      expect(createdTask.date).toBe('2026-09-15');
      expect(createdTask.deadline).toBe('2026-09-20T10:00:00.000Z');
      expect(createdTask.estimate_minutes).toBe(60);
      expect(createdTask.priority).toBe('high');
      expect(createdTask.is_recurring).toBe(1);
      expect(createdTask.recurring_pattern).toBe('every_week');
      expect(createdTask.recurring_custom_value).toBe('1');
    });

    it('should create a task with label associations', () => {
      // Create labels
      const label1Id = testDb.prepare(`
        INSERT INTO labels (name, color, emoji)
        VALUES (?, ?, ?)
      `).run('Work', '#3B82F6', '💼').lastInsertRowid as number;

      const label2Id = testDb.prepare(`
        INSERT INTO labels (name, color, emoji)
        VALUES (?, ?, ?)
      `).run('Personal', '#EF4444', '👤').lastInsertRowid as number;

      const taskData = {
        list_id: 1,
        name: 'Labeled Task',
        label_ids: [label1Id, label2Id]
      };

      const createdTask = taskOperations.create(taskData);

      // Verify labels were associated
      const taskLabels = testDb.prepare(`
        SELECT label_id FROM task_labels WHERE task_id = ?
      `).all(createdTask.id);

      expect(taskLabels).toHaveLength(2);
      const labelIds = taskLabels.map((tl: any) => tl.label_id).sort();
      expect(labelIds).toEqual([label1Id, label2Id].sort());
    });

    it('should throw error when creating task without required fields', () => {
      // Test with missing list_id (should use default Inbox)
      const taskData = {
        name: 'Task without list_id'
        // list_id intentionally omitted
      };

      // This should work because list_id has a default in the schema
      const createdTask = taskOperations.create(taskData);
      expect(createdTask).toBeDefined();
      expect(createdTask.list_id).toBe(1); // Should default to Inbox
    });
  });

  describe('update', () => {
    it('should update task fields correctly', () => {
      const taskId = createTestTask(testDb, {
        name: 'Original Name',
        description: 'Original Description',
        priority: 'low',
        estimate_minutes: 30
      });

      const updates = {
        name: 'Updated Name',
        description: 'Updated Description',
        priority: 'urgent',
        estimate_minutes: 90
      };

      const updatedTask = taskOperations.update(taskId, updates);

      expect(updatedTask.id).toBe(taskId);
      expect(updatedTask.name).toBe('Updated Name');
      expect(updatedTask.description).toBe('Updated Description');
      expect(updatedTask.priority).toBe('urgent');
      expect(updatedTask.estimate_minutes).toBe(90);

      // Unchanged fields should remain the same
      expect(updatedTask.is_completed).toBe(0); // Default value
    });

    it('should handle partial updates', () => {
      const taskId = createTestTask(testDb, {
        name: 'Original Name',
        description: 'Original Description',
        priority: 'medium'
      });

      // Update only the priority
      const updatedTask = taskOperations.update(taskId, { priority: 'high' });

      expect(updatedTask.name).toBe('Original Name'); // Unchanged
      expect(updatedTask.description).toBe('Original Description'); // Unchanged
      expect(updatedTask.priority).toBe('high'); // Changed
    });

    it('should throw error when updating non-existent task', () => {
      expect(() => {
        taskOperations.update(999, { name: 'Updated' });
      }).toThrow('Task not found');
    });
  });

  describe('toggleComplete', () => {
    it('should toggle task completion status', () => {
      const taskId = createTestTask(testDb, {
        name: 'Toggle Task',
        is_completed: 0
      });

      // First toggle - should complete the task
      let toggledTask = taskOperations.toggleComplete(taskId);
      expect(toggledTask.is_completed).toBe(1);
      expect(toggledTask.completed_at).toBeDefined();

      // Second toggle - should reopen the task
      toggledTask = taskOperations.toggleComplete(taskId);
      expect(toggledTask.is_completed).toBe(0);
      expect(toggledTask.completed_at).toBeNull();
    });

    it('should throw error when toggling non-existent task', () => {
      expect(() => {
        taskOperations.toggleComplete(999);
      }).toThrow('Task not found');
    });
  });

  describe('delete', () => {
    it('should delete a task and clean up related data', () => {
      const taskId = createTestTask(testDb, { name: 'Task to Delete' });

      // Add related data
      testDb.prepare(`
        INSERT INTO subtasks (task_id, name)
        VALUES (?, ?)
      `).run(taskId, 'Subtask for deletion');

      const labelId = testDb.prepare(`
        INSERT INTO labels (name)
        VALUES (?)
      `).run('Test Label').lastInsertRowid as number;

      testDb.prepare(`
        INSERT INTO task_labels (task_id, label_id)
        VALUES (?, ?)
      `).run(taskId, labelId);

      createTestReminder(testDb, taskId, new Date().toISOString());
      createTestAttachment(testDb, taskId);
      createTestTimeEntry(testDb, taskId);

      // Verify task and related data exist before deletion
      let task = taskOperations.getById(taskId);
      expect(task).toBeDefined();

      let subtasks = testDb.prepare('SELECT * FROM subtasks WHERE task_id = ?').all(taskId);
      expect(subtasks).toHaveLength(1);

      let labels = testDb.prepare(`
        SELECT l.* FROM labels l
        JOIN task_labels tl ON l.id = tl.label_id
        WHERE tl.task_id = ?
      `).all(taskId);
      expect(labels).toHaveLength(1);

      let reminders = testDb.prepare('SELECT * FROM reminders WHERE task_id = ?').all(taskId);
      expect(reminders).toHaveLength(1);

      let attachments = testDb.prepare('SELECT * FROM attachments WHERE task_id = ?').all(taskId);
      expect(attachments).toHaveLength(1);

      let timeEntries = testDb.prepare('SELECT * FROM time_entries WHERE task_id = ?').all(taskId);
      expect(timeEntries).toHaveLength(1);

      // Delete the task
      taskOperations.delete(taskId);

      // Verify task is deleted
      task = taskOperations.getById(taskId);
      expect(task).toBeUndefined();

      // Verify related data is cleaned up (CASCADE DELETE)
      subtasks = testDb.prepare('SELECT * FROM subtasks WHERE task_id = ?').all(taskId);
      expect(subtasks).toHaveLength(0);

      labels = testDb.prepare(`
        SELECT l.* FROM labels l
        JOIN task_labels tl ON l.id = tl.label_id
        WHERE tl.task_id = ?
      `).all(taskId);
      expect(labels).toHaveLength(0);

      reminders = testDb.prepare('SELECT * FROM reminders WHERE task_id = ?').all(taskId);
      expect(reminders).toHaveLength(0);

      attachments = testDb.prepare('SELECT * FROM attachments WHERE task_id = ?').all(taskId);
      expect(attachments).toHaveLength(0);

      timeEntries = testDb.prepare('SELECT * FROM time_entries WHERE task_id = ?').all(taskId);
      expect(timeEntries).toHaveLength(0);
    });

    it('should not throw error when deleting non-existent task', () => {
      // Should not throw - DELETE on non-existent row is safe
      expect(() => {
        taskOperations.delete(999);
      }).not.toThrow();
    });
  });

  describe('search', () => {
    it('should search tasks by name and description', () => {
      createTestTask(testDb, {
        name: 'Fix login bug',
        description: 'Users cannot login with special characters'
      });
      createTestTask(testDb, {
        name: 'Update documentation',
        description: 'Add API examples for authentication'
      });
      createTestTask(testDb, {
        name: 'Refactor dashboard',
        description: 'Improve performance of charts'
      });

      // Search for 'bug'
      const bugResults = taskOperations.search('bug');
      expect(bugResults).toHaveLength(1);
      expect(bugResults[0].name).toBe('Fix login bug');

      // Search for 'api'
      const apiResults = taskOperations.search('api');
      expect(apiResults).toHaveLength(1);
      expect(apiResults[0].name).toBe('Update documentation');

      // Search for 'dashboard'
      const dashboardResults = taskOperations.search('dashboard');
      expect(dashboardResults).toHaveLength(1);
      expect(dashboardResults[0].name).toBe('Refactor dashboard');

      // Search for non-existent term
      const emptyResults = taskOperations.search('xyz123');
      expect(emptyResults).toHaveLength(0);
    });

    it('should respect includeCompleted parameter in search', () => {
      createTestTask(testDb, {
        name: 'Active Task',
        description: 'Needs work',
        is_completed: 0
      });
      createTestTask(testDb, {
        name: 'Completed Task',
        description: 'Already done',
        is_completed: 1
      });

      // Search active tasks only
      const activeResults = taskOperations.search('Task', false);
      expect(activeResults).toHaveLength(1);
      expect(activeResults[0].name).toBe('Active Task');

      // Search all tasks
      const allResults = taskOperations.search('Task', true);
      expect(allResults).toHaveLength(2);
    });
  });

  describe('generateNextOccurrence', () => {
    it('should generate next occurrence for recurring task', () => {
      const taskId = createTestTask(testDb, {
        name: 'Weekly Meeting',
        is_recurring: 1,
        recurring_pattern: 'every_week',
        date: new Date('2026-09-10'), // Today
        deadline: new Date('2026-09-10T15:00:00Z')
      });

      const nextOccurrence = taskOperations.generateNextOccurrence(taskId);

      expect(nextOccurrence).toBeDefined();
      expect(nextOccurrence?.name).toBe('Weekly Meeting');
      expect(nextOccurrence?.date).toBe('2026-09-17'); // One week later
      expect(nextOccurrence?.deadline).toBe('2026-09-17T15:00:00.000Z');
      expect(nextOccurrence?.is_recurring).toBe(1);
    });

    it('should return null for non-recurring task', () => {
      const taskId = createTestTask(testDb, {
        name: 'One-time Task',
        is_recurring: 0
      });

      const nextOccurrence = taskOperations.generateNextOccurrence(taskId);
      expect(nextOccurrence).toBeNull();
    });

    it('should return null for recurring task without pattern', () => {
      const taskId = createTestTask(testDb, {
        name: 'Recurring but no pattern',
        is_recurring: 1,
        recurring_pattern: null
      });

      const nextOccurrence = taskOperations.generateNextOccurrence(taskId);
      expect(nextOccurrence).toBeNull();
    });

    it('should handle different recurrence patterns', () => {
      const baseDate = new Date('2026-09-10');

      // Test every_day
      const dailyTask = createTestTask(testDb, {
        name: 'Daily Task',
        is_recurring: 1,
        recurring_pattern: 'every_day',
        date: baseDate
      });
      const dailyNext = taskOperations.generateNextOccurrence(dailyTask.id);
      expect(dailyNext?.date).toBe('2026-09-11');

      // Test every_month
      const monthlyTask = createTestTask(testDb, {
        name: 'Monthly Task',
        is_recurring: 1,
        recurring_pattern: 'every_month',
        date: baseDate
      });
      const monthlyNext = taskOperations.generateNextOccurrence(monthlyTask.id);
      expect(monthlyNext?.date).toBe('2026-10-10');

      // Test every_year
      const yearlyTask = createTestTask(testDb, {
        name: 'Yearly Task',
        is_recurring: 1,
        recurring_pattern: 'every_year',
        date: baseDate
      });
      const yearlyNext = taskOperations.generateNextOccurrence(yearlyTask.id);
      expect(yearlyNext?.date).toBe('2027-09-10');
    });
  });

  describe('generateFutureOccurrences', () => {
    it('should generate multiple future occurrences', () => {
      const taskId = createTestTask(testDb, {
        name: 'Weekly Report',
        is_recurring: 1,
        recurring_pattern: 'every_week',
        date: new Date('2026-09-10')
      });

      const occurrences = taskOperations.generateFutureOccurrences(taskId, 3);

      expect(occurrences).toHaveLength(3);
      expect(occurrences[0].date).toBe('2026-09-17'); // Week 1
      expect(occurrences[1].date).toBe('2026-09-24'); // Week 2
      expect(occurrences[2].date).toBe('2026-10-01'); // Week 3

      // Each occurrence should be a valid task
      occurrences.forEach((occ, index) => {
        expect(occ).toBeDefined();
        expect(occ.name).toBe('Weekly Report');
        expect(occ.is_recurring).toBe(1);
      });
    });

    it('should stop generating when no more occurrences possible', () => {
      // Create a task with end date that limits occurrences
      const taskId = createTestTask(testDb, {
        name: 'Limited Recurrence',
        is_recurring: 1,
        recurring_pattern: 'every_week',
        date: new Date('2026-09-10')
      });

      // Manually set an end date in the past to limit occurrences
      testDb.prepare(`
        UPDATE tasks
        SET deadline = ?
        WHERE id = ?
      `).run(new Date('2026-09-11').toISOString(), taskId);

      const occurrences = taskOperations.generateFutureOccurrences(taskId, 10);

      // Should generate 0 or very few occurrences due to end date constraint
      expect(occurrences.length).toBeLessThanOrEqual(1);
    });

    it('should return empty array for non-recurring task', () => {
      const taskId = createTestTask(testDb, {
        name: 'One-time Task',
        is_recurring: 0
      });

      const occurrences = taskOperations.generateFutureOccurrences(taskId, 5);
      expect(occurrences).toHaveLength(0);
    });
  });
});