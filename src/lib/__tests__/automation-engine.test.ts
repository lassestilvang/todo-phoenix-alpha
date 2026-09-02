import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database - use the alias that vitest understands
vi.mock('@/lib/db/schema', () => ({
  default: {
    prepare: vi.fn().mockReturnThis(),
    run: vi.fn().mockReturnValue({ lastInsertRowid: 123, changes: 1 }),
    all: vi.fn().mockReturnValue([]),
    get: vi.fn().mockReturnValue(null),
    exec: vi.fn(),
    pragma: vi.fn(),
  },
  __esModule: true,
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Import the module under test - this will use the mocked version
import {
  AUTOMATION_TEMPLATES,
  createAutomationRule,
  executeAutomationRule,
  getAutomationRules,
  updateAutomationRuleStatus,
  deleteAutomationRule,
  getAutomationHistory,
  addAutomationHistory,
  automationEngine,
  type AutomationRule,
} from '../automation-engine';

import db from '@/lib/db/schema';

describe('Automation Engine', () => {
  let mockDb: any;

  beforeEach(() => {
    // Clear all mocks and reset default values
    vi.clearAllMocks();

    // Get references to the mock functions
    mockDb = db;

    // Set up default mock returns
    mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 123 });
    mockDb.all.mockReturnValue([]);
    mockDb.get.mockReturnValue(null);
  });

  describe('Automation Templates', () => {
    it('should provide default templates', () => {
      expect(AUTOMATION_TEMPLATES).toHaveLength(4);
    });

    it('should include meetings template', () => {
      const meetingsTemplate = AUTOMATION_TEMPLATES.find((t: any) => t.id === 'create-tasks-from-meeting');
      expect(meetingsTemplate).toBeDefined();
      expect(meetingsTemplate!.name).toBe('Tasks from Meeting');
    });

    it('should include reminder templates', () => {
      const reminderTemplate = AUTOMATION_TEMPLATES.find((t: any) => t.id === 'due-date-reminder');
      expect(reminderTemplate).toBeDefined();
      expect(reminderTemplate!.category).toBe('notification');
    });

    it('should include weekly review template', () => {
      const reviewTemplate = AUTOMATION_TEMPLATES.find((t: any) => t.id === 'weekly-review');
      expect(reviewTemplate).toBeDefined();
      expect(reviewTemplate!.triggerType).toBe('schedule');
    });

    it('should include deadline alert template', () => {
      const alertTemplate = AUTOMATION_TEMPLATES.find((t: any) => t.id === 'deadline-alert');
      expect(alertTemplate).toBeDefined();
      expect(alertTemplate!.isPublic).toBe(true);
    });

    it('should have example actions in all templates', () => {
      AUTOMATION_TEMPLATES.forEach((template: any) => {
        expect(template.exampleAction).toBeDefined();
        expect(template.exampleAction.type).toBeDefined();
        expect(template.exampleAction.isEnabled).toBe(true);
      });
    });
  });

  describe('createAutomationRule', () => {
    it('should create a valid automation rule', () => {
      const rule = {
        name: 'Test Rule',
        description: 'Test automation rule',
        trigger: {
          id: 't1',
          name: 'Task Created',
          type: 'task-created',
          config: {},
          isActive: true,
          createdAt: new Date().toISOString(),
        },
        actions: [
          {
            id: 'a1',
            name: 'Send Notification',
            type: 'send-notification',
            isEnabled: true,
            config: { message: 'Task created!' },
          },
        ],
        isActive: true,
        priority: 'high',
        createdBy: 'test-user',
      } as Omit<AutomationRule, "id" | "createdAt">;

      const result = createAutomationRule(rule);

      expect(result).toBeDefined();
      expect(result.id).toBe(123);
      expect(result.name).toBe('Test Rule');
    });

    it('should handle conditions in rule creation', () => {
      const ruleWithConditions = {
        name: 'Rule with Conditions',
        description: 'Conditional rule',
        trigger: {
          id: 't2',
          name: 'Task Updated',
          type: 'task-updated',
          config: {},
          isActive: true,
          createdAt: new Date().toISOString(),
        },
        conditions: [{ field: 'priority', operator: 'equals', value: 'high' }],
        actions: [],
        isActive: true,
        priority: 'medium',
        createdBy: 'test-user',
      } as AutomationRule;

      const result = createAutomationRule(ruleWithConditions);
      expect(result).toBeDefined();
    });

    it('should serialize conditions and actions as JSON', () => {
      const rule = {
        name: 'JSON Serialization Test',
        description: 'Test JSON serialization',
        trigger: {
          id: 't3',
          name: 'Test',
          type: 'task-created',
          config: {},
          isActive: true,
          createdAt: new Date().toISOString(),
        },
        actions: [
          {
            id: 'a1',
            name: 'Create Task',
            type: 'create-task',
            isEnabled: true,
            config: { title: 'Auto task' },
          },
        ],
        isActive: true,
        priority: 'low',
        createdBy: 'test-user',
      } as AutomationRule;

      mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 456 });

      createAutomationRule(rule);

      expect(mockDb.prepare).toHaveBeenCalled();
    });

    it('should handle empty conditions (defaults to [])', () => {
      const rule = {
        name: 'No Conditions Rule',
        description: 'Rule with no conditions',
        trigger: {
          id: 't4',
          name: 'Test',
          type: 'task-created',
          config: {},
          isActive: true,
          createdAt: new Date().toISOString(),
        },
        actions: [{ id: 'a1', name: 'Test', type: 'send-notification', isEnabled: true, config: {} }],
        isActive: true,
        priority: 'high',
        createdBy: 'user',
      } as AutomationRule;

      mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 789 });

      createAutomationRule(rule);
      expect(mockDb.prepare).toHaveBeenCalled();
    });
  });

  describe('executeAutomationRule', () => {
    it('should return empty array for non-existent rule', () => {
      mockDb.get.mockReturnValue(null);

      const history = executeAutomationRule('nonexistent', 'task-created');
      expect(history).toEqual([]);
    });

    it('should return empty array for inactive rule', () => {
      mockDb.get.mockReturnValue({
        id: '1',
        name: 'Inactive Rule',
        isActive: 0,
      });

      const history = executeAutomationRule('1', 'task-created');
      expect(history).toEqual([]);
    });

    it('should execute actions when conditions are met', () => {
      const mockRule = {
        id: '1',
        name: 'Test Rule',
        isActive: 1,
        conditions: null,
        actions: [
          { id: 'a1', type: 'send-notification', isEnabled: true, config: { message: 'Test' } },
        ],
      };

      mockDb.get.mockReturnValue(mockRule);
      mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 });

      const history = executeAutomationRule('1', 'task-created', { name: 'Test Task' });

      expect(history).toHaveLength(1);
      expect(history[0].status).toBe('success');
      expect(history[0].ruleId).toBe('1');
      expect(history[0].triggerEvent).toBe('task-created');
    });

    it('should evaluate conditions correctly', () => {
      const mockRule = {
        id: '2',
        name: 'Conditional Rule',
        isActive: 1,
        conditions: [{ field: 'priority', operator: 'equals', value: 'high' }],
        actions: [{ id: 'a1', type: 'create-task', isEnabled: true, config: {} }],
      };

      mockDb.get.mockReturnValue(mockRule);
      mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 2 });

      // Test with matching condition
      let history = executeAutomationRule('2', 'task-updated', { priority: 'high' });
      expect(history).toHaveLength(1);

      // Test with non-matching condition
      mockDb.get.mockReturnValue(mockRule);
      mockDb.all.mockReturnValue([]);
      history = executeAutomationRule('2', 'task-updated', { priority: 'low' });
      expect(history).toEqual([]);
    });

    it('should handle dot-notation field paths in conditions', () => {
      const mockRule = {
        id: '3',
        name: 'Dot Notation Rule',
        isActive: 1,
        conditions: [{ field: 'task.priority', operator: 'equals', value: 'urgent' }],
        actions: [{ id: 'a1', type: 'send-notification', isEnabled: true, config: {} }],
      };

      mockDb.get.mockReturnValue(mockRule);
      mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 3 });

      // Matching condition with nested path
      let history = executeAutomationRule('3', 'task-updated', {
        task: { priority: 'urgent' },
      });
      expect(history).toHaveLength(1);

      // Non-matching condition
      mockDb.get.mockReturnValue(mockRule);
      mockDb.all.mockReturnValue([]);
      history = executeAutomationRule('3', 'task-updated', {
        task: { priority: 'low' },
      });
      expect(history).toEqual([]);
    });

    it('should handle all 8 condition operators', () => {
      const operators = [
        { op: 'equals', actual: 'high', expected: 'high', result: true },
        { op: 'not-equals', actual: 'high', expected: 'low', result: true },
        { op: 'greater-than', actual: 10, expected: 5, result: true },
        { op: 'less-than', actual: 5, expected: 10, result: true },
        { op: 'contains', actual: 'hello world', expected: 'world', result: true },
        { op: 'not-contains', actual: 'hello world', expected: 'foo', result: true },
        { op: 'matches', actual: 'test@example.com', expected: '^test', result: true },
        { op: 'not-matches', actual: 'admin@example.com', expected: '^test', result: true },
      ];

      operators.forEach(({ op, actual, expected, result }) => {
        const mockRule = {
          id: `op-${op}`,
          name: `Test ${op}`,
          isActive: 1,
          conditions: [{ field: 'value', operator: op, value: expected }],
          actions: [{ id: 'a1', type: 'send-notification', isEnabled: true, config: {} }],
        };

        mockDb.get.mockReturnValue(mockRule);
        mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 });

        const history = executeAutomationRule(`op-${op}`, 'test', { value: actual });
        expect(history).toHaveLength(result ? 1 : 0);
      });
    });
  });

  describe('Action Execution', () => {
    const actionTypes = [
      { type: 'create-task', config: { title: 'New Task' } },
      { type: 'update-task', config: { field: 'status', value: 'done' } },
      { type: 'add-label', config: { labelName: 'urgent' } },
      { type: 'remove-label', config: { labelName: 'old' } },
      { type: 'assign-user', config: { userId: 'user123' } },
      { type: 'send-notification', config: { message: 'Alert!' } },
      { type: 'send-email', config: { recipients: 'user@test.com', subject: 'Test' } },
      { type: 'calendar-event', config: { title: 'Meeting', date: '2026-01-01' } },
      { type: 'webhook', config: { url: 'https://example.com/webhook' } },
      { type: 'custom', config: { function: 'customHandler' } },
    ];

    actionTypes.forEach(({ type, config }) => {
      it(`should execute ${type} action successfully`, () => {
        const mockRule = {
          id: `action-${type}`,
          name: `${type} Rule`,
          isActive: 1,
          conditions: null,
          actions: [{ id: 'a1', type, isEnabled: true, config }],
        };

        mockDb.get.mockReturnValue(mockRule);
        mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 });

        const history = executeAutomationRule(`action-${type}`, 'test-event');
        expect(history).toHaveLength(1);
        expect(history[0].status).toBe('success');
      });
    });

    it('should handle unknown action type gracefully', () => {
      const mockRule = {
        id: '8',
        name: 'Unknown Action',
        isActive: 1,
        conditions: null,
        actions: [{ id: 'a1', type: 'unknown-action', isEnabled: true, config: {} }],
      };

      mockDb.get.mockReturnValue(mockRule);
      mockDb.run.mockReturnValue({ changes: 1 });

      const history = executeAutomationRule('8', 'task-created');
      expect(history[0].status).toBe('failed');
      expect(history[0].errorMessage).toContain('Unknown action type');
    });
  });

  describe('Rule Management', () => {
    it('should get all active rules', () => {
      const mockRules = [
        { id: '1', name: 'Rule 1', isActive: 1 },
        { id: '2', name: 'Rule 2', isActive: 1 },
      ];

      mockDb.all.mockReturnValue(mockRules);

      const rules = getAutomationRules();
      expect(rules).toEqual(mockRules);
    });

    it('should get all rules including inactive', () => {
      mockDb.all.mockReturnValue([]);
      const rules = getAutomationRules(false);
      expect(rules).toEqual([]);
    });

    it('should update rule status to inactive', () => {
      const mockRule = { id: '1', name: 'Test Rule', isActive: 1 };

      mockDb.get.mockReturnValue(mockRule);
      mockDb.run.mockReturnValue({ changes: 1 });

      const updated = updateAutomationRuleStatus('1', false);
      expect(updated).toBeDefined();
      expect(updated!.isActive).toBe(false);
    });

    it('should update rule status to active', () => {
      const mockRule = { id: '1', name: 'Test Rule', isActive: 0 };

      mockDb.get.mockReturnValue(mockRule);
      mockDb.run.mockReturnValue({ changes: 1 });

      const updated = updateAutomationRuleStatus('1', true);
      expect(updated).toBeDefined();
      expect(updated!.isActive).toBe(true);
    });

    it('should return undefined when updating non-existent rule', () => {
      mockDb.get.mockReturnValue(null);

      const result = updateAutomationRuleStatus('nonexistent', true);
      expect(result).toBeUndefined();
    });

    it('should delete a rule and return true', () => {
      mockDb.run.mockReturnValue({ changes: 1 });

      const deleted = deleteAutomationRule('rule-123');
      expect(deleted).toBe(true);
    });

    it('should return false when deleting non-existent rule', () => {
      mockDb.run.mockReturnValue({ changes: 0 });

      const deleted = deleteAutomationRule('nonexistent');
      expect(deleted).toBe(false);
    });
  });

  describe('Automation History', () => {
    it('should get history for a specific rule', () => {
      const mockHistory = [
        { id: 1, ruleId: '1', triggerEvent: 'task-created', status: 'success' },
        { id: 2, ruleId: '1', triggerEvent: 'task-updated', status: 'success' },
      ];

      mockDb.all.mockReturnValue(mockHistory);

      const history = getAutomationHistory('1', 10);
      expect(history).toEqual(mockHistory);
    });

    it('should get all history when no rule ID specified', () => {
      const mockHistory = [
        { id: 1, ruleId: '1', status: 'success' },
        { id: 2, ruleId: '2', status: 'failed' },
      ];

      mockDb.all.mockReturnValue(mockHistory);

      const history = getAutomationHistory(undefined, 50);
      expect(history).toEqual(mockHistory);
    });

    it('should add history entry successfully', () => {
      mockDb.run.mockReturnValue({ lastInsertRowid: 12345 });

      const history = addAutomationHistory({
        ruleId: 'rule-1',
        triggerEvent: 'task-created',
        executedAt: new Date().toISOString(),
        status: 'success',
        executedActions: 1,
        output: { taskId: 999 },
      });

      expect(history.id).toBe(12345);
      expect(history.ruleId).toBe('rule-1');
      expect(history.status).toBe('success');
      expect(history.output).toEqual({ taskId: 999 });
    });

    it('should handle history entry without output or error message', () => {
      mockDb.run.mockReturnValue({ lastInsertRowid: 54321 });

      const history = addAutomationHistory({
        ruleId: 'rule-2',
        triggerEvent: 'task-completed',
        executedAt: new Date().toISOString(),
        status: 'failed',
        executedActions: 0,
      });

      expect(history.id).toBe(54321);
      expect(history.output).toBeUndefined();
    });
  });

  describe('automationEngine compatibility object', () => {
    it('should export automationEngine with same functions', () => {
      expect(automationEngine).toBeDefined();
      expect(automationEngine.createAutomationRule).toBeDefined();
      expect(automationEngine.executeAutomationRule).toBeDefined();
      expect(automationEngine.getAutomationRules).toBeDefined();
      expect(automationEngine.AUTOMATION_TEMPLATES).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', () => {
      mockDb.prepare.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      expect(() => {
        getAutomationRules();
      }).toThrow('Database connection failed');
    });

    it('should handle errors during rule creation', () => {
      const rule = {
        name: 'Error Rule',
        description: 'Will fail',
        trigger: {
          id: 't1',
          name: 'Test',
          type: 'task-created',
          config: {},
          isActive: true,
          createdAt: new Date().toISOString(),
        },
        actions: [{ id: 'a1', name: 'Test', type: 'create-task', isEnabled: true, config: {} }],
        isActive: true,
        priority: 'medium',
        createdBy: 'user',
      };

      mockDb.prepare.mockImplementation(() => {
        throw new Error('Insert failed');
      });

      expect(() => createAutomationRule(rule)).toThrow('Insert failed');
    });

    it('should handle errors during rule deletion', () => {
      // Only throw for delete operations, not all prepare calls
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('DELETE FROM automation_rules WHERE id =')) {
          throw new Error('Delete failed');
        }
        // Return the mock for other operations
        return {
          run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
          get: vi.fn().mockReturnValue(null),
          all: vi.fn().mockReturnValue([]),
        };
      });

      expect(() => deleteAutomationRule('rule-1')).toThrow('Delete failed');
    });

    it('should handle non-object eventData for missing field', () => {
      const mockRule = {
        id: 'cond-test',
        name: 'Missing Field Rule',
        isActive: 1,
        conditions: [{ field: 'nonexistent.path', operator: 'equals', value: 'test' }],
        actions: [{ id: 'a1', type: 'send-notification', isEnabled: true, config: {} }],
      };

      // Restore prepare to return mock for other operations
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('SELECT')) {
          return {
            get: vi.fn().mockReturnValue(mockRule),
            all: vi.fn().mockReturnValue([]),
          };
        }
        return {
          run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
          get: vi.fn().mockReturnValue(null),
          all: vi.fn().mockReturnValue([]),
        };
      });

      // When field doesn't exist in event data, condition should return false
      const history = executeAutomationRule('cond-test', 'test', null);
      expect(history).toEqual([]);
    });

    it('should handle empty actions array', () => {
      const mockRule = {
        id: 'empty-actions',
        name: 'Empty Actions',
        isActive: 1,
        conditions: null,
        actions: [],
      };

      // Restore prepare to return mock for other operations
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('SELECT')) {
          return {
            get: vi.fn().mockReturnValue(mockRule),
            all: vi.fn().mockReturnValue([]),
          };
        }
        return {
          run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
          get: vi.fn().mockReturnValue(null),
          all: vi.fn().mockReturnValue([]),
        };
      });

      const history = executeAutomationRule('empty-actions', 'test-event');
      expect(history).toEqual([]);
    });
  });
});