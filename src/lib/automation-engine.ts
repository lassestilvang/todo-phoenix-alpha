import db from './db/schema';

/**
 * Intelligent Automation Engine for Todo Phoenix Alpha
 */

export interface AutomationTrigger {
  id: string;
  name: string;
  type: 'task-created' | 'task-updated' | 'task-completed' | 'deadline-approaching' |
        'recurring-start' | 'time-tracking-start' | 'time-tracking-stop' |
        'user-presence' | 'time-of-day' | 'schedule' | 'custom';
  config: {
    [key: string]: any;
  };
  isActive: boolean;
  createdAt: string;
}

export interface AutomationAction {
  id: string;
  name: string;
  type: 'create-task' | 'update-task' | 'add-label' | 'remove-label' |
        'assign-user' | 'send-notification' | 'send-email' | 'calendar-event' |
        'webhook' | 'custom';
  config: {
    [key: string]: any;
  };
  isEnabled: boolean;
}

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  trigger: AutomationTrigger;
  conditions?: AutomationCondition[];
  actions: AutomationAction[];
  isActive: boolean;
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  createdBy: string;
}

export interface AutomationCondition {
  field: string;
  operator: 'equals' | 'not-equals' | 'greater-than' | 'less-than' | 'contains' |
          'not-contains' | 'matches' | 'not-matches';
  value: any;
}

export interface AutomationHistory {
  id: number;
  ruleId: string;
  triggerEvent: string;
  executedAt: string;
  status: 'success' | 'failed' | 'pending';
  executedActions: number;
  output?: any;
  errorMessage?: string;
}

export interface AutomationTemplate {
  id: string;
  name: string;
  description: string;
  triggerType: AutomationTrigger['type'];
  defaultConfig: any;
  exampleAction: AutomationAction;
  category: 'task' | 'notification' | 'calendar' | 'integration' | 'custom';
  isPublic: boolean;
}

/**
 * Default automation templates
 */
export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    id: 'create-tasks-from-meeting',
    name: 'Tasks from Meeting',
    description: 'Automatically create tasks from meeting action items',
    triggerType: 'task-created',
    defaultConfig: {
      meetingId: null,
      actionItemField: 'taskName'
    },
    exampleAction: {
      id: 'auto-create',
      name: 'Create task',
      type: 'create-task',
      config: {
        title: 'Meeting action item: {{taskName}}',
        description: 'From meeting {{meetingTitle}}',
        priority: 'medium',
        estimateMinutes: 30
      }
    },
    category: 'task',
    isPublic: true
  },
  {
    id: 'due-date-reminder',
    name: 'Due Date Reminder',
    description: 'Send reminder before task deadline',
    triggerType: 'task-updated',
    defaultConfig: {
      daysBefore: 1,
      includeSubtasks: false
    },
    exampleAction: {
      id: 'send-reminder',
      name: 'Send notification',
      type: 'send-notification',
      config: {
        message: 'Task due soon: {{taskName}}',
        recipients: 'assigned-user'
      }
    },
    category: 'notification',
    isPublic: true
  },
  {
    id: 'weekly-review',
    name: 'Weekly Review',
    description: 'Generate weekly review summary and set goals',
    triggerType: 'schedule',
    defaultConfig: {
      dayOfWeek: 'monday',
      timeOfDay: 9,
      includeCompleted: true,
      includeOverdue: true
    },
    exampleAction: {
      id: 'generate-summary',
      name: 'Send weekly summary',
      type: 'send-notification',
      config: {
        message: 'Weekly Review: Progress summary and upcoming tasks',
        recipients: 'user'
      }
    },
    category: 'task',
    isPublic: true
  },
  {
    id: 'deadline-alert',
    name: 'Deadline Alert',
    description: 'Alert when task deadline is approaching',
    triggerType: 'deadline-approaching',
    defaultConfig: {
      daysBefore: 2,
      includeAllTasks: true
    },
    exampleAction: {
      id: 'alert-user',
      name: 'Send alert',
      type: 'send-notification',
      config: {
        message: '⚠️ Task deadline approaching: {{taskName}} due in {{days}} days',
        recipients: 'task-assignee'
      }
    },
    category: 'notification',
    isPublic: true
  }
];

/**
 * Create an automation rule
 */
export function createAutomationRule(rule: Omit<AutomationRule, 'id' | 'createdAt'>): AutomationRule {
  const result = db.prepare(
    `INSERT INTO automation_rules (
      name, description, trigger_json, conditions_json, actions_json,
      is_active, priority, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
  ).run(
    rule.name,
    rule.description,
    JSON.stringify(rule.trigger),
    rule.conditions ? JSON.stringify(rule.conditions) : '[]',
    JSON.stringify(rule.actions),
    rule.isActive ? 1 : 0,
    rule.priority,
    rule.createdBy
  );

  return {
    ...rule,
    id: result.lastInsertRowid as string,
    createdAt: new Date().toISOString()
  };
}

/**
 * Execute an automation rule
 */
export function executeAutomationRule(ruleId: string, triggerEvent: string, eventData?: any): AutomationHistory[] {
  const rule = db.prepare('SELECT * FROM automation_rules WHERE id = ?').get(ruleId) as AutomationRule | undefined;
  if (!rule || !rule.isActive) return [];

  const executedActions: { action: AutomationAction; result: any }[] = [];
  const history: AutomationHistory[] = [];

  // Evaluate conditions
  let conditionsMet = true;
  if (rule.conditions && rule.conditions.length > 0) {
    conditionsMet = rule.conditions.every(condition => {
      // Get the value from the event data
      const value = extractValueFromEvent(eventData, condition.field);
      return evaluateConditionOperator(condition.operator, value, condition.value);
    });
  }

  if (!conditionsMet) return history;

  // Execute each action
  for (const action of rule.actions) {
    const result = executeAutomationAction(action, eventData);
    executedActions.push({ action, result });

    // Create history entry
    const historyEntry: AutomationHistory = {
      id: Date.now(),
      ruleId,
      triggerEvent,
      executedAt: new Date().toISOString(),
      status: result.success ? 'success' : 'failed',
      executedActions: executedActions.length,
      output: result.success ? result.output : undefined,
      errorMessage: result.success ? undefined : result.errorMessage
    };

    history.push(historyEntry);

    // Stop on failure if configured
    if (!result.success && rule.actions.length > 0) {
      break;
    }
  }

  return history;
}

/**
 * Extract a value from event data using a dot-notation field path
 */
function extractValueFromEvent(eventData: any, fieldPath: string): any {
  const parts = fieldPath.split('.');
  let current = eventData;

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Evaluate a condition operator against a value
 */
function evaluateConditionOperator(operator: string, actual: any, expected: any): boolean {
  switch (operator) {
    case 'equals': return String(actual) === String(expected);
    case 'not-equals': return String(actual) !== String(expected);
    case 'greater-than': return Number(actual) > Number(expected);
    case 'less-than': return Number(actual) < Number(expected);
    case 'contains': return String(actual).includes(String(expected));
    case 'not-contains': return !String(actual).includes(String(expected));
    case 'matches': return new RegExp(expected).test(String(actual));
    case 'not-matches': return !new RegExp(expected).test(String(actual));
    default: return true;
  }
}

/**
 * Execute a single automation action
 */
function executeAutomationAction(action: AutomationAction, eventData?: any): { success: boolean; output?: any; errorMessage?: string } {
  try {
    switch (action.type) {
      case 'create-task': {
        const config = action.config as any;
        // In a real implementation, this would call the task creation API
        return {
          success: true,
          output: { taskId: Date.now(), message: `Task "${config.title}" created` }
        };
      }
      case 'update-task': {
        const config = action.config as any;
        return { success: true, output: { message: `Task updated: ${config.field}` } };
      }
      case 'add-label': {
        const config = action.config as any;
        return { success: true, output: { message: `Label "${config.labelName}" added` } };
      }
      case 'remove-label': {
        const config = action.config as any;
        return { success: true, output: { message: `Label "${config.labelName}" removed` } };
      }
      case 'assign-user': {
        const config = action.config as any;
        return { success: true, output: { message: `Task assigned to ${config.userId}` } };
      }
      case 'send-notification': {
        const config = action.config as any;
        return { success: true, output: { message: `Notification sent: ${config.message}` } };
      }
      case 'send-email': {
        const config = action.config as any;
        return { success: true, output: { message: `Email sent to ${config.recipients}` } };
      }
      case 'calendar-event': {
        const config = action.config as any;
        return { success: true, output: { message: `Calendar event created` } };
      }
      case 'webhook': {
        const config = action.config as any;
        // In a real implementation, this would make an HTTP request
        return { success: true, output: { message: `Webhook executed: ${config.url}` } };
      }
      case 'custom': {
        const config = action.config as any;
        return { success: true, output: { message: `Custom action executed` } };
      }
      default:
        return { success: false, errorMessage: `Unknown action type: ${action.type}` };
    }
  } catch (error) {
    return { success: false, errorMessage: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Get automation rules
 */
export function getAutomationRules(isActiveOnly = true): AutomationRule[] {
  const query = isActiveOnly
    ? 'SELECT * FROM automation_rules WHERE is_active = 1 ORDER BY priority DESC, created_at DESC'
    : 'SELECT * FROM automation_rules ORDER BY priority DESC, created_at DESC';

  return db.prepare(query).all() as AutomationRule[];
}

/**
 * Update automation rule status
 */
export function updateAutomationRuleStatus(ruleId: string, isActive: boolean): AutomationRule | undefined {
  const rule = db.prepare('SELECT * FROM automation_rules WHERE id = ?').get(ruleId) as AutomationRule | undefined;
  if (!rule) return undefined;

  db.prepare(
    'UPDATE automation_rules SET is_active = ? WHERE id = ?'
  ).run(isActive ? 1 : 0, ruleId);

  return { ...rule, isActive };
}

/**
 * Delete automation rule
 */
export function deleteAutomationRule(ruleId: string): boolean {
  const result = db.prepare('DELETE FROM automation_rules WHERE id = ?').run(ruleId);
  return result.changes > 0;
}

/**
 * Get automation history
 */
export function getAutomationHistory(ruleId?: string, limit = 50): AutomationHistory[] {
  const query = ruleId
    ? 'SELECT * FROM automation_history WHERE rule_id = ? ORDER BY executed_at DESC LIMIT ?'
    : 'SELECT * FROM automation_history ORDER BY executed_at DESC LIMIT ?';

  return db.prepare(query).all(ruleId || '', limit) as AutomationHistory[];
}

/**
 * Add automation history
 */
export function addAutomationHistory(history: Omit<AutomationHistory, 'id'>): AutomationHistory {
  const result = db.prepare(
    `INSERT INTO automation_history (
      rule_id, trigger_event, executed_at, status, executed_actions, output, error_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    history.ruleId,
    history.triggerEvent,
    history.executedAt,
    history.status,
    history.executedActions,
    history.output || null,
    history.errorMessage || null
  );

  return {
    ...history,
    id: result.lastInsertRowid as number
  };
}

/**
 * Initialize automation database
 */
const initAutomationDatabase = () => {
  if (typeof window === 'undefined') {
    try {
      const Database = require('better-sqlite3');
      const dbPath = require('path').join(process.cwd(), 'data', 'planner.db');
      const dbInstance = new Database(dbPath);

      dbInstance.exec(
        `CREATE TABLE IF NOT EXISTS automation_rules (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          trigger_json TEXT NOT NULL,
          conditions_json TEXT DEFAULT '[]',
          actions_json TEXT NOT NULL,
          is_active INTEGER DEFAULT 1,
          priority TEXT DEFAULT 'medium',
          created_by TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      );

      dbInstance.exec(
        `CREATE TABLE IF NOT EXISTS automation_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          rule_id TEXT NOT NULL,
          trigger_event TEXT NOT NULL,
          executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          status TEXT DEFAULT 'pending',
          executed_actions INTEGER DEFAULT 0,
          output TEXT,
          error_message TEXT
        )`
      );

      dbInstance.exec('CREATE INDEX IF NOT EXISTS idx_rules_active ON automation_rules(is_active)');
      dbInstance.exec('CREATE INDEX IF NOT EXISTS idx_rules_created ON automation_rules(created_at)');
      dbInstance.exec('CREATE INDEX IF NOT EXISTS idx_history_rule ON automation_history(rule_id)');
      dbInstance.exec('CREATE INDEX IF NOT EXISTS idx_history_executed ON automation_history(executed_at)');

      console.log('Automation database tables created successfully');
    } catch (error) {
      console.warn('Failed to initialize automation database:', error);
    }
  }
};

initAutomationDatabase();

export { AUTOMATION_TEMPLATES, AutomationTrigger, AutomationAction, AutomationRule, AutomationCondition, AutomationHistory, AutomationTemplate };