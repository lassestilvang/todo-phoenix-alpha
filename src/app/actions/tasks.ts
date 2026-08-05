// "use server"

import { revalidatePath } from "next/cache"
import db from "@/lib/db/schema"
import { listOperations, taskOperations, labelOperations, subtaskOperations, timeEntryOperations, reminderOperations, attachmentOperations } from "@/lib/db"
import type { TaskFormData, SubtaskFormData, Task, Reminder } from "@/lib/types"
import { TaskParser } from "@/lib/nlp/task-parser"
import { generateTaskSuggestions, generateInsights } from "@/lib/ai/enhancement"

type ParsedTaskData = Partial<TaskFormData>

// Use enhanced NLP parser
async function parseNaturalLanguage(text: string): Promise<ParsedTaskData> {
  return TaskParser.parse(text);
}

async function getTaskImprovementSuggestions(text: string): Promise<string> {
  return TaskParser.generateEnhancedSuggestions(text);
}

// List actions
export async function getLists() {
  return listOperations.getAll()
}

export async function createList(name: string, color: string, emoji: string, icon: string) {
  const list = listOperations.create(name, color, emoji, icon)
  revalidatePath("/")
  return list
}

export async function updateList(id: number, updates: { name?: string; color?: string; emoji?: string; icon?: string }) {
  const list = listOperations.update(id, updates)
  revalidatePath("/")
  return list
}

export async function deleteList(id: number) {
  listOperations.delete(id)
  revalidatePath("/")
}

// Task actions
export async function getTasks(includeCompleted: boolean = true) {
  return taskOperations.getAll(includeCompleted)
}

export async function getTaskById(id: number) {
  return taskOperations.getByIdWithDetails(id)
}

export async function getTasksByListId(listId: number, includeCompleted: boolean = true) {
  return taskOperations.getByListId(listId, includeCompleted)
}

export async function getTasksByDate(date: string, includeCompleted: boolean = true) {
  return taskOperations.getByDate(date, includeCompleted)
}

export async function getTasksByDateRange(startDate: string, endDate: string, includeCompleted: boolean = true) {
  return taskOperations.getByDateRange(startDate, endDate, includeCompleted)
}

export async function getUpcomingTasks(fromDate: string, includeCompleted: boolean = true) {
  return taskOperations.getUpcoming(fromDate, includeCompleted)
}

export async function getOverdueTasks(currentDate: string) {
  return taskOperations.getOverdue(currentDate)
}

export async function createReminder(taskId: number, reminderTime: Date): Promise<Reminder> {
  const dbReminder = db.prepare(`
    INSERT INTO reminders (task_id, time, is_sent)
    VALUES (?, ?, 0)
  `);

  const result = dbReminder.run(taskId, reminderTime.toISOString());
  const reminderId = result.lastInsertRowid;

  const reminder = db.prepare(`SELECT * FROM reminders WHERE id = ?`).get(reminderId);
  return {
    id: reminder.id,
    taskId: reminder.task_id,
    time: new Date(reminder.time),
    is_sent: reminder.is_sent,
    sent_at: reminder.sent_at,
    created_at: reminder.created_at,
  };
}

export async function getPendingReminders(): Promise<Reminder[]> {
  const now = new Date().toISOString()
  const pendingReminders = db.prepare(`
    SELECT * FROM reminders
    WHERE is_sent = 0 AND time <= ?
  `).all(now);

  return pendingReminders.map(r => ({
    id: r.id,
    taskId: r.task_id,
    time: new Date(r.time),
    is_sent: r.is_sent,
    sent_at: r.sent_at,
    created_at: r.created_at,
  }));
}

export async function markReminderSent(reminderId: number): Promise<void> {
  const result = db.prepare(`
    UPDATE reminders
    SET is_sent = 1, sent_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(reminderId);
  if (result.changes === 0) {
    throw new Error(`Reminder with id ${reminderId} not found`);
  }
}

export async function createRecurringTask(
  taskId: number,
  pattern: string,
  interval: number,
  intervalUnit: 'day' | 'week' | 'month' | 'year',
  startDate: string,
  endDate: string | null,
  excludeDates: string[] = []
): Promise<{ recurringScheduleId: number; taskRunsCreated: number }> {
  // Create recurring schedule
  const dbSchedule = db.prepare(`
    INSERT INTO recurring_schedules (task_id, pattern, interval, interval_unit, start_date, end_date, exclude_dates, next_run)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date();
  const start = new Date(startDate);
  let excludeJson = '[]';
  if (excludeDates.length > 0) {
    excludeJson = JSON.stringify(excludeDates);
  }

  const scheduleResult = dbSchedule.run(
    taskId,
    pattern,
    interval,
    intervalUnit,
    startDate,
    endDate,
    excludeJson,
    start.toISOString()
  );

  const scheduleId = scheduleResult.lastInsertRowid;

  // Create initial task runs for upcoming occurrences
  let taskRunsCreated = 0;
  const createRun = db.prepare(`
    INSERT INTO task_runs (recurring_schedule_id, task_id, scheduled_date, status)
    VALUES (?, ?, ?, 'pending')
  `);

  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  const currentTime = now.getTime();
  const startTime = start.getTime();
  let nextRunDate = new Date(startTime);

  // Generate runs for the next 30 days or until end_date
  const maxDays = endDate ? Math.ceil((new Date(endDate).getTime() - startTime) / oneWeek) : 4;

  for (let i = 0; i <= maxDays; i++) {
    const potentialDate = new Date(startTime + i * 7 * 24 * 60 * 60 * 1000); // weekly for now
    const dateStr = potentialDate.toISOString().split('T')[0];

    // Check if date is in exclude list
    const excluded = JSON.parse(excludeJson).some((d: string) => d === dateStr);
    if (excluded) continue;

    // Check if we've passed the end_date
    if (endDate && new Date(dateStr).getTime() > new Date(endDate).getTime()) break;

    createRun.run(scheduleId, taskId, dateStr);
    taskRunsCreated++;
  }

  return { recurringScheduleId: scheduleId, taskRunsCreated };
}

export async function getRecurringTaskRuns(
  taskId: number,
  includeCompleted: boolean = false
): Promise<Array<{ scheduledDate: string; actualDate: string | null; status: string }>> {
  const rows = db.prepare(`
    SELECT scheduled_date, actual_date, status
    FROM task_runs
    WHERE task_id = ?
    ORDER BY scheduled_date ASC
  `).all(taskId);

  return rows.map(r => ({
    scheduledDate: r.scheduled_date,
    actualDate: r.actual_date ? new Date(r.actual_date).toISOString().split('T')[0] : null,
    status: r.status,
  }));
}

export async function markTaskRunCompleted(
  runId: number,
  actualDate: string
): Promise<void> {
  const result = db.prepare(`
    UPDATE task_runs
    SET actual_date = ?, status = 'completed'
    WHERE id = ?
  `).run(actualDate, runId);

  if (result.changes === 0) {
    throw new Error(`Task run with id ${runId} not found`);
  }
}

export async function getRecurringSchedule(taskId: number) {
  return db.prepare(`
    SELECT * FROM recurring_schedules WHERE task_id = ?
  `).get(taskId);
}

export async function stopTimer(taskId: number): Promise<number> {
  const task = await taskOperations.getByIdWithDetails(taskId);
  const dbTimer = db.prepare(`
    UPDATE time_entries
    SET stopped_at = CURRENT_TIMESTAMP, is_running = 0
    WHERE task_id = ?
  `).run(taskId);
  return dbTimer.lastInsertRowid;
}

export async function getTimerStats(): Promise<Record<string, number>> {
  const rows = await db.prepare(`
    SELECT
      task_id,
      COUNT(*) AS total_entries,
      SUM(CASE WHEN is_running = 1 THEN 1 ELSE 0 END) AS running,
      AVG(CASE WHEN is_running = 1 THEN duration_minutes ELSE 0 END) AS avg_duration
    FROM time_entries
    GROUP BY task_id
  `).all();

  const stats = rows.map(row => ({
    taskId: row.task_id,
    totalEntries: row.total_entries,
    running: row.running,
    avgDuration: row.avg_duration
  }));

  return stats;
}

export async function createTask(data: TaskFormData) {
  const task = taskOperations.create(data)
  revalidatePath("/")
  return task
}

export async function updateTask(id: number, updates: Partial<TaskFormData>) {
  const task = taskOperations.update(id, updates)
  revalidatePath("/")
  return task
}

export async function toggleTaskComplete(id: number) {
  const task = taskOperations.toggleComplete(id)
  revalidatePath("/")
  return task
}

export async function deleteTask(id: number) {
  taskOperations.delete(id)
  revalidatePath("/")
}

export async function searchTasks(query: string, includeCompleted: boolean = true) {
  return taskOperations.search(query, includeCompleted)
}

// Label actions
export async function getLabels() {
  return labelOperations.getAll()
}

export async function createLabel(name: string, color: string, emoji: string) {
  const label = labelOperations.create(name, color, emoji)
  revalidatePath("/")
  return label
}

export async function updateLabel(id: number, updates: { name?: string; color?: string; emoji?: string }) {
  const label = labelOperations.update(id, updates)
  revalidatePath("/")
  return label
}

export async function deleteLabel(id: number) {
  labelOperations.delete(id)
  revalidatePath("/")
}

// Subtask actions
export async function getSubtasks(taskId: number) {
  return subtaskOperations.getAll(taskId)
}

export async function createSubtask(taskId: number, data: SubtaskFormData) {
  const subtask = subtaskOperations.create(taskId, data)
  revalidatePath("/")
  return subtask
}

export async function updateSubtask(id: number, updates: Partial<SubtaskFormData>) {
  const subtask = subtaskOperations.update(id, updates)
  revalidatePath("/")
  return subtask
}

export async function toggleSubtaskComplete(id: number) {
  const subtask = subtaskOperations.toggleComplete(id)
  revalidatePath("/")
  return subtask
}

export async function deleteSubtask(id: number) {
  subtaskOperations.delete(id)
  revalidatePath("/")
}

// Time entry actions
export async function getTimeEntries(taskId: number) {
  return timeEntryOperations.getAll(taskId)
}

export async function startTimeEntry(taskId: number) {
  const timeEntry = timeEntryOperations.create(taskId, new Date())
  revalidatePath("/")
  return timeEntry
}

export async function stopTimeEntry(id: number, stoppedAt: Date, durationMinutes: number) {
  const timeEntry = timeEntryOperations.stop(id, stoppedAt, durationMinutes)
  revalidatePath("/")
  return timeEntry
}

export async function getActiveTimeEntry(taskId: number) {
  return timeEntryOperations.getActiveEntry(taskId)
}

export async function getTotalTimeForTask(taskId: number) {
  return timeEntryOperations.getTotalTimeForTask(taskId)
}

// NEW: Create task from natural language text
export async function createTaskFromNLP(text: string, listId: number): Promise<Task> {
  const parsed = await parseNaturalLanguage(text);
  const taskData: TaskFormData = {
    ...parsed,
    name: parsed.name || 'Untitled Task (enhance)',
    list_id: listId,
  };

  const task = taskOperations.create(taskData);

  // Create reminder if deadline was detected in text
  if (taskOperations.getById(task.id)?.deadline) {
    const taskWithDetails = taskOperations.getByIdWithDetails(task.id);
    if (taskWithDetails?.deadline) {
      try {
        reminderOperations.create(task.id, new Date(taskWithDetails.deadline));
      } catch (e) {
        console.error('Failed to create reminder:', e);
      }
    }
  }

  revalidatePath("/")
  return task
}

// NEW: Add AI-powered suggestions for a task
export async function getTaskSuggestions(taskId: number): Promise<{
  priority: string;
  estimatedMinutes: number;
  relatedTasks: number[];
}> {
  const task = taskOperations.getByIdWithDetails(taskId)
  if (!task) throw new Error('Task not found');

  const suggestions = {
    priority: task.priority,
    estimatedMinutes: task.estimate_minutes,
    relatedTasks: [] as number[],
  };

  if ((task as any).labels && (task as any).labels.length > 0) {
    const allTasks = taskOperations.getAll();
    for (const label of (task as any).labels) {
      const related = allTasks.filter(t =>
        t.id !== task.id &&
        (t as any).labels &&
        (t as any).labels.some((l: any) => l.id === label.id)
      );
      suggestions.relatedTasks.push(...related.map(t => t.id));
    }
    suggestions.relatedTasks = [...new Set(suggestions.relatedTasks)];
  }

  if (task.deadline) {
    const deadline = new Date(task.deadline);
    const now = new Date();
    const diffDays = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

    if (diffDays <= 1 && suggestions.priority !== 'high') {
      suggestions.priority = 'high';
    } else if (diffDays <= 7 && suggestions.priority === 'none') {
      suggestions.priority = 'medium';
    }
  }

  // NEW: Enhance suggestions with AI-powered insights
  try {
    const aiResponse = await generateTaskSuggestions({
      priority: task.priority,
      estimate_minutes: task.estimate_minutes,
      date: task.deadline
    });

    if (aiResponse.priority !== 'none') {
      suggestions.priority = aiResponse.priority;
    }

    if (aiResponse.suggestedTimeEstimate > 0) {
      suggestions.estimatedMinutes = aiResponse.suggestedTimeEstimate;
    }

    // Only add related tasks if we have AI suggestions
    if (aiResponse.relatedTasks.length > 0) {
      suggestions.relatedTasks = aiResponse.relatedTasks;
    }
  } catch (error) {
    console.error('Error enhancing suggestions with AI:', error);
    // Continue with basic suggestions if AI fails
  }

  revalidatePath("/")
  return suggestions;
}

// NEW: Handle file attachments
export async function addAttachmentToTask(
  taskId: number,
  filename: string,
  fileType: string,
  fileData: string
): Promise<{ id: number; filename: string; fileType: string; url: string }> {
  const attachment = db.prepare(`
    INSERT INTO attachments (task_id, filename, file_type, file_data)
    VALUES (?, ?, ?, ?)
  `).run(taskId, filename, fileType, fileData);

  revalidatePath("/")
  return {
    id: Number(attachment.lastInsertRowid),
    filename,
    fileType,
    url: `/uploads/${filename}`,
  };
}

// NEW: Get pending reminders (for notifications)
export async function exportDatabaseAsJson(): Promise<{ backupId: number; filePath: string }> {
  const backupPath = await createBackup('full', 'Database backup', 0);
  return {
    backupId: Number(backupPath.split('-').pop().split('.')[0]),
    filePath: backupPath,
  };
}

// Backup actions
export async function createBackup(description: string = 'Manual backup'): Promise<string> {
  const fs = require('fs')
  const path = require('path')
  const crypto = require('crypto')
  const dbPath = path.join(process.cwd(), 'data', 'planner.db')
  const backupDir = path.join(process.cwd(), 'data', 'backups')
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = path.join(backupDir, `backup-${timestamp}.db`)

  // Copy the database file
  fs.copyFileSync(dbPath, backupPath)

  // Calculate checksum
  const fileBuffer = fs.readFileSync(backupPath)
  const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex')
  const fileSize = fileBuffer.length

  // Record backup in database
  db.prepare(`
    INSERT INTO db_backups (backup_type, file_path, file_size, checksum, description)
    VALUES ('full', ?, ?, ?, ?)
  `).run(backupPath, fileSize, checksum, description)

  return backupPath
}

export async function listBackups() {
  return db.prepare(`
    SELECT * FROM db_backups ORDER BY created_at DESC
  `).all()
}

// External integrations
export async function addGoogleCalendarEvent(
  taskId: number,
  summary: string,
  description: string | null,
  start: Date,
  end: Date
): Promise<{ eventId: string }> {
  // This is a placeholder for Google Calendar integration
  // In production, this would use OAuth2 credentials and the Google Calendar API
  db.prepare(`
    INSERT INTO external_integrations (task_id, provider, external_id, sync_status, last_synced_at)
    VALUES (?, 'google_calendar', ?, 'pending', ?)
  `).run(
    taskId,
    summary,
    new Date().toISOString()
  )

  return { eventId: summary }
}

export async function addSlackNotification(
  taskId: number,
  message: string
): Promise<{ messageId: string }> {
  // Placeholder for Slack integration
  // In production, this would use Slack webhook or API
  db.prepare(`
    INSERT INTO notifications (task_id, type, title, message, sent_at)
    VALUES (?, 'system', 'Slack Notification', ?, ?)
  `).run(
    taskId,
    message,
    new Date().toISOString()
  )

  return { messageId: message }
}

export async function scheduleEmailReminder(
  taskId: number,
  email: string,
  message: string,
  sendAt: Date
): Promise<{ scheduledId: number }> {
  // Create a reminder for email delivery
  const result = db.prepare(`
    INSERT INTO reminders (task_id, time, is_sent)
    VALUES (?, ?, 0)
  `).run(taskId, sendAt.toISOString())

  db.prepare(`
    INSERT INTO notifications (task_id, type, title, message, sent_at)
    VALUES (?, 'reminder', ?, ?)
  `).run(taskId, email, message, new Date().toISOString())

  return { scheduledId: Number(result.lastInsertRowid) }
}

// External integrations
export async function getExternalIntegrations(taskId?: number) {
  if (taskId) {
    return db.prepare(`
      SELECT * FROM external_integrations WHERE task_id = ? ORDER BY created_at DESC
    `).all(taskId)
  }
  return db.prepare(`
    SELECT * FROM external_integrations ORDER BY created_at DESC LIMIT 100
  `).all()
}

export async function deleteExternalIntegration(integrationId: number) {
  const result = db.prepare(`
    DELETE FROM external_integrations WHERE id = ?
  `).run(integrationId)
  return result.changes
}

// NLP / Voice input actions
export async function createTaskFromVoice(text: string, listId: number): Promise<Task> {
  // Use enhanced NLP parser with voice corrections
  const parsed = await parseNaturalLanguage(text);
  const taskData: TaskFormData = {
    ...parsed,
    name: parsed.name || 'Untitled Voice Task',
    list_id: listId,
  };

  const task = taskOperations.create(taskData);
  revalidatePath("/")
  return task
}

// Smart templates
export async function getSmartTemplates(listId?: number): Promise<any[]> {
  if (listId) {
    return db.prepare(`
      SELECT * FROM templates WHERE list_id = ? OR list_id IS NULL ORDER BY created_at DESC
    `).all(listId);
  }
  return db.prepare(`
    SELECT * FROM templates ORDER BY created_at DESC
  `).all();
}

export async function createTemplate(
  name: string,
  description: string | null,
  listId: number | null,
  templateData: string
): Promise<{ id: number; name: string }> {
  const result = db.prepare(`
    INSERT INTO templates (name, description, list_id, template_data)
    VALUES (?, ?, ?, ?)
  `).run(name, description, listId, templateData);

  return {
    id: Number(result.lastInsertRowid),
    name,
  };
}

// Dependency management actions

/**
 * Get all dependencies for a task
 */
export async function getTaskDependencies(taskId: number): Promise<number[]> {
  const task = taskOperations.getById(taskId);
  if (!task || !task.dependencies) return [];

  try {
    return JSON.parse(task.dependencies) as number[];
  } catch {
    return [];
  }
}

/**
 * Add a dependency to a task
 */
export async function addTaskDependency(taskId: number, dependsOnTaskId: number): Promise<void> {
  if (taskId === dependsOnTaskId) {
    throw new Error('A task cannot depend on itself');
  }

  // Check if dependency already exists
  const existingDeps = await getTaskDependencies(taskId);
  if (existingDeps.includes(dependsOnTaskId)) {
    return; // Already exists
  }

  // Check for circular dependency
  if (wouldCreateCircularDependency(taskId, dependsOnTaskId)) {
    throw new Error('Adding this dependency would create a circular dependency');
  }

  const updatedDeps = [...existingDeps, dependsOnTaskId];

  db.prepare(`
    UPDATE tasks
    SET dependencies = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(JSON.stringify(updatedDeps), taskId);

  revalidatePath("/");
}

/**
 * Remove a dependency from a task
 */
export async function removeTaskDependency(taskId: number, dependsOnTaskId: number): Promise<void> {
  const existingDeps = await getTaskDependencies(taskId);
  const updatedDeps = existingDeps.filter(id => id !== dependsOnTaskId);

  db.prepare(`
    UPDATE tasks
    SET dependencies = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(JSON.stringify(updatedDeps), taskId);

  revalidatePath("/");
}

/**
 * Check if adding a dependency would create a circular reference
 */
function wouldCreateCircularDependency(taskId: number, dependsOnTaskId: number): boolean {
  // Use DFS to check if dependsOnTaskId eventually depends on taskId
  const visited = new Set<number>();
  const stack = [dependsOnTaskId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === taskId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    const task = taskOperations.getById(current);
    if (task && task.dependencies) {
      try {
        const deps = JSON.parse(task.dependencies) as number[];
        stack.push(...deps);
      } catch {
        // Invalid JSON, skip
      }
    }
  }

  return false;
}

/**
 * Get all tasks that depend on a given task (reverse dependencies)
 */
export async function getDependentTasks(taskId: number): Promise<number[]> {
  const allTasks = taskOperations.getAll();
  const dependents: number[] = [];

  for (const task of allTasks) {
    if (task.dependencies) {
      try {
        const deps = JSON.parse(task.dependencies) as number[];
        if (deps.includes(taskId)) {
          dependents.push(task.id);
        }
      } catch {
        // Invalid JSON, skip
      }
    }
  }

  return dependents;
}

/**
 * Get dependency chain for a task (all upstream dependencies)
 */
export async function getDependencyChain(taskId: number): Promise<number[]> {
  const chain: number[] = [];
  const visited = new Set<number>();
  const stack = [taskId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const task = taskOperations.getById(current);
    if (task && task.dependencies) {
      try {
        const deps = JSON.parse(task.dependencies) as number[];
        for (const dep of deps) {
          if (!chain.includes(dep)) {
            chain.push(dep);
          }
          stack.push(dep);
        }
      } catch {
        // Invalid JSON, skip
      }
    }
  }

  return chain;
}

/**
 * Validate that all dependencies exist
 */
export async function validateDependencies(taskId: number): Promise<{ valid: boolean; missing: number[] }> {
  const deps = await getTaskDependencies(taskId);
  const missing: number[] = [];

  for (const depId of deps) {
    const task = taskOperations.getById(depId);
    if (!task) {
      missing.push(depId);
    }
  }

  return { valid: missing.length === 0, missing };
}
