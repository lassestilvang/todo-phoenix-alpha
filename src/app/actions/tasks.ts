"use server"

import { revalidatePath } from "next/cache"
import { listOperations, taskOperations, labelOperations, subtaskOperations, timeEntryOperations, reminderOperations, attachmentOperations } from "@/lib/db"
import type { TaskFormData, SubtaskFormData, Task } from "@/lib/types"

// NLP Parser import (would be implemented separately)
type ParsedTaskData = Partial<TaskFormData>

/**
 * Simple NLP parser interface
 * In production, this would use the TaskParser from lib/nlp/task-parser.ts
 */
async function parseNaturalLanguage(text: string): Promise<ParsedTaskData> {
  // This is a placeholder - in production, use the TaskParser from NLP module
  // For now, we'll do simple regex-based extraction
  if (!text) return { name: text, description: text };

  // Extract time
  const timeMatch = text.match(/(\d{1,2}:\d{2}(?:\s*(?:am|pm))?)/i);
  // Extract date
  const dateMatch = text.match(/(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
  // Extract priority
  const priorityMatch = text.match(/\b(high|medium|low)\b/i);
  // Extract time estimate
  const estimateMatch = text.match(/\b(\d+)\s*(h|hr|hrs|hours?|m|min|mins?|minutes?)\b/i);

  const result: ParsedTaskData = {
    name: text.length > 50 ? text.substring(0, 47) + '...' : text,
    description: text,
  };

  if (priorityMatch) {
    result.priority = priorityMatch[1].toLowerCase() as any;
  }

  if (estimateMatch) {
    const value = parseInt(estimateMatch[1], 10);
    const unit = estimateMatch[2].toLowerCase();
    result.estimate_minutes = unit.startsWith('h') ? value * 60 : value;
  }

  return result;
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
  const now = new Date().toISOString();
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
  const task = await taskOperations.getByIdWithDetails(taskId);
  const dbTimer = db.prepare(`
    INSERT INTO time_entries (task_id, started_at)
    VALUES (?, CURRENT_TIMESTAMP)
  `).run(taskId);
  return dbTimer.lastInsertRowid;
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

  // Create reminder if was detected in text
  if (taskOperations.getById(task.id)?.deadline) {
    const taskWithDetails = taskOperations.getByIdWithDetails(task.id);
    if (taskWithDetails?.deadline) {
      try {
        reminderOperations.create(task.id, new Date(taskWithDetails.deadline));
      } catch (e) {
        // Reminder creation failed, but task was created
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
  const task = taskOperations.getByIdWithDetails(taskId);
  if (!task) throw new Error('Task not found');

  // Basic AI-like suggestions based on task properties
  // In production, this would call Claude API
  const suggestions = {
    priority: task.priority,
    estimatedMinutes: task.estimate_minutes,
    relatedTasks: [] as number[],
  };

  // Find related tasks based on labels
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

  // Suggest priority based on deadline proximity
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
  const attachment = attachmentOperations.create(taskId, filename, fileType, fileData);

  revalidatePath("/")
  return {
    id: attachment.id,
    filename: attachment.filename,
    fileType: attachment.file_type,
    url: `/uploads/${attachment.filename}`,
  };
}

// NEW: Get pending reminders (for notifications)
export async function getPendingReminders(): Promise<any[]> {
  const now = new Date();
  return reminderOperations.getPendingReminders(now);
}
