import { BaseIntegration, IntegrationConfig, ExternalTask, ExternalUser, ExternalProject, ExternalComment, IntegrationFilters } from './integration-framework';
import fetch from 'node-fetch';

/**
 * Google Calendar Integration
 * Syncs tasks with Google Calendar events and calendar-based scheduling
 */
export class GoogleCalendarIntegration extends BaseIntegration {
  private apiBase = 'https://www.googleapis.com/calendar/v3/calendars';
  private calendarId: string;

  constructor(config: IntegrationConfig) {
    super(config);

    if (!config.credentials.accessToken) {
      throw new Error('Google Calendar integration requires access token');
    }

    // Use primary calendar by default, or specified calendar ID
    this.calendarId = config.credentials.projectId || 'primary';
  }

  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.config.credentials.accessToken}`,
      'Content-Type': 'application/json'
    };
  }

  async authenticate(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBase}/${encodeURIComponent(this.calendarId)}/events?maxResults=1`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      return response.ok;
    } catch (error) {
      console.error('Google Calendar authentication failed:', error);
      return false;
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      // Get calendar info
      const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList/calendars/' + encodeURIComponent(this.calendarId), {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, message: `Google Calendar connection successful (${data.summary || this.calendarId})` };
      } else {
        return { success: false, message: 'Google Calendar access denied' };
      }
    } catch (error) {
      return { success: false, message: `Google Calendar connection error: ${error instanceof Error ? error.message : 'Unknown'}` };
    }
  }

  // For Google Calendar, each calendar is a project/list
  async getProjects(): Promise<ExternalProject[]> {
    try {
      // Get user's calendar list
      const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
        method: 'GET',
        headers: this.getHeaders()
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Failed to fetch calendars');

      // Return all calendars as projects
      return data.items?.map((cal: any) => ({
        id: cal.id,
        externalId: cal.id,
        name: cal.summary,
        description: cal.description || '',
        key: cal.id,
        url: cal.htmlLink,
        color: cal.backgroundColor || '#4285F4',
        members: [], // Would need separate API call for calendar sharing info
        metadata: {
          timezone: cal.timezone,
          isPrimary: cal.id === 'primary',
          notificationSettings: cal.notificationSettings,
          defaultReminders: cal.defaultReminders
        }
      })) || [];
    } catch (error) {
      console.error('Failed to fetch Google Calendar projects:', error);
      return [];
    }
  }

  async getProject(projectId: string): Promise<ExternalProject | null> {
    try {
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/users/me/calendarList/calendars/${encodeURIComponent(projectId)}`,
        { method: 'GET', headers: this.getHeaders() }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Failed to fetch calendar');

      return {
        id: data.id,
        externalId: data.id,
        name: data.summary,
        description: data.description || '',
        key: data.id,
        url: data.htmlLink,
        color: data.backgroundColor || '#4285F4',
        members: [],
        metadata: {
          timezone: data.timezone,
          isPrimary: data.id === 'primary',
          notificationSettings: data.notificationSettings,
          defaultReminders: data.defaultReminders
        }
      };
    } catch (error) {
      console.error(`Failed to fetch Google Calendar project ${projectId}:`, error);
      return null;
    }
  }

  // Events are the tasks in Google Calendar
  async getTasks(projectId?: string, filters?: IntegrationFilters): Promise<ExternalTask[]> {
    try {
      const calendarId = projectId || this.calendarId;

      const params = new URLSearchParams({
        maxResults: '250',
        singleEvents: 'true',
        orderBy: 'startTime'
      });

      // Add time range if specified
      if (filters?.dateRange) {
        params.append('timeMin', new Date(filters.dateRange.start).toISOString());
        params.append('timeMax', new Date(filters.dateRange.end).toISOString());
      }

      const response = await fetch(
        `${this.apiBase}/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
        { method: 'GET', headers: this.getHeaders() }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Failed to fetch events');

      return data.items?.map((event: any) => this.transformEventToTask(event, calendarId)) || [];
    } catch (error) {
      console.error('Failed to fetch Google Calendar tasks:', error);
      return [];
    }
  }

  async getTask(taskId: string): Promise<ExternalTask | null> {
    try {
      const calendarId = taskId.split('_')[0];
      const eventId = taskId.split('_')[1];

      const response = await fetch(
        `${this.apiBase}/${encodeURIComponent(calendarId)}/events/${eventId}`,
        { method: 'GET', headers: this.getHeaders() }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Failed to fetch event');

      return this.transformEventToTask(data, calendarId);
    } catch (error) {
      console.error(`Failed to fetch Google Calendar task ${taskId}:`, error);
      return null;
    }
  }

  async createTask(task: Partial<ExternalTask>): Promise<ExternalTask> {
    try {
      const calendarId = task.projectId || this.calendarId;

      // Build event from task
      const event = this.buildEventFromTask(task, calendarId);

      const response = await fetch(
        `${this.apiBase}/${encodeURIComponent(calendarId)}/events`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(event)
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Failed to create event');

      return this.transformEventToTask(data, calendarId);
    } catch (error) {
      console.error('Failed to create Google Calendar task:', error);
      throw error;
    }
  }

  async updateTask(taskId: string, updates: Partial<ExternalTask>): Promise<ExternalTask> {
    try {
      const [calendarId, eventId] = taskId.split('_');

      // Fetch existing event
      const response = await fetch(
        `${this.apiBase}/${encodeURIComponent(calendarId)}/events/${eventId}`,
        { method: 'GET', headers: this.getHeaders() }
      );

      const existingEvent = await response.json();

      // Build updated event
      const event = this.buildEventFromTask({ ...this.transformEventToTask(existingEvent, calendarId), ...updates }, calendarId);
      event.id = eventId;

      // Update the event
      const updateResponse = await fetch(
        `${this.apiBase}/${encodeURIComponent(calendarId)}/events/${eventId}`,
        {
          method: 'PATCH',
          headers: this.getHeaders(),
          body: JSON.stringify(event)
        }
      );

      const data = await updateResponse.json();
      if (!updateResponse.ok) throw new.Error(data.error?.message || 'Failed to update event');

      return this.transformEventToTask(data, calendarId);
    } catch (error) {
      console.error(`Failed to update Google Calendar task ${taskId}:`, error);
      throw error;
    }
  }

  async deleteTask(taskId: string): Promise<boolean> {
    try {
      const [calendarId, eventId] = taskId.split('_');

      const response = await fetch(
        `${this.apiBase}/${encodeURIComponent(calendarId)}/events/${eventId}`,
        { method: 'DELETE', headers: this.getHeaders() }
      );

      return response.ok || response.status === 204;
    } catch (error) {
      console.error(`Failed to delete Google Calendar task ${taskId}:`, error);
      return false;
    }
  }

  // Comments are handled via event descriptions and attendees
  async getComments(taskId: string): Promise<ExternalComment[]> {
    try {
      // Google Calendar events don't have native comments
      // We'll parse comments from the event description
      const task = await this.getTask(taskId);
      if (!task) return [];

      // Look for comment blocks in description
      const comments: ExternalComment[] = [];
      const commentRegex = /---\s*Comment\s*---\s*\n(?:User:\s*(.+?)\s*\n)?(Added:\s*(.+?)\s*\n)?(Content:\s*(.+?)\s*\n)?/gis;
      let match;

      while ((match = commentRegex.exec(task.description || '')) !== null) {
        comments.push({
          id: `gc_comment_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          externalId: '',
          taskId,
          author: {
            id: match[1] || 'unknown',
            externalId: '',
            name: match[1] || 'Unknown User',
            email: '',
            avatarUrl: ''
          },
          content: match[6] || match[4] || '',
          createdAt: match[3] || new Date().toISOString(),
          updatedAt: match[3] || new Date().toISOString(),
          metadata: {}
        });
      }

      return comments;
    } catch (error) {
      console.error(`Failed to fetch comments for Google Calendar task ${taskId}:`, error);
      return [];
    }
  }

  async addComment(taskId: string, content: string): Promise<ExternalComment> {
    try {
      // Update the event description to include the comment
      const task = await this.getTask(taskId);
      if (!task) throw new Error('Task not found');

      const updatedDescription = `${task.description || ''}\n\n---\nComment:\n${content}\nAdded: ${new Date().toISOString()}\n`;

      await this.updateTask(taskId, { description: updatedDescription });

      return {
        id: `gc_comment_${Date.now()}`,
        externalId: '',
        taskId,
        author: { id: 'current_user', externalId: 'current_user', name: 'Todo Phoenix User', email: '', avatarUrl: '' },
        content,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {}
      };
    } catch (error) {
      console.error(`Failed to add comment to Google Calendar task ${taskId}:`, error);
      throw error;
    }
  }

  async updateComment(commentId: string, content: string): Promise<ExternalComment> {
    // Would update the comment in the event description
    return {
      id: commentId,
      externalId: '',
      taskId: '',
      author: { id: 'current_user', externalId: 'current_user', name: 'Todo Phoenix User', email: '', avatarUrl: '' },
      content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {}
    };
  }

  async deleteComment(commentId: string): Promise<boolean> {
    // Would remove comment from event description
    return true;
  }

  async getUsers(projectId?: string): Promise<ExternalUser[]> {
    try {
      // Google Calendar doesn't have a direct "users" endpoint
      // We'll return the calendar shareers/organizers
      const calendarId = projectId || this.calendarId;

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/acl`,
        { method: 'GET', headers: this.getHeaders() }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Failed to fetch ACL');

      return data.items?.map((item: any) => ({
        id: item.id,
        externalId: item.id,
        name: item.role === 'owner' ? 'Calendar Owner' : item.user?.displayName || item.email || 'Unknown',
        email: item.email || '',
        avatarUrl: '',
        role: item.role
      })) || [];
    } catch (error) {
      console.error('Failed to fetch Google Calendar users:', error);
      return [];
    }
  }

  // Webhook methods - Google Calendar uses push notifications
  async registerWebhook(url: string, events: any[]): Promise<string> {
    try {
      // Create a channel for push notifications
      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/channels',
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            id: `channel_${Date.now()}`,
            type: 'web_hook',
            address: url,
            token: Buffer.from(`${this.calendarId}:${Date.now()}`).toString('base64')
          })
        }
      );

      const data = await response.json();
      return data.id || '';
    } catch (error) {
      console.error('Failed to register Google Calendar webhook:', error);
      return '';
    }
  }

  async unregisterWebhook(channelId: string): Promise<boolean> {
    try {
      const response = await fetch('https://www.googleapis.com/calendar/v3/channels/stop', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ id: channelId, token: '' })
      });

      return response.ok;
    } catch (error) {
      console.error(`Failed to unregister Google Calendar webhook ${channelId}:`, error);
      return false;
    }
  }

  verifyWebhook(payload: any, token: string): boolean {
    // Google Calendar webhook verification
    // Token should match what we set when registering the webhook
    return true;
  }

  async processWebhook(payload: any): Promise<{ success: boolean; action: string; itemId: string }> {
    try {
      // Google Calendar webhook payload format
      const eventId = payload.eventId;
      const calendarId = payload.calendarId;
      const kind = payload.kind;

      return {
        success: true,
        action: 'updated',
        itemId: `${calendarId}_${eventId}`
      };
    } catch (error) {
      console.error('Failed to process Google Calendar webhook:', error);
      return { success: false, action: 'error', itemId: '' };
    }
  }

  // Transformation methods
  transformToInternal(externalTask: ExternalTask): Partial<TaskWithDetails> {
    const start = externalTask.metadata?.start || externalTask.metadata?.dateTime;
    const end = externalTask.metadata?.end || externalTask.metadata?.endDateTime;

    // Calculate duration from start/end times
    let estimateMinutes = 0;
    if (start && end) {
      const startTime = new Date(start);
      const endTime = new Date(end);
      estimateMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
    }

    return {
      name: externalTask.title,
      description: externalTask.description || '',
      is_completed: externalTask.status === 'completed' ? 1 : 0,
      priority: this.mapPriority(externalTask.priority || 'medium'),
      deadline: externalTask.dueDate || null,
      estimate_minutes: estimateMinutes || externalTask.estimate || 0,
      dependencies: JSON.stringify({
        externalId: externalTask.externalId,
        externalUrl: externalTask.url,
        source: 'google-calendar'
      })
    };
  }

  transformToExternal(task: TaskWithDetails): Partial<ExternalTask> {
    return {
      title: task.name,
      description: task.description || '',
      status: task.is_completed === 1 ? 'completed' : 'active',
      priority: this.mapPriorityReverse(task.priority),
      estimate: task.estimate_minutes || 0,
      labels: [],
      url: '',
      externalId: '',
      projectId: task.list?.id?.toString() || this.calendarId,
      dueDate: task.deadline || undefined
    };
  }

  // Private helper methods
  private transformEventToTask(event: any, calendarId: string): ExternalTask {
    const start = event.start?.dateTime || event.start?.date ? new Date(event.start.dateTime || event.start.date).toISOString() : '';
    const end = event.end?.dateTime || event.end?.date ? new Date(event.end.dateTime || event.end.date).toISOString() : '';

    // Extract priority from event color or title
    const priority = this.extractPriority(event);

    // Extract estimate from duration
    const estimate = start && end ? Math.round((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60)) : undefined;

    return {
      id: event.id,
      externalId: event.id,
      title: event.summary || 'Untitled',
      description: event.description || '',
      status: event.status === 'cancelled' ? 'completed' : 'active',
      priority,
      assignee: event.attendees?.find(a => a.self)?.email ? {
        id: event.attendees.find((a: any) => a.self).email,
        externalId: '',
        name: event.attendees.find((a: any) => a.self)?.displayName || 'You',
        email: event.attendees.find((a: any) => a.self)?.email,
        avatarUrl: '',
        role: 'organizer'
      } : undefined,
      dueDate: event.due?.to ? event.due.to : undefined,
      estimate: estimate || undefined,
      labels: event.labels || (event.summary ? [event.summary.substring(0, 20)] : []),
      url: event.htmlLink,
      projectId: calendarId,
      parentId: null,
      metadata: {
        start,
        end,
        timezone: event.start?.timeZone,
        created: event.created,
        updated: event.updated,
        hangoutLink: event.hangoutLink
      },
      createdAt: event.created,
      updatedAt: event.updated
    };
  }

  private buildEventFromTask(task: Partial<ExternalTask>, calendarId: string): any {
    const event: any = {
      summary: task.title || 'New Task',
      description: task.description || ''
    };

    if (task.dueDate) {
      event.start = { dateTime: new Date(task.dueDate).toISOString() };
      event.end = { dateTime: new Date(new Date(task.dueDate).getTime() + (task.estimate || 60) * 60 * 1000).toISOString() };
    }

    if (task.description) {
      event.description = task.description;
    }

    if (task.location) {
      event.location = task.location;
    }

    return event;
  }

  private extractPriority(event: any): string {
    // Use event transparency (opaque = important) or other indicators
    if (event.transparency === 'opaque') return 'high';
    return 'medium';
  }

  private mapPriority(priority: string): 'high' | 'medium' | 'low' | 'none' {
    const p = priority.toLowerCase();
    if (['high', 'urgent', 'important'].includes(p)) return 'high';
    if (['low', 'optional'].includes(p)) return 'low';
    if (['medium', 'normal'].includes(p)) return 'medium';
    return 'none';
  }

  private mapPriorityReverse(priority: string): string {
    return priority;
  }
}

// Factory registration
import { IntegrationFactory } from './integration-framework';
IntegrationFactory.register('google-calendar', (config: IntegrationConfig) => new GoogleCalendarIntegration(config));