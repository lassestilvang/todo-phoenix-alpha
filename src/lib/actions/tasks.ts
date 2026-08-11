import { taskOperations } from '@/lib/db/tasks';
import { auditLogger, AuditAction, AuditLogData } from '@/lib/audit-logger';

export const enhancedTaskOperations = {
  ...taskOperations,

  create: (data: { taskFormData: any; userId?: string }) => {
    const result = taskOperations.create(data.taskFormData);

    // Audit log
    auditLogger.log({
      action: 'task_created',
      tableName: 'tasks',
      recordId: result.id,
      newValues: { name: result.name, list_id: result.list_id, priority: result.priority, is_recurring: result.is_recurring },
      userId: data.userId
    });

    return result;
  },

  update: (id: number, updates: Partial<any>, userId?: string) => {
    const currentTask = taskOperations.getById(id);
    if (!currentTask) throw new Error('Task not found');

    // Audit current state before update
    const oldValues = {
      name: currentTask.name,
      description: currentTask.description,
      priority: currentTask.priority,
      is_completed: currentTask.is_completed,
      is_recurring: currentTask.is_recurring,
      deadline: currentTask.deadline
    };

    const result = taskOperations.update(id, updates);

    // Audit log the change
    auditLogger.log({
      action: 'task_updated',
      tableName: 'tasks',
      recordId: id,
      oldValues,
      newValues: {
        name: result?.name,
        description: result?.description,
        priority: result?.priority,
        is_completed: result?.is_completed,
        is_recurring: result?.is_recurring,
        deadline: result?.deadline
      },
      userId: userId
    });

    return result;
  },

  delete: (id: number, userId?: string) => {
    const task = taskOperations.getById(id);
    if (!task) throw new Error('Task not found');

    // Audit log before deletion
    auditLogger.log({
      action: 'task_deleted',
      tableName: 'tasks',
      recordId: id,
      oldValues: { name: task.name, priority: task.priority, is_completed: task.is_completed },
      userId: userId
    });

    // Also log change history entry
    auditLogger.log({
      action: 'task_updated',
      tableName: 'tasks',
      recordId: id,
      oldValues: { name: task.name, priority: task.priority, is_completed: task.is_completed, deleted: true },
      newValues: {},
      userId: userId
    });

    taskOperations.delete(id);
    return task;
  },

  toggleComplete: (id: number, userId?: string) => {
    const task = taskOperations.toggleComplete(id);
    auditLogger.log({
      action: 'task_completed',
      tableName: 'tasks',
      recordId: id,
      newValues: { is_completed: task.is_completed, elapsed_minutes: task.actual_minutes },
      userId: userId
    });
    return task;
  },

  // Audit log integration for other operations
  logTaskChange: (taskId: number, field: string, oldValue: unknown, newValue: unknown, userId?: string) => {
    auditLogger.log({
      action: 'task_updated',
      tableName: 'tasks',
      recordId: taskId,
      oldValues: { [field]: oldValue },
      newValues: { [field]: newValue },
      userId: userId
    });
  }
};