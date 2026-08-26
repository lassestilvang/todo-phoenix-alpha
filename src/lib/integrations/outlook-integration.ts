import { BaseIntegration, IntegrationConfig, ExternalTask, ExternalComment, ExternalUser, ExternalProject } from './integration-framework';
import fetch from 'node-fetch';

/**
 * Outlook / Microsoft 365 Integration
 * Syncs tasks with Outlook tasks and Planner
 */
export class OutlookIntegration extends BaseIntegration {
  private apiBase = 'https://graph.microsoft.com/v1.0';

  constructor(config: IntegrationConfig) {
    super(config);

    if (!config.credentials.accessToken) {
      throw new Error('Outlook integration requires access token');
    }
  }

  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.config.credentials.accessToken}`,
      'Content-Type': 'application/json'
    };
  }

  async authenticate(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBase}/me`, {
        method: 'GET',
        headers: this.getHeaders()
      });
      return response.ok;
    } catch (error) {
      console.error('Outlook authentication failed:', error);
      return false;
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const authenticated = await this.authenticate();
      if (!authenticated) {
        return { success: false, message: 'Outlook authentication failed' };
      }

      // Get user's mailbox info
      const response = await fetch(`${this.apiBase}/me`, { method: 'GET', headers: this.getHeaders() });
      const data = await response.json();

      if (response.ok) {
        return { success: true, message: `Outlook connection successful (${data.displayName || 'User'})` };
      } else {
        return { success: false, message: 'Outlook mailbox access denied' };
      }
    } catch (error) {
      return { success: false, message: `Outlook connection error: ${error instanceof Error ? error.message : 'Unknown'}` };
    }
  }

  // For Outlook, each mailbox folder can be a project
  async getProjects(): Promise<ExternalProject[]> {
    try {
      // Get user's folders (task folders)
      const response = await fetch(`${this.apiBase}/me/mailFolders`, {
        method: 'GET', headers: this.getHeaders()
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Failed to fetch Outlook folders');

      return (data?.value || []).map((folder: any) => ({
        id: folder.id,
        externalId: folder.id,
        name: folder.displayName,
        description: folder.displayName,
        key: folder.id,
        url: `https://outlook.office.com/mail/${folder.id}`,
        color: '#0078D4',
        members: [],
        metadata: {
          type: folder.type,
          unreadCount: folder.unreadCount,
          totalCount: folder.totalCount
        }
      }));
    } catch (error) {
      console.error('Failed to fetch Outlook projects:', error);
      return [];
    }
  }

  async getProject(projectId: string): Promise<ExternalProject | null> {
    try {
      const response = await fetch(`${this.apiBase}/me/mailFolders/${projectId}`, {
        method: 'GET', headers: this.getHeaders()
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error?.message || 'Failed to fetch Outlook folder');

      return {
        id: data.id,
        externalId: data.id,
        name: data.displayName,
        description: data.displayName,
        key: data.id,
        url: `https://outlook.office.com/mail/${data.id}`,
        color: '#0078D4',
        members: [],
        metadata: {
          type: data.type,
          unreadCount: data.unreadCount,
          totalCount: data.totalCount
        }
      };
    } catch (error) {
      console.error(`Failed to fetch Outlook project ${projectId}:`, error);
      return null;
    }
  }

  // For Outlook, tasks map to tasks in task folders
  async getTasks(projectId?: string, filters?: IntegrationFilters): Promise<ExternalTask[]> {
    try {
      const folderId = projectId || this.config.credentials.workspaceId || 'msgfolderroot';
      if (!folderId) {
        const projects = await this.getProjects();
        if (projects.length === 0) return [];
        folderId = projects[0].id;
      }

      // Build query parameters
      const params = new URLSearchParams({
        '$filter': `isPrivate eq false`,
        '$orderBy': 'createdDateTime desc',
        '$top': '50'
      });

      // Add date filters
      if (filters?.dateRange) {
        params.append('$filter', `createdDateTime ge ${new Date(filters.dateRange.start).toISOString()} and createdDateTime le ${new Date(filters.dateRange.end).toISOString()}`);
      }

      const response = await fetch(
        `${this.apiBase}/me/tasks/folders/${folderId}/tasks?${params.toString()}`,
        { method: 'GET', headers: this.getHeaders() }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Failed to fetch Outlook tasks');

      return (data?.value || []).map((task: any) => this.transformOutlookTaskToExternal(task));
    } catch (error) {
      console.error('Failed to fetch Outlook tasks:', error);
      return [];
    }
  }

  async getTask(taskId: string): Promise<ExternalTask | null> {
    try {
      const response = await fetch(
        `${this.apiBase}/me/tasks/${taskId}`,
        { method: 'GET', headers: this.getHeaders() }
      );
      const data = await response.json();

      if (!response.ok) throw new Error(data.error?.message || 'Failed to fetch Outlook task');

      return this.transformOutlookTaskToExternal(data);
    } catch (error) {
      console.error(`Failed to fetch Outlook task ${taskId}:`, error);
      return null;
    }
  }

  async createTask(task: Partial<ExternalTask>): Promise<ExternalTask> {
    try {
      const folderId = task.projectId || this.config.credentials.workspaceId || 'msgfolderroot';

      const response = await fetch(
        `${this.apiBase}/me/tasks`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            importance: this.mapImportance(task.priority || 'medium'),
            bodies: [{ content: task.description || '' }],
            dueDateTime: task.dueDate ? { dateTime: task.dueDate, timeZone: 'UTC' } : undefined,
            subject: task.title || 'New Task',
            categories: this.mapCategories(task.priority || 'medium')
          })
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Failed to create Outlook task');

      return this.transformOutlookTaskToExternal(data);
    } catch (error) {
      console.error('Failed to create Outlook task:', error);
      throw error;
    }
  }

  async updateTask(taskId: string, updates: Partial<ExternalTask>): Promise<ExternalTask> {
    try {
      const response = await fetch(
        `${this.apiBase}/me/tasks/${taskId}`,
        {
          method: 'PATCH',
          headers: this.getHeaders(),
          body: JSON.stringify({
            importance: this.mapImportance(updates.priority || 'medium'),
            bodies: [{ content: updates.description || '' }],
            dueDateTime: updates.dueDate ? { dateTime: updates.dueDate, timeZone: 'UTC' } : undefined,
            subject: updates.title
          })
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Failed to update Outlook task');

      return this.transformOutlookTaskToExternal(data);
    } catch (error) {
      console.error(`Failed to update Outlook task ${taskId}:`, error);
      throw error;
    }
  }

  async deleteTask(taskId: string): Promise<boolean> {
    try {
      await fetch(`${this.apiBase}/me/tasks/${taskId}`, { method: 'DELETE', headers: this.getHeaders() });
      return true;
    } catch (error) {
      console.error(`Failed to delete Outlook task ${taskId}:`, error);
      return false;
    }
  }

  async getComments(taskId: string): Promise<ExternalComment[]> {
    try {
      const response = await fetch(
        `${this.apiBase}/me/tasks/${taskId}/threads`,
        { method: 'GET', headers: this.getHeaders() }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Failed to fetch Outlook comments');

      return (data?.value || []).map((thread: any) => ({
        id: `outlook_comment_${thread.id}`,
        externalId: thread.id,
        taskId,
        author: {
          id: thread.from?.id || thread.sender?.id || '',
          externalId: thread.from?.id || thread.sender?.id || '',
          name: thread.from?.displayName || thread.sender?.displayName || 'Unknown User',
          email: thread.from?.emailAddress?.address || '',
          avatarUrl: ''
        },
        content: thread.body?.content?.trim() || thread.body?.trim() || '',
        createdAt: thread.createdDateTime,
        updatedAt: thread.lastModifiedDateTime,
        metadata: { isAnswered: thread.isAnswered }
      }));
    } catch (error) {
      console.error(`Failed to fetch comments for Outlook task ${taskId}:`, error);
      return [];
    }
  }

  async addComment(taskId: string, content: string): Promise<ExternalComment> {
    try {
      const response = await fetch(
        `${this.apiBase}/me/tasks/${taskId}/threads`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            messageType: 'reply',
            body: { content: content }
          })
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Failed to add Outlook comment');

      return {
        id: `outlook_comment_${data.id}`,
        externalId: data.id,
        taskId,
        author: { id: 'current_user', externalId: 'current_user', name: 'Todo Phoenix User', email: '', avatarUrl: '' },
        content,
        createdAt: data.lastModifiedDateTime,
        updatedAt: data.lastModifiedDateTime,
        metadata: {}
      };
    } catch (error) {
      console.error(`Failed to add comment to Outlook task ${taskId}:`, error);
      throw error;
    }
  }

  async updateComment(commentId: string, content: string): Promise<ExternalComment> {
    try {
      await fetch(
        `${this.apiBase}/me/tasks/${commentId}/threads`,
        {
          method: 'PATCH',
          headers: this.getHeaders(),
          body: JSON.stringify({
            messageType: 'reply',
            body: { content: content }
          })
        }
      );

      return {
        id: commentId,
        externalId: commentId,
        taskId: '',
        author: { id: 'current_user', externalId: 'current_user', name: 'Todo Phoenix User', email: '', avatarUrl: '' },
        content,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {}
      };
    } catch (error) {
      console.error(`Failed to update comment ${commentId}:`, error);
      throw error;
    }
  }

  async deleteComment(commentId: string): Promise<boolean> {
    try {
      await fetch(`${this.apiBase}/me/tasks/${commentId}/threads`, { method: 'DELETE', headers: this.getHeaders() });
      return true;
    } catch (error) {
      console.error(`Failed to delete comment ${commentId}:`, error);
      return false;
    }
  }

  async getUsers(projectId?: string): Promise<ExternalUser[]> {
    try {
      const response = await fetch(`${this.apiBase}/me/messages?$top=1`, {
        method: 'GET', headers: this.getHeaders()
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error?.message || 'Failed to fetch Outlook users');

      // Extract from message senders
      const senders = (data?.value || [])
        .map((m: any) => m.from || m.sender)
        .filter((s: any) => s?.emailAddress);

      return senders?.map((s: any) => ({
        id: s.id,
        externalId: s.id,
        name: s.displayName || s.emailAddress?.address || 'Unknown User',
        email: s.emailAddress?.address || '',
        avatarUrl: '',
        role: 'user'
      })) || [];
    } catch (error) {
      console.error('Failed to fetch Outlook users:', error);
      return [];
    }
  }

  // Webhook methods
  async registerWebhook(url: string, events: any[]): Promise<string> {
    try {
      // Create subscription for Outlook tasks
      const response = await fetch(`${this.apiBase}/subscriptions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          id: `subscription_${Date.now()}`,
          changeType: 'created',
          notificationUrl: url,
          resource: 'me/tasks',
          expirationDateTime: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString() // 8 hours
        })
      });

      const data = await response.json();
      return data.id || '';
    } catch (error) {
      console.error('Failed to register Outlook webhook:', error);
      return '';
    }
  }

  async unregisterWebhook(webhookId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBase}/subscriptions/${webhookId}`, {
        method: 'DELETE', headers: this.getHeaders()
      });
      return response.ok;
    } catch (error) {
      console.error(`Failed to unregister Outlook webhook ${webhookId}:`, error);
      return false;
    }
  }

  verifyWebhook(payload: any, signature: string): boolean {
    // Outlook webhook verification
    return true;
  }

  async processWebhook(payload: any): Promise<{ success: boolean; action: string; itemId: string }> {
    try {
      const changeType = payload.changeType;
      const resourceData = payload.resourceData;

      return {
        success: true,
        action: changeType === 'created' ? 'created' : 'updated',
        itemId: resourceData?.id || ''
      };
    } catch (error) {
      console.error('Failed to process Outlook webhook:', error);
      return { success: false, action: 'error', itemId: '' };
    }
  }

  // Transformation methods
  transformToInternal(externalTask: ExternalTask): Partial<TaskWithDetails> {
    return {
      name: externalTask.title,
      description: externalTask.description || '',
      is_completed: this.mapOutlookStatusToInternal(externalTask.status),
      priority: this.mapPriority(externalTask.priority || 'medium'),
      deadline: externalTask.dueDate || null,
      estimate_minutes: this.parseOutlookEstimate(externalTask.description || '') || 0,
      dependencies: JSON.stringify({
        externalId: externalTask.externalId,
        externalUrl: externalTask.url,
        source: 'outlook'
      })
    };
  }

  transformToExternal(task: TaskWithDetails): Partial<ExternalTask> {
    return {
      title: task.name,
      description: task.description || '',
      status: this.mapOutlookStatusToExternal(task.is_completed),
      priority: this.mapPriorityReverse(task.priority),
      estimate: task.estimate_minutes || 0,
      labels: [],
      url: '',
      externalId: ''
    };
  }

  // Private helpers
  private mapImportance(priority: string): 'low' | 'normal' | 'high' {
    switch (priority.toLowerCase()) {
      case 'high': return 'high';
      case 'low': return 'low';
      default: return 'normal';
    }
  }

  private mapOutlookStatusToInternal(outlookStatus: string): number {
    const doneStatuses = ['completed', 'finished'];
    return doneStatuses.some(s => s.toLowerCase().includes(outlookStatus.toLowerCase())) ? 1 : 0;
  }

  private mapOutlookStatusToExternal(internalStatus: number): string {
    return internalStatus === 1 ? 'completed' : 'normal';
  }

  private mapPriority(priority: string): 'high' | 'medium' | 'low' | 'none' {
    switch (priority.toLowerCase()) {
      case 'high': return 'high';
      case 'low': return 'low';
      default: return 'medium';
    }
  }

  private mapPriorityReverse(priority: string): string {
    return priority;
  }

  private parseOutlookEstimate(description: string): number | undefined {
    // Look for patterns like (2h), (30m), or "2 hours", "30 minutes"
    const timeMatch = description.match(/\((\d+(?:\.\d+)?)\s*h\)/i);
    if (timeMatch) {
      return parseFloat(timeMatch[1]) * 60;
    }

    const hoursMatch = description.match(/\b(\d+)\s*hours?/i);
    if (hoursMatch) {
      return parseFloat(hoursMatch[1]) * 60;
    }

    const minutesMatch = description.match(/\b(\d+)\s*minutes?/i);
    if (minutesMatch) {
      return parseFloat(minutesMatch[1]);
    }

    return undefined;
  }
}

// Factory registration
import { IntegrationFactory } from './integration-framework';
IntegrationFactory.register('outlook', (config: IntegrationConfig) => new OutlookIntegration(config));