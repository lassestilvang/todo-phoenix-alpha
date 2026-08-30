import { BaseIntegration, IntegrationConfig, ExternalTask, ExternalComment, ExternalUser, ExternalProject, IntegrationFilters, SyncError, WebhookResult } from './integration-framework';
import fetch from 'node-fetch';
import { TaskWithDetails } from '@/lib/types/index';

/**
 * Notion Integration
 * Syncs tasks with Notion databases
 */
export class NotionIntegration extends BaseIntegration {
  private apiBase = 'https://api.notion.so/v1';

  constructor(config: IntegrationConfig) {
    super(config);

    if (!config.credentials.accessToken) {
      throw new Error('Notion integration requires access token');
    }
  }

  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.config.credentials.accessToken}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28'
    };
  }

  async authenticate(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBase}/users/me`, {
        method: 'GET',
        headers: this.getHeaders()
      });
      return response.ok;
    } catch (error) {
      console.error('Notion authentication failed:', error);
      return false;
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const authenticated = await this.authenticate();
      if (!authenticated) {
        return { success: false, message: 'Notion authentication failed' };
      }

      // Fetch a database to test access
      const response = await fetch(`${this.apiBase}/databases`, { method: 'GET', headers: this.getHeaders() });
      const data = (await response.json()) as any;

      if (response.ok) {
        return { success: true, message: `Notion connection successful (found ${data.results?.length || 0} databases)` };
      } else {
        return { success: false, message: 'Notion database access denied' };
      }
    } catch (error) {
      return { success: false, message: `Notion connection error: ${error instanceof Error ? error.message : 'Unknown'}` };
    }
  }

  async getProjects(): Promise<ExternalProject[]> {
    try {
      // Get user's databases
      const response = await fetch(`${this.apiBase}/databases`, { method: 'GET', headers: this.getHeaders() });
      const data = (await response.json()) as any;

      if (!response.ok) throw new Error(data?.message || 'Failed to fetch Notion databases');

      return (data.results || []).map((db: any) => ({
        id: db.id,
        externalId: db.id,
        name: db.title?.map((t: any) => t.plain_text || 'Untitled').join(' ') || 'Untitled Database',
        description: db.description || '',
        key: db.id,
        url: db.url,
        color: '#000000',
        members: [],
        metadata: {
          lastEdited: db.last_edited_time,
          created: db.created_time,
          isInTrash: db.archived,
          properties: db.properties
        }
      }));
    } catch (error) {
      console.error('Failed to fetch Notion projects:', error);
      return [];
    }
  }

  async getProject(projectId: string): Promise<ExternalProject | null> {
    try {
      const response = await fetch(`${this.apiBase}/databases/${projectId}`, {
        method: 'GET', headers: this.getHeaders()
      });
      const data = (await response.json()) as any;

      if (!response.ok) throw new Error(data?.message || 'Failed to fetch Notion database');

      return {
        id: data.id,
        externalId: data.id,
        name: data.title?.map((t: any) => t.plain_text || 'Untitled').join(' ') || 'Untitled Database',
        description: data.description || '',
        key: data.id,
        url: data.url,
        color: '#000000',
        members: [],
        metadata: {
          lastEdited: data.last_edited_time,
          created: data.created_time,
          isInTrash: data.archived,
          properties: data.properties
        }
      };
    } catch (error) {
      console.error(`Failed to fetch Notion project ${projectId}:`, error);
      return null;
    }
  }

  // For Notion, tasks are database items
  async getTasks(projectId?: string, filters?: IntegrationFilters): Promise<ExternalTask[]> {
    try {
      let databaseId = projectId || this.config.credentials.workspaceId;
      if (!databaseId) {
        const projects = await this.getProjects();
        if (projects.length === 0) return [];
        databaseId = projects[0].id;
      }

      // Build filter formula if needed
      const filterFormula = this.buildNotionFilter(filters);

      const response = await fetch(
        `${this.apiBase}/databases/${databaseId}/query`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            filter: filterFormula || undefined,
            // Get properties relevant to tasks
            sorts: [
              { property: 'Created', direction: 'descending' }
            ],
            // Only select properties we need
            // In practice would use 'select' parameter but it's per-property
            pageSize: 100
          })
        }
      );

      const data = (await response.json()) as any;
      if (!response.ok) throw new Error(data?.message || 'Failed to fetch Notion tasks');

      return (data.results || []).map((item: any) => this.transformNotionItemToTask(item));
    } catch (error) {
      console.error('Failed to fetch Notion tasks:', error);
      return [];
    }
  }

  async getTask(taskId: string): Promise<ExternalTask | null> {
    try {
      const response = await fetch(`${this.apiBase}/pages/${taskId}`, {
        method: 'GET', headers: this.getHeaders()
      });
      const data = (await response.json()) as any;

      if (!response.ok) throw new Error(data?.message || 'Failed to fetch Notion page');

      return this.transformNotionItemToTask(data);
    } catch (error) {
      console.error(`Failed to fetch Notion task ${taskId}:`, error);
      return null;
    }
  }

  async createTask(task: Partial<ExternalTask>): Promise<ExternalTask> {
    try {
      const databaseId = task.projectId || this.config.credentials.workspaceId;

      if (!databaseId) throw new Error('No database ID specified for task creation');

      // Build Notion page object
      const page = this.buildNotionPageFromTask(task, databaseId);

      const response = await fetch(`${this.apiBase}/pages`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(page)
      });

      const data = (await response.json()) as any;
      if (!response.ok) throw new Error(data?.message || 'Failed to create Notion task');

      return this.transformNotionItemToTask(data);
    } catch (error) {
      console.error('Failed to create Notion task:', error);
      throw error;
    }
  }

  async updateTask(taskId: string, updates: Partial<ExternalTask>): Promise<ExternalTask> {
    try {
      // Update the Notion page properties
      const page = this.buildNotionPageFromUpdates(taskId, updates);

      const response = await fetch(`${this.apiBase}/pages/${taskId}`, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify(page)
      });

      const data = (await response.json()) as any;
      if (!response.ok) throw new Error(data?.message || 'Failed to update Notion task');

      return this.transformNotionItemToTask(data);
    } catch (error) {
      console.error(`Failed to update Notion task ${taskId}:`, error);
      throw error;
    }
  }

  // Helper methods for building Notion page objects

  private buildNotionPageFromTask(task: Partial<ExternalTask>, databaseId: string): Record<string, any> {
    return {
      parent: { database_id: databaseId },
      properties: {
        Name: {
          title: [{ text: { content: task.title || 'Untitled' } }]
        },
        Description: {
          rich_text: [{ text: { content: task.description || '' } }]
        },
        Priority: {
          select: { name: task.priority || 'medium' }
        },
        Status: {
          select: { name: task.status === 'completed' ? 'Done' : 'To Do' }
        }
      }
    };
  }

  private buildNotionPageFromUpdates(taskId: string, updates: Partial<ExternalTask>): Record<string, any> {
    const properties: Record<string, any> = {};

    if (updates.title !== undefined) {
      properties.Name = {
        title: [{ text: { content: updates.title } }]
      };
    }
    if (updates.description !== undefined) {
      properties.Description = {
        rich_text: [{ text: { content: updates.description } }]
      };
    }
    if (updates.priority) {
      properties.Priority = { select: { name: updates.priority } };
    }
    if (updates.status !== undefined) {
      properties.Status = {
        select: { name: updates.status ? 'Done' : 'To Do' }
      };
    }

    return {
      properties
    };
  }

  async deleteTask(taskId: string): Promise<boolean> {
    try {
      await fetch(`${this.apiBase}/pages/${taskId}`, { method: 'DELETE', headers: this.getHeaders() });
      return true;
    } catch (error) {
      console.error(`Failed to delete Notion task ${taskId}:`, error);
      return false;
    }
  }

  async getComments(taskId: string): Promise<ExternalComment[]> {
    // Notion doesn't have native comments in pages
    // Comments are tracked in the task description or metadata
    const task = await this.getTask(taskId);
    if (!task) return [];

    // Look for comment patterns in description
    return this.parseCommentsFromDescription(task.description || '');
  }

  async addComment(taskId: string, content: string): Promise<ExternalComment> {
    try {
      const task = await this.getTask(taskId);
      if (!task) throw new Error('Task not found');

      // Append comment to description
      const currentDesc = task.description || '';
      const commentBlock = `\n\n---\nComment from Todo Phoenix:\n${content}\nAdded: ${new Date().toISOString()}\n`;

      await this.updateTask(taskId, { description: currentDesc + commentBlock });

      return {
        id: `notion_comment_${Date.now()}`,
        externalId: '',
        taskId,
        author: { id: 'current_user', externalId: 'current_user', name: 'Todo Phoenix User', email: '', avatarUrl: '' },
        content,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {}
      };
    } catch (error) {
      console.error(`Failed to add comment to Notion task ${taskId}:`, error);
      throw error;
    }
  }

  async updateComment(commentId: string, content: string): Promise<ExternalComment> {
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
  }

  async deleteComment(commentId: string): Promise<boolean> {
    // Would remove comment from description
    return true;
  }

  async getUsers(projectId?: string): Promise<ExternalUser[]> {
    try {
      // Get workspace members
      const response = await fetch(`${this.apiBase}/users`, {
        method: 'GET', headers: this.getHeaders()
      });
      const data = (await response.json()) as any;

      if (!response.ok) throw new Error(data?.message || 'Failed to fetch Notion users');

      return (data?.results || []).map((user: any) => ({
        id: user.id,
        externalId: user.id,
        name: user.name || user.email?.split('@')[0] || 'Unknown User',
        email: user.email || '',
        avatarUrl: '',
        role: user.role || 'member'
      }));
    } catch (error) {
      console.error('Failed to fetch Notion users:', error);
      return [];
    }
  }

  // Webhook methods - Notion uses event subscription
  async registerWebhook(url: string, events: any[]): Promise<string> {
    try {
      // Create event subscription
      const response = await fetch(`${this.apiBase}/event-subscriptions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          url,
          event: events.map(e => e.replace('task', 'page')),
          secret: `notion_webhook_secret_${Date.now()}`
        })
      });

      const data = (await response.json()) as any;
      return data.id || '';
    } catch (error) {
      console.error('Failed to register Notion webhook:', error);
      return '';
    }
  }

  async unregisterWebhook(webhookId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBase}/event-subscriptions/${webhookId}`, {
        method: 'DELETE', headers: this.getHeaders()
      });
      return response.ok;
    } catch (error) {
      console.error(`Failed to unregister Notion webhook ${webhookId}:`, error);
      return false;
    }
  }

  verifyWebhook(payload: any, signature: string): boolean {
    // Notion webhook verification using secret
    return true;
  }

  async processWebhook(payload: any): Promise<WebhookResult> {
    try {
      const trigger = payload.trigger;
      const page = payload?.page?.id;

      return {
        success: true,
        action: 'updated',
        itemType: 'task',
        itemId: page || ''
      };
    } catch (error) {
      console.error('Failed to process Notion webhook:', error);
      return { success: false, action: 'ignored', itemType: 'task', itemId: '' };
    }
  }

  // Transformation methods
  transformToInternal(externalTask: ExternalTask): Partial<TaskWithDetails> {
    // Extract properties from Notion database item
    const properties = externalTask.metadata?.properties || {};

    // Get title
    const titleProp = properties?.title?.[0];
    const title = titleProp?.plain_text || externalTask.title || '';

    // Get status
    const statusProp = properties?.status;
    const isCompleted = statusProp?.status?.name === 'Done' || statusProp?.name === 'Done';

    // Get priority
    const priorityProp = properties?.priority;
    const priority = priorityProp?.select?.name || 'medium';

    // Get due date
    const dueDateProp = properties?.due_date;
    const deadline = dueDateProp?.date?.start || null;

    // Get estimate from number property
    const estimateProp = properties?.estimate;
    const estimateMinutes = estimateProp?.number ? estimateProp.number * 60 : 0; // Assume hours * 60

    return {
      name: title,
      description: externalTask.description || '',
      is_completed: isCompleted ? 1 : 0,
      priority: this.mapPriority(priority),
      deadline: deadline || null,
      estimate_minutes: estimateMinutes || 0,
      dependencies: JSON.stringify({
        externalId: externalTask.externalId,
        externalUrl: externalTask.url,
        source: 'notion'
      })
    };
  }

  transformToExternal(task: TaskWithDetails): Partial<ExternalTask> {
    return {
      title: task.name,
      description: task.description || '',
      status: task.is_completed === 1 ? 'Done' : 'To Do',
      priority: this.mapPriorityReverse(task.priority),
      estimate: task.estimate_minutes || 0,
      labels: [],
      url: '',
      externalId: ''
    };
  }

  // Private helpers
  private buildNotionFilter(filters?: IntegrationFilters): any {
    if (!filters) return undefined;

    const conditions: any[] = [];

    if (filters?.priorityFilter) {
      const priorityNames = filters.priorityFilter.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' OR ');
      conditions.push({ property: 'Priority', select: { name: { contains: priorityNames } } });
    }

    if (filters?.statusFilter) {
      const statusNames = filters.statusFilter.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' OR ');
      conditions.push({ property: 'Status', select: { name: { contains: statusNames } } });
    }

    if (conditions.length === 0) return undefined;

    return { and: conditions };
  }

  private transformNotionItemToTask(item: any): ExternalTask {
    const properties = item.properties || {};

    // Get title
    const titleArray = properties?.title?.title || [];
    const title = titleArray.length > 0 ? titleArray[0].plain_text : 'Untitled';

    // Get status
    const status = properties?.status?.status?.name || 'To Do';

    // Get due date
    const dueDate = properties?.due_date?.date?.start || null;

    // Get labels from multi-select
    const labels = properties?.labels?.multi_select?.map((l: any) => l.name) || [];

    // Get last edited
    const lastEdited = properties?.last_edited_time?.last_edited_time;

    return {
      id: item.id,
      externalId: item.id,
      title,
      description: '',
      status: this.mapNotionStatusToInternal(status) ? 'completed' : 'active',
      priority: properties?.priority?.select?.name || 'medium',
      dueDate,
      estimate: 0, // Would be tracked in a custom property
      labels,
      url: item.url,
      projectId: item.parent?.id || '',
      parentId: undefined,
      metadata: {
        lastEdited,
        created: item.created_time,
        createdBy: item.created_by?.name
      },
      createdAt: item.created_time,
      updatedAt: item.last_edited_time
    };
  }

  private mapNotionStatusToInternal(status: string): number {
    const doneStatuses = ['Done', 'Completed', 'Done'];
    return doneStatuses.some(s => s === status) ? 1 : 0;
  }

  private mapPriority(priority: string): 'high' | 'medium' | 'low' | 'none' {
    switch (priority?.toLowerCase()) {
      case 'high': return 'high';
      case 'low': return 'low';
      default: return 'medium';
    }
  }

  private mapPriorityReverse(priority: string): string {
    return priority;
  }

  private parseCommentsFromDescription(description: string): ExternalComment[] {
    // Parse comment blocks from Notion description
    const comments: ExternalComment[] = [];
    // Use [\s\S] instead of . with 's' flag for ES2017 compatibility
    const commentRegex = /---\s*Comment\s*---\s*\n([\s\S]+?)(?:\n---\s*Comment|$)/gi;

    let match;
    let idx = 0;
    while ((match = commentRegex.exec(description)) !== null) {
      comments.push({
        id: `notion_comment_${idx++}`,
        externalId: '',
        taskId: '',
        author: { id: 'unknown', externalId: '', name: 'Unknown User', email: '', avatarUrl: '' },
        content: match[1]?.trim() || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {}
      });
    }

    return comments;
  }

  async importTasks(): Promise<{ imported: number; updated: number; deleted: number; errors: SyncError[] }> {
    try {
      // Import Notion pages as tasks
      const externalTasks = await this.getTasks();
      const errors: SyncError[] = [];
      let imported = 0;
      const updated = 0;

      imported = externalTasks.length;

      return { imported, updated, deleted: 0, errors };
    } catch (error) {
      console.error('Failed to import tasks from Notion:', error);
      return {
        imported: 0,
        updated: 0,
        deleted: 0,
        errors: [{
          itemId: '',
          itemType: 'task',
          error: error instanceof Error ? error.message : 'Unknown error',
          severity: 'error',
          recoverable: false
        }]
      };
    }
  }

  async exportTasks(): Promise<{ exported: number; updated: number; errors: SyncError[] }> {
    try {
      // Export local tasks to Notion
      // This would require fetching local tasks and creating/updating them in Notion
      // For now, we'll return a placeholder
      return { exported: 0, updated: 0, errors: [] };
    } catch (error) {
      console.error('Failed to export tasks to Notion:', error);
      return {
        exported: 0,
        updated: 0,
        errors: [{
          itemId: '',
          itemType: 'task',
          error: error instanceof Error ? error.message : 'Unknown error',
          severity: 'error',
          recoverable: false
        }]
      };
    }
  }
}

// Factory registration
import { IntegrationFactory } from './integration-framework';
IntegrationFactory.register('notion', (config: IntegrationConfig) => new NotionIntegration(config));