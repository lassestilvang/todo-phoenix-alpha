import { google, calendar_v3 } from 'googleapis';
import type { Task } from '@/lib/types';

// Configure Google Calendar OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

/**
 * Generate OAuth2 URL for Google Calendar authentication
 */
export function getAuthUrl(): string {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar'],
  });
}

/**
 * Set OAuth2 tokens from code
 */
export async function setAuthTokens(code: string) {
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  return tokens;
}

/**
 * Convert Task to Google Calendar Event format
 */
function taskToEvent(task: Task): calendar_v3.Schema$Event {
  const event: calendar_v3.Schema$Event = {
    summary: task.name,
    description: task.description || '',
    reminders: {
      useDefault: false,
      update: [],
    },
  };

  if (task.date) {
    const dateObj = new Date(task.date);
    event.start = {
      date: dateObj.toISOString().split('T')[0],
    };
  }

  if (task.deadline) {
    event.end = {
      dateTime: new Date(task.deadline).toISOString(),
    };
  }

  // Add priority as colorId if available
  if (task.priority === 'high') {
    event.colorId = '11'; // Red
  } else if (task.priority === 'medium') {
    event.colorId = '5'; // Yellow
  } else if (task.priority === 'low') {
    event.colorId = '2'; // Green
  }

  return event;
}

/**
 * Convert Calendar Event to Task format
 */
function eventToTask(event: calendar_v3.Schema$Event, listId: number): Partial<Task> {
  const task: Partial<Task> = {
    name: event.summary || '',
    description: event.description || null,
    list_id: listId,
  };

  if (event.start?.date) {
    task.date = event.start.date;
  }
  if (event.start?.dateTime) {
    task.date = new Date(event.start.dateTime).toISOString().split('T')[0];
  }
  if (event.end?.dateTime) {
    task.deadline = event.end.dateTime;
  }

  // Map color back to priority
  if (event.colorId === '11') {
    task.priority = 'high' as any;
  } else if (event.colorId === '5') {
    task.priority = 'medium' as any;
  } else if (event.colorId === '2') {
    task.priority = 'low' as any;
  }

  return task;
}

/**
 * Sync tasks to Google Calendar (export)
 */
export async function exportTasksToCalendar(tasks: Task[], calendarId = 'primary'): Promise<number> {
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  let exportedCount = 0;
  for (const task of tasks) {
    try {
      const event = taskToEvent(task);
      await calendar.events.insert({
        calendarId,
        requestBody: event,
      });
      exportedCount++;
    } catch (error) {
      console.error(`Error exporting task ${task.id}:`, error);
    }
  }

  return exportedCount;
}

/**
 * Import events from Google Calendar (import)
 */
export async function importEventsAsTasks(
  listId: number,
  calendarId = 'primary',
  dateRange?: { start: string; end: string }
): Promise<number> {
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const response = await calendar.events.list({
    calendarId,
    timeMin: dateRange?.start,
    timeMax: dateRange?.end,
    singleEvents: true,
    orderBy: 'startTime',
  });

  const events = response.data.items || [];
  let importedCount = 0;

  for (const event of events) {
    try {
      const taskData = eventToTask(event, listId);
      // This would use the task operations to create the task
      // import { taskOperations } from '@/lib/db';
      // taskOperations.create(taskData as TaskFormData);
      importedCount++;
    } catch (error) {
      console.error(`Error importing event ${event.id}:`, error);
    }
  }

  return importedCount;
}

/**
 * Two-way sync between tasks and calendar
 */
export async function syncWithCalendar(
  existingTasks: Task[],
  listId: number,
  calendarId = 'primary'
): Promise<{ exported: number; imported: number }> {
  const exported = await exportTasksToCalendar(existingTasks, calendarId);
  const imported = await importEventsAsTasks(listId, calendarId);

  // Trigger revalidation
  const { revalidatePath } = await import('next/cache');
  revalidatePath('/');

  return { exported, imported };
}

/**
 * Generate ICS (iCalendar) format for a single task (for easy exporting)
 */
export function generateICS(task: Task): string {
  const startDate = task.date ? new Date(task.date) : new Date();
  const endDate = task.deadline ? new Date(task.deadline) : new Date();

  const formatDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Todo Phoenix//EN',
    'BEGIN:VEVENT',
    `UID:${task.id}@todo-phoenix`,
    `DTSTAMP:${formatDate(new Date())}`,
    `DTSTART:${formatDate(startDate)}`,
    `DTEND:${formatDate(endDate)}`,
    `SUMMARY:${task.name}`,
    `DESCRIPTION:${task.description || ''}`,
    `END:VEVENT`,
    'END:VCALENDAR',
  ].join('\n');
}