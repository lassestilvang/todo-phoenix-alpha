"use server"

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
    task_id: reminder.task_id,
    time: reminder.time,
    is_sent: reminder.is_sent,
    sent_at: reminder.sent_at,
  };
}

export async function getPendingReminders(): Promise<Reminder[]> {
  const now = new Date().toISOString()
  const pendingReminders = db.prepare(`
    SELECT * FROM reminders
    WHERE is_sent = 0 AND time <= ?
  `).all(now);

  return pendingReminders.map((r: any) => ({
    id: r.id,
    task_id: r.task_id,
    time: r.time,
    is_sent: r.is_sent,
    sent_at: r.sent_at,
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

  return rows.map((r: any) => ({
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

  const stats = rows.map((row: any) => ({
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
  return timeEntryOperations.getAllForTask(taskId)
}

export async function startTimeEntry(taskId: number) {
  const timeEntry = timeEntryOperations.create({
    taskId: taskId,
    startedAt: new Date().toISOString()
  })
  revalidatePath("/")
  return timeEntry
}

export async function stopTimeEntry(id: number) {
  const timeEntry = timeEntryOperations.stop(id)
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
        reminderOperations.create(task.id, new Date(taskWithDetails.deadline).toISOString());
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
  suggestedTimeEstimate: number;
  suggestedDate: string | null;
  relatedTasks: number[];
  confidence: number;
  predictiveSchedule?: {
    startDate: Date;
    optimalStartTime: string;
    confidence: number;
  };
}> {
  const task = taskOperations.getByIdWithDetails(taskId)
  if (!task) throw new Error('Task not found');

  // NEW: Enhance suggestions with AI-powered insights
  try {
    const aiResponse = await generateTaskSuggestions({
      priority: task.priority,
      estimate_minutes: task.estimate_minutes,
      date: task.deadline
    });

    // Return the full AI response with task-specific overrides
    return {
      priority: aiResponse.priority !== 'none' ? aiResponse.priority : task.priority,
      suggestedTimeEstimate: aiResponse.suggestedTimeEstimate > 0 ? aiResponse.suggestedTimeEstimate : (task.estimate_minutes || 30),
      suggestedDate: task.deadline || null,
      relatedTasks: aiResponse.relatedTasks.length > 0 ? aiResponse.relatedTasks : [],
      confidence: aiResponse.confidence,
      predictiveSchedule: aiResponse.predictiveSchedule
    };
  } catch (error) {
    console.error('Error generating suggestions with AI:', error);
    // Fallback to basic suggestions if AI fails
    return {
      priority: task.priority || 'medium',
      suggestedTimeEstimate: task.estimate_minutes || 30,
      suggestedDate: task.deadline || null,
      relatedTasks: [],
      confidence: 30,
      predictiveSchedule: undefined
    };
  }
}

// NEW: Meeting assistant actions
export async function analyzeMeeting(meeting: {
  title: string;
  date: string;
  durationMinutes: number;
  attendees: string[];
  transcript?: string;
  notes?: string;
  platform?: string;
}): Promise<{
  summary: string;
  actionItems: Array<{
    taskName: string;
    description: string;
    assignee?: string;
    dueDate?: string;
    priority: string;
    estimatedMinutes: number;
    relatedTopics: string[];
    confidence: number;
    context: string;
  }>;
  decisions: string[];
  keyTopics: string[];
  followUpNeeded: boolean;
  nextSteps: string[];
  sentiment: string;
  meetingEffectiveness: number;
}> {
  const { analyzeMeeting: _analyzeMeeting } = await import('@/lib/meeting-assistant');

  return _analyzeMeeting({
    title: meeting.title,
    date: meeting.date,
    durationMinutes: meeting.durationMinutes,
    attendees: meeting.attendees,
    transcript: meeting.transcript,
    notes: meeting.notes,
    platform: meeting.platform as any,
  });
}

export async function createTasksFromMeeting(
  analysis: {
    actionItems: Array<{
      taskName: string;
      description: string;
      assignee?: string;
      dueDate?: string;
      priority: string;
      estimatedMinutes: number;
      relatedTopics: string[];
      confidence: number;
      context: string;
    }>;
  },
  listId: number
): Promise<TaskFormData[]> {
  const { generateTaskSuggestions } = await import('@/lib/ai/enhancement');

  return analysis.actionItems.map(item => ({
    name: item.taskName,
    description: item.description,
    list_id: listId,
    estimate_minutes: item.estimatedMinutes,
    priority: item.priority as any,
    deadline: item.dueDate ? new Date(item.dueDate).toISOString() : undefined,
  }));
}

export async function getMeetingTemplates(): Promise<{
  id: string;
  name: string;
  description: string;
  agenda: string[];
  defaultDuration: number;
  typicalAttendees: string[];
}> {
  const { getMeetingTemplates: _getTemplates } = await import('@/lib/meeting-assistant');

  const templates = _getTemplates();
  return templates.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    agenda: t.agenda,
    defaultDuration: t.defaultDuration,
    typicalAttendees: t.typicalAttendees,
  }));
}

// NEW: Context-aware task suggestions
export async function getContextAwareSuggestions(
  currentTaskId: number,
  userPreferences?: {
    preferredTimeOfDay?: number;
    preferredPriority?: string;
    typicalTaskDuration?: number;
  }
): Promise<{
  suggestedTasks: Array<{
    name: string;
    estimatedMinutes: number;
    priority: string;
    reason: string;
  }>;
  optimalScheduleBlocks: Array<{
    hour: number;
    tasks: string[];
  }>;
}> {
  const { taskOperations } = await import('@/lib/db/tasks');

  const currentTask = taskOperations.getByIdWithDetails(currentTaskId);
  if (!currentTask) {
    throw new Error('Task not found');
  }

  const { generateTaskSuggestions } = await import('@/lib/ai/enhancement');

  // Get AI suggestions
  const aiSuggestions = await generateTaskSuggestions({
    priority: currentTask.priority,
    estimate_minutes: currentTask.estimate_minutes || 30,
    date: currentTask.deadline
  });

  // Build context-aware suggestions based on current task and user preferences
  const defaultSuggestions = [
    {
      name: `Follow-up: ${currentTask.name}`,
      estimatedMinutes: Math.max(30, (currentTask.estimate_minutes || 30) * 0.5),
      priority: currentTask.priority || 'medium',
      reason: 'Follow-up on current task progress'
    },
    {
      name: `Review related tasks`,
      estimatedMinutes: 15,
      priority: 'low',
      reason: 'Check for related or dependent tasks'
    }
  ];

  // Calculate optimal schedule blocks based on preferences
  const optimalBlocks = [
    { hour: 9, tasks: ['Review emails', 'Plan day'] },
    { hour: 14, tasks: ['Focus work', 'Current task'] },
    { hour: 16, tasks: ['Meetings', 'Collaboration'] }
  ];

  const suggestions = [
    ...defaultSuggestions,
    ...aiSuggestions.relatedTasks?.length > 0
      ? [{ name: 'Check related tasks', estimatedMinutes: 10, priority: 'low', reason: 'AI-recommended related tasks' }]
      : []
  ];

  return {
    suggestedTasks: suggestions,
    optimalScheduleBlocks: optimalBlocks
  };
}

// NEW: Enhanced search with smart filters
export async function smartSearch(
  query: string,
  filters?: {
    priority?: string[];
    listId?: number;
    dateFrom?: string;
    dateTo?: string;
    hasAttachments?: boolean;
    hasReminders?: boolean;
    labels?: number[];
    sortBy?: 'date' | 'priority' | 'created' | 'relevance';
    sortOrder?: 'asc' | 'desc';
  }
): Promise<{
  tasks: any[];
  total: number;
  fuzzyMatches?: any[];
  suggestions?: string[];
}> {
  const { SearchService } = await import('@/lib/search');

  return SearchService.search(query, filters, {
    fuzzy: true,
    fuzzyThreshold: 0.7,
    sortBy: filters?.sortBy || 'relevance',
    sortOrder: filters?.sortOrder || 'desc'
  });
}

// NEW: Automation engine actions
export async function createAutomationRule(rule: {
  name: string;
  description: string;
  trigger: any;
  conditions?: any[];
  actions: any[];
  isActive: boolean;
  priority: 'low' | 'medium' | 'high';
  createdBy: string;
}): Promise<{ id: string; name: string }> {
  const { automationEngine } = await import('@/lib/automation-engine');

  const createdRule = automationEngine.createAutomationRule(rule);
  return { id: createdRule.id, name: createdRule.name };
}

export async function executeAutomationRule(ruleId: string, triggerEvent: string, eventData?: any): Promise<{ successes: number; failures: number; history: any[] }> {
  const { automationEngine } = await import('@/lib/automation-engine');

  const history = automationEngine.executeAutomationRule(ruleId, triggerEvent, eventData);
  const successes = history.filter(h => h.status === 'success').length;
  const failures = history.filter(h => h.status === 'failed').length;

  return { successes, failures, history };
}

export async function getAutomationRules(isActiveOnly?: boolean): Promise<any[]> {
  const { automationEngine } = await import('@/lib/automation-engine');

  return automationEngine.getAutomationRules(isActiveOnly);
}

export async function updateAutomationRuleStatus(ruleId: string, isActive: boolean): Promise<{ id: string; isActive: boolean } | undefined> {
  const { automationEngine } = await import('@/lib/automation-engine');

  return automationEngine.updateAutomationRuleStatus(ruleId, isActive);
}

export async function deleteAutomationRule(ruleId: string): Promise<boolean> {
  const { automationEngine } = await import('@/lib/automation-engine');

  return automationEngine.deleteAutomationRule(ruleId);
}

export async function getAutomationHistory(ruleId?: string, limit?: number): Promise<any[]> {
  const { automationEngine } = await import('@/lib/automation-engine');

  return automationEngine.getAutomationHistory(ruleId, limit);
}

export async function getAutomationTemplates(): Promise<{
  id: string;
  name: string;
  description: string;
  triggerType: string;
  defaultConfig: any;
  exampleAction: any;
  category: string;
  isPublic: boolean;
}[]> {
  const { automationEngine } = await import('@/lib/automation-engine');

  return automationEngine.AUTOMATION_TEMPLATES.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    triggerType: t.triggerType,
    defaultConfig: t.defaultConfig,
    exampleAction: t.exampleAction,
    category: t.category,
    isPublic: t.isPublic
  }));
}

// NEW: Advanced analytics functions
export async function getAnalyticsDashboard(): Promise<{
  taskStats: { total: number; completed: number; inProgress: number; pending: number };
  productivityMetrics: { avgTaskDuration: number; tasksPerDay: number; completionRate: number };
  topProjects: { name: string; taskCount: number }[];
  dailyActivity: { date: string; tasksCreated: number; tasksCompleted: number }[];
}> {
  const { taskOperations } = await import('@/lib/db/tasks');

  const allTasks = taskOperations.getAll(true) as any[];
  const completedTasks = taskOperations.getAll(false) as any[];

  const total = allTasks.length;
  const completed = completedTasks.filter(t => t.is_completed === 1).length;
  const inProgress = allTasks.filter(t => !t.is_completed && t.is_completed !== 0).length;
  const pending = total - completed - inProgress;

  // Calculate completion rate
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Calculate average task duration from time entries
  const avgDurationResult = db.prepare(`
    SELECT AVG(duration_minutes) as avgMinutes
    FROM time_entries
    WHERE duration_minutes > 0 AND actual_minutes > 0
  `).get() as { avgMinutes: number | null };

  const avgTaskDuration = avgDurationResult?.avgMinutes
    ? Math.round(avgDurationResult.avgMinutes * 10) / 10
    : 0;

  // Simplified: tasks per day (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const tasksCreatedLastWeek = db.prepare(`
    SELECT COUNT(*) as count FROM tasks WHERE date >= ?
  `).get(sevenDaysAgo) as { count: number };

  const tasksPerDay = tasksCreatedLastWeek?.count ? Math.round(tasksCreatedLastWeek.count / 7) : 0;

  // Top projects - simplified without projects table, using labels/tags as proxy
  const topProjects: { name: string; taskCount: number }[] = [
    { name: 'Work', taskCount: 0 },
    { name: 'Personal', taskCount: 0 },
    { name: 'Urgent', taskCount: 0 }
  ];

  // Daily activity (last 7 days)
  const dailyActivity = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];
    const created = db.prepare(`
      SELECT COUNT(*) as count FROM tasks WHERE date = ?
    `).get(dateStr) as { count: number };

    const completedToday = db.prepare(`
      SELECT COUNT(*) as count FROM tasks WHERE date = ? AND is_completed = 1
    `).get(dateStr) as { count: number };

    dailyActivity.push({
      date: dateStr,
      tasksCreated: created?.count || 0,
      tasksCompleted: completedToday?.count || 0
    });
  }

  return {
    taskStats: { total, completed, inProgress, pending },
    productivityMetrics: {
      avgTaskDuration,
      tasksPerDay,
      completionRate
    },
    topProjects,
    dailyActivity
  };
}

// NEW: Template system integration
export async function applyTemplateToTask(
  templateName: string,
  userVariables: Record<string, any>
): Promise<{ task: any; variables: Record<string, any>; substitutions: { applied: string[]; failed: string[] } }> {
  const { generateDefaultTemplates } = await import('@/lib/template-engine');

  const templates = generateDefaultTemplates();
  const template = templates.find(t => t.name === templateName);

  if (!template) {
    throw new Error(`Template "${templateName}" not found`);
  }

  return applyTemplate(template, userVariables);
}

export async function getAvailableTemplates(): Promise<{
  id: string;
  name: string;
  description: string;
  category: string;
}> {
  const { generateDefaultTemplates } = await import('@/lib/template-engine');

  const templates = generateDefaultTemplates();

  return templates.map(t => ({
    id: t.name,
    name: t.name,
    description: t.description || '',
    category: t.category || 'general'
  }));
}
export async function createComment(comment: {
  taskId: number;
  userId: string;
  content: string;
  parentId?: string;
  mentions?: string[];
  attachments?: string[];
}): Promise<any> {
  const { collaborationOperations } = await import('@/lib/collaboration');

  return collaborationOperations.createComment(comment);
}

export async function getComments(taskId: number, includeDeleted?: boolean): Promise<any[]> {
  const { collaborationOperations } = await import('@/lib/collaboration');

  return collaborationOperations.getComments(taskId, includeDeleted);
}

export async function updateComment(id: string, updates: any): Promise<any> {
  const { collaborationOperations } = await import('@/lib/collaboration');

  return collaborationOperations.updateComment(id, updates);
}

export async function deleteComment(id: string): Promise<void> {
  const { collaborationOperations } = await import('@/lib/collaboration');

  return collaborationOperations.deleteComment(id);
}

export async function addMention(commentId: string, userId: string): Promise<any> {
  const { collaborationOperations } = await import('@/lib/collaboration');

  return collaborationOperations.addMention(commentId, userId);
}

export async function getNotifications(userId: string, includeRead?: boolean): Promise<any[]> {
  const { collaborationOperations } = await import('@/lib/collaboration');

  return collaborationOperations.getNotifications(userId, includeRead);
}

export async function markNotificationRead(id: number): Promise<void> {
  const { collaborationOperations } = await import('@/lib/collaboration');

  return collaborationOperations.markNotificationRead(id);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { collaborationOperations } = await import('@/lib/collaboration');

  return collaborationOperations.markAllNotificationsRead(userId);
}

export async function getActivities(userId?: string, limit?: number): Promise<any[]> {
  const { collaborationOperations } = await import('@/lib/collaboration');

  return collaborationOperations.getActivities(userId, limit);
}

export async function assignTask(taskId: number, assignedTo: string, assignedBy: string, notes?: string): Promise<any> {
  const { collaborationOperations } = await import('@/lib/collaboration');

  return collaborationOperations.assignTask(taskId, assignedTo, assignedBy, notes);
}

export async function getTaskAssignments(taskId: number): Promise<any[]> {
  const { collaborationOperations } = await import('@/lib/collaboration');

  return collaborationOperations.getTaskAssignments(taskId);
}

export async function createApprovalWorkflow(workflow: {
  name: string;
  description: string;
  entityType: 'task' | 'subtask' | 'time-entry';
  requiredApprovals: number;
  approvers: string[];
  isRequired: boolean;
  requestedBy: string;
  dueDate?: string;
}): Promise<any> {
  const { collaborationOperations } = await import('@/lib/collaboration');

  return collaborationOperations.createApprovalWorkflow(workflow);
}

export async function getPendingApprovals(userId: string): Promise<any[]> {
  const { collaborationOperations } = await import('@/lib/collaboration');

  return collaborationOperations.getPendingApprovals(userId);
}

export async function submitApproval(workflowId: number, userId: string, decision: 'approve' | 'reject', comment?: string): Promise<any> {
  const { collaborationOperations } = await import('@/lib/collaboration');

  return collaborationOperations.submitApproval(workflowId, userId, decision, comment);
}

export async function updateUserPresence(presence: {
  userId: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  currentTaskId?: number;
  currentPage?: string;
}): Promise<any> {
  const { collaborationOperations } = await import('@/lib/collaboration');

  return collaborationOperations.updatePresence(presence);
}

export async function getUserPresence(userId: string): Promise<any> {
  const { collaborationOperations } = await import('@/lib/collaboration');

  return collaborationOperations.getUserPresence(userId);
}

export async function getAllUsersPresence(): Promise<any[]> {
  const { collaborationOperations } = await import('@/lib/collaboration');

  return collaborationOperations.getAllUsersPresence();
}

// NEW: Enhanced attachment functions
export async function addAttachmentWithAnalysis(
  taskId: number,
  filename: string,
  fileType: string,
  fileData: string
): Promise<{
  id: number;
  filename: string;
  fileType: string;
  fileSize: number;
  hasTextContent: boolean;
  suggestedTags: string[];
  thumbnailPath: string;
}> {
  const fileSize = Math.ceil((fileData.length * 3) / 4);

  // Check attachment limit (10 per task)
  const existingCount = db.prepare('SELECT COUNT(*) as count FROM attachments WHERE task_id = ?').get(taskId) as { count: number };
  if (existingCount.count >= 10) {
    throw new Error('Maximum of 10 attachments per task exceeded');
  }

  // Check file size limit (10MB)
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  if (fileSize > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds 10MB limit`);
  }

  // Analyze the attachment
  const { attachmentOperations } = await import('@/lib/db/attachments');
  const analysis = await attachmentOperations.analyzeAttachment(fileData, fileType);
  const preview = await attachmentOperations.generatePreview(fileData, fileType);
  const suggestedTags = attachmentOperations.getSuggestedTags(analysis);

  const attachment = db.prepare(`
    INSERT INTO attachments (task_id, filename, file_type, file_data, file_size, has_text_content, suggested_tags, thumbnail_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    taskId,
    filename,
    fileType,
    fileData,
    fileSize,
    analysis.hasTextContent ? 1 : 0,
    JSON.stringify(suggestedTags),
    preview.thumbnailPath
  );

  revalidatePath("/")
  return {
    id: Number(attachment.lastInsertRowid),
    filename,
    fileType,
    fileSize,
    hasTextContent: analysis.hasTextContent,
    suggestedTags,
    thumbnailPath: preview.thumbnailPath
  };
}

export async function getAttachmentAnalysis(attachmentId: number): Promise<{
  id: number;
  filename: string;
  fileType: string;
  fileSize: number;
  hasTextContent: boolean;
  suggestedTags: string[];
  thumbnailPath: string;
} | null> {
  const attachment = db.prepare('SELECT * FROM attachments WHERE id = ?').get(attachmentId);
  if (!attachment) return null;

  return {
    id: attachment.id,
    filename: attachment.filename,
    fileType: attachment.file_type,
    fileSize: attachment.file_size,
    hasTextContent: attachment.has_text_content === 1,
    suggestedTags: attachment.suggested_tags ? JSON.parse(attachment.suggested_tags) : [],
    thumbnailPath: attachment.thumbnail_path || ''
  };
}

export async function getAttachmentsWithAnalysis(taskId: number): Promise<Array<{
  id: number;
  filename: string;
  fileType: string;
  fileSize: number;
  hasTextContent: boolean;
  suggestedTags: string[];
  thumbnailPath: string;
  createdAt: string;
}>> {
  const attachments = db.prepare('SELECT * FROM attachments WHERE task_id = ? ORDER BY created_at DESC').all(taskId) as any[];

  return attachments.map(a => ({
    id: a.id,
    filename: a.filename,
    fileType: a.file_type,
    fileSize: a.file_size,
    hasTextContent: a.has_text_content === 1,
    suggestedTags: a.suggested_tags ? JSON.parse(a.suggested_tags) : [],
    thumbnailPath: a.thumbnail_path || '',
    createdAt: a.created_at
  }));
}

export async function searchAttachments(
  query: string,
  filters?: {
    fileType?: string[];
    taskId?: number;
    hasTextContent?: boolean;
    tags?: string[];
    minSize?: number;
    maxSize?: number;
  }
): Promise<Array<{
  id: number;
  taskId: number;
  filename: string;
  fileType: string;
  fileSize: number;
  hasTextContent: boolean;
  suggestedTags: string[];
  thumbnailPath: string;
  createdAt: string;
}>> {
  let sql = 'SELECT * FROM attachments WHERE 1=1';
  const params: any[] = [];

  if (query) {
    sql += ' AND (filename LIKE ? OR suggested_tags LIKE ?)';
    const searchTerm = `%${query}%`;
    params.push(searchTerm, searchTerm);
  }

  if (filters?.fileType && filters.fileType.length > 0) {
    sql += ` AND file_type IN (${filters.fileType.map(() => '?').join(',')})`;
    params.push(...filters.fileType);
  }

  if (filters?.taskId) {
    sql += ' AND task_id = ?';
    params.push(filters.taskId);
  }

  if (filters?.hasTextContent !== undefined) {
    sql += ' AND has_text_content = ?';
    params.push(filters.hasTextContent ? 1 : 0);
  }

  if (filters?.minSize) {
    sql += ' AND file_size >= ?';
    params.push(filters.minSize);
  }

  if (filters?.maxSize) {
    sql += ' AND file_size <= ?';
    params.push(filters.maxSize);
  }

  sql += ' ORDER BY created_at DESC';

  const attachments = db.prepare(sql).all(...params) as any[];

  return attachments.map(a => ({
    id: a.id,
    taskId: a.task_id,
    filename: a.filename,
    fileType: a.file_type,
    fileSize: a.file_size,
    hasTextContent: a.has_text_content === 1,
    suggestedTags: a.suggested_tags ? JSON.parse(a.suggested_tags) : [],
    thumbnailPath: a.thumbnail_path || '',
    createdAt: a.created_at
  }));
}

// NEW: Get pending reminders (for notifications)
export async function exportDatabaseAsJson(): Promise<{ backupId: number; filePath: string }> {
  const backupPath = await createBackup('Database backup');
  const parts = backupPath.split('-').pop();
  return {
    backupId: parts ? Number(parts.split('.')[0]) : 0,
    filePath: backupPath,
  };
}

// NEW: Enhanced search function
export async function advancedSearch(
  query: string,
  filters?: {
    priority?: string[];
    listId?: number;
    dateRange?: [string, string];
    hasAttachments?: boolean;
    hasReminders?: boolean;
    isCompleted?: boolean;
    hasSubtasks?: boolean;
    labels?: number[];
  },
  options?: {
    fuzzy?: boolean;
    fuzzyThreshold?: number;
    semantic?: boolean;
    semanticThreshold?: number;
    sortBy?: 'date' | 'priority' | 'created' | 'relevance';
    sortOrder?: 'asc' | 'desc';
  }
): Promise<{ tasks: any[]; total: number; fuzzyMatches?: any[]; suggestions?: string[] }> {
  // Import the search service dynamically to avoid circular imports
  const { SearchService } = await import('@/lib/search');

  return SearchService.search(query, filters, options || {});
}

// NEW: Save a search for later use
export async function saveSearch(search: {
  name: string;
  query: string;
  filters: any;
  options?: any;
}): Promise<{ id: number; name: string }> {
  const { SearchService } = await import('@/lib/search');
  return SearchService.saveSearch(search);
}

// NEW: Get saved searches
export async function getSavedSearches(userId?: string): Promise<any[]> {
  const { SearchService } = await import('@/lib/search');
  return SearchService.getSavedSearches(userId);
}

// NEW: Get popular search queries
export async function getPopularSearches(limit?: number): Promise<string[]> {
  const { SearchService } = await import('@/lib/search');
  return SearchService.getPopularSearches(limit);
}

// NEW: Create smart folder
export async function createSmartFolder(
  name: string,
  filterQuery: string,
  filters: any
): Promise<void> {
  const { SearchService } = await import('@/lib/search');
  return SearchService.createSmartFolder(name, filterQuery, filters);
}

// NEW: Get all smart folders
export async function getSmartFolders(): Promise<any[]> {
  const { SearchService } = await import('@/lib/search');
  return SearchService.getSmartFolders();
}

// NEW: Get tasks in a smart folder
export async function getSmartFolderTasks(folderId: number): Promise<any[]> {
  const { SearchService } = await import('@/lib/search');
  return SearchService.getSmartFolderTasks(folderId);
}

// NEW: Delete a saved search
export async function deleteSearch(id: number): Promise<void> {
  const { SearchService } = await import('@/lib/search');
  return SearchService.deleteSearch(id);
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
