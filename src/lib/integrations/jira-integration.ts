import { BaseIntegration, IntegrationConfig, ExternalTask, ExternalComment, ExternalUser, ExternalProject } from './integration-framework';
import fetch from 'node-fetch';

/**
 * Jira Integration
 * Syncs tasks with Jira issues, stories, and epics
 */
export class JiraIntegration extends BaseIntegration {
  private apiBase = 'https://your-domain.atlassian.net/rest/api/3';
  private projectKey: string;

  constructor(config: IntegrationConfig) {
    super(config);
    this.projectKey = config.credentials.projectId || '';

    if (!this.config.credentials.accessToken) {
      throw new Error('Jira integration requires API token');
    }
  }

  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Basic ${Buffer.from(`${this.config.credentials.apiKey || ''}:${this.config.credentials.accessToken}`).toString('base64')}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  async authenticate(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBase}/myself`, {
        method: 'GET',
        headers: this.getHeaders()
      });
      return response.ok;
    } catch (error) {
      console.error('Jira authentication failed:', error);
      return false;
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const authenticated = await this.authenticate();
      if (!authenticated) {
        return { success: false, message: 'Jira authentication failed' };
      }

      const response = await fetch(`${this.apiBase}/project/${this.projectKey}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, message: `Jira connection successful (${data.name})` };
      } else {
        return { success: false, message: 'Jira project access denied' };
      }
    } catch (error) {
      return { success: false, message: `Jira connection error: ${error instanceof Error ? error.message : 'Unknown'}` };
    }
  }

  async getProjects(): Promise<ExternalProject[]> {
    try {
      const response = await fetch(`${this.apiBase}/project`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.errorMessages?.join(', ') || 'Failed to fetch projects');

      return data.map((project: any) => ({
        id: project.id,
        externalId: project.id,
        name: project.name,
        description: project.description?.content || '',
        key: project.key,
        url: project.self,
        color: '#0062CC',
        members: [],
        metadata: {
          projectTypeKey: project.projectTypeKey,
          simplified: project.simplified,
          archived: project.archived
        }
      }));
    } catch (error) {
      console.error('Failed to fetch Jira projects:', error);
      return [];
    }
  }

  async getProject(projectId: string): Promise<ExternalProject | null> {
    try {
      const response = await fetch(`${this.apiBase}/project/${this.projectKey}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.errorMessages?.join(', ') || 'Failed to fetch project');

      return {
        id: data.id,
        externalId: data.id,
        name: data.name,
        description: data.description?.content || '',
        key: data.key,
        url: data.self,
        color: '#0062CC',
        members: [],
        metadata: {
          projectTypeKey: data.projectTypeKey,
          simplified: data.simplified,
          archived: data.archived
        }
      };
    } catch (error) {
      console.error(`Failed to fetch Jira project ${projectId}:`, error);
      return null;
    }
  }

  async getTasks(projectId?: string, filters?: IntegrationFilters): Promise<ExternalTask[]> {
    try {
      const jql = this.buildJQL(filters);

      const params = new URLSearchParams({
        jql: jql,
        maxResults: '50',
        fields: 'summary,description,status,priority,assignee,created,updated,duedate,labels,timespent'
      });

      const response = await fetch(
        `${this.apiBase}/search?${params.toString()}`,
        { method: 'GET', headers: this.getHeaders() }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.errorMessages?.join(', ') || 'Failed to fetch Jira issues');

      return data.issues?.map((issue: any) => this.transformIssueToJiraTask(issue)) || [];
    } catch (error) {
      console.error('Failed to fetch Jira tasks:', error);
      return [];
    }
  }

  async getTask(taskId: string): Promise<ExternalTask | null> {
    try {
      const response = await fetch(
        `${this.apiBase}/issue/${taskId}`,
        { method: 'GET', headers: this.getHeaders() }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.errorMessages?.join(', ') || 'Failed to fetch issue');

      return this.transformIssueToJiraTask(data);
    } catch (error) {
      console.error(`Failed to fetch Jira task ${taskId}:`, error);
      return null;
    }
  }

  async createTask(task: Partial<ExternalTask>): Promise<ExternalTask> {
    try {
      const jql = this.buildJQLForCreate(task);

      const response = await fetch(
        `${this.apiBase}/issue`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            fields: {
              project: { key: this.projectKey },
              summary: task.title || 'New Task',
              description: task.description || '',
              issuetype: { name: 'Task' },
              ...(task.estimate && { customfield_12345: task.estimate }), // Example custom field for estimate
              ...(task.dueDate && { duedate: task.dueDate }),
              ...(task.priority && { priority: { name: task.priority } })
            }
          })
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.errorMessages?.join(', ') || 'Failed to create issue');

      return this.transformIssueToJiraTask(data);
    } catch (error) {
      console.error('Failed to create Jira task:', error);
      throw error;
    }
  }

  async updateTask(taskId: string, updates: Partial<ExternalTask>): Promise<ExternalTask> {
    try {
      const updateData: any = { fields: {} };

      if (updates.title) updateData.fields.summary = updates.title;
      if (updates.description !== undefined) updateData.fields.description = updates.description || '';
      if (updates.assignee) updateData.fields.assignee = { accountId: updates.assignee.externalId };
      if (updates.priority) updateData.fields.priority = { name: updates.priority };
      if (updates.dueDate) updateData.fields.duedate = updates.dueDate;

      const response = await fetch(
        `${this.apiBase}/issue/${taskId}`,
        {
          method: 'PUT',
          headers: this.getHeaders(),
          body: JSON.stringify(updateData)
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.errorMessages?.join(', ') || 'Failed to update issue');

      return this.transformIssueToJiraTask(data);
    } catch (error) {
      console.error(`Failed to update Jira task ${taskId}:`, error);
      throw error;
    }
  }

  async deleteTask(taskId: string): Promise<boolean> {
    try {
      // In Jira, issues are typically transitioned to "Done" rather than deleted
      await this.updateTask(taskId, { status: 'completed' });
      return true;
    } catch (error) {
      console.error(`Failed to delete Jira task ${taskId}:`, error);
      return false;
    }
  }

  async getComments(taskId: string): Promise<ExternalComment[]> {
    try {
      const response = await fetch(
        `${this.apiBase}/issue/${taskId}/comment`,
        { method: 'GET', headers: this.getHeaders() }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.errorMessages?.join(', ') || 'Failed to fetch comments');

      return data.comments?.map((comment: any) => ({
        id: `jira_comment_${comment.id}`,
        externalId: comment.id.toString(),
        taskId,
        author: {
          id: comment.author?.accountId || comment.author?.id || '',
          externalId: comment.author?.accountId || comment.author?.id || '',
          name: comment.author?.displayName || comment.author?.name || 'Unknown User',
          email: comment.author?.emailAddress || '',
          avatarUrl: ''
        },
        content: comment.body?.content?.join(' ') || comment.body || '',
        createdAt: comment.created,
        updatedAt: comment.updated,
        metadata: {
          url: comment.author?.avatarUrls?.48x48
        }
      }): [];
    } catch (error) {
      console.error(`Failed to fetch comments for Jira task ${taskId}:`, error);
      return [];
    }
  }

  async addComment(taskId: string, content: string): Promise<ExternalComment> {
    try {
      const response = await fetch(
        `${this.apiBase}/issue/${taskId}/comment`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ body: content })
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.errorMessages?.join(', ') || 'Failed to add comment');

      return {
        id: `jira_comment_${data.id}`,
        externalId: data.id.toString(),
        taskId,
        author: {
          id: 'current_user',
          externalId: 'current_user',
          name: 'Todo Phoenix User',
          email: '',
          avatarUrl: ''
        },
        content,
        createdAt: data.created,
        updatedAt: data.updated,
        metadata: {}
      };
    } catch (error) {
      console.error(`Failed to add comment to Jira task ${taskId}:`, error);
      throw error;
    }
  }

  async updateComment(commentId: string, content: string): Promise<ExternalComment> {
    try {
      await fetch(
        `${this.apiBase}/issue/${commentId}`,
        {
          method: 'PUT',
          headers: this.getHeaders(),
          body: JSON.stringify({ body: { content: { content } } })
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
      await fetch(
        `${this.apiBase}/issue/${commentId}`,
        { method: 'DELETE', headers: this.getHeaders() }
      );
      return true;
    } catch (error) {
      console.error(`Failed to delete comment ${commentId}:`, error);
      return false;
    }
  }

  async getUsers(projectId?: string): Promise<ExternalUser[]> {
    try {
      const response = await fetch(`${this.apiBase}/user`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.errorMessages?.join(', ') || 'Failed to fetch users');

      // Filter to active users
      return data.users?.map((user: any) => ({
        id: user.accountId || user.id || '',
        externalId: user.accountId || user.id || '',
        name: user.displayName || user.name || 'Unknown User',
        email: user.emailAddress || `${user.name?.toLowerCase().replace(/\s+/g, '.')}@example.com`,
        avatarUrl: user.avatarUrl?.default,
        role: user.accountType || 'member'
      }): [];
    } catch (error) {
      console.error('Failed to fetch Jira users:', error);
      return [];
    }
  }

  // Webhook methods
  async registerWebhook(url: string, events: any[]): Promise<string> {
    try {
      // Create webhook in Jira
      const response = await fetch(
        `${this.apiBase}/webhooks`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            name: 'Webhook',
            url: url,
            event: events.map(e => e.replace('issue', 'jira:issue')), // Jira uses different event names
            active: true
          })
        }
      );

      const data = await response.json();
      return data.id ? data.id.toString() : '';
    } catch (error) {
      console.error('Failed to register Jira webhook:', error);
      return '';
    }
  }

  async unregisterWebhook(webhookId: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.apiBase}/webhooks/${webhookId}`,
        { method: 'DELETE', headers: this.getHeaders() }
      );
      return response.ok;
    } catch (error) {
      console.error(`Failed to unregister Jira webhook ${webhookId}:`, error);
      return false;
    }
  }

  verifyWebhook(payload: any, signature: string): boolean {
    // Jira webhook verification
    // Would verify the HMAC-SHA256 signature from X-Atlassian-Webhook-Id header
    return true;
  }

  async processWebhook(payload: any): Promise<{ success: boolean; action: string; itemId: string }> {
    try {
      const webItem = payload.webItem;
      const issue = webItem?.issue;

      if (!issue) return { success: true, action: 'ignored', itemId: '' };

      return {
        success: true,
        action: 'updated',
        itemId: issue.key
      };
    } catch (error) {
      console.error('Failed to process Jira webhook:', error);
      return { success: false, action: 'error', itemId: '' };
    }
  }

  // Transformation methods
  transformToInternal(externalTask: ExternalTask): Partial<TaskWithDetails> {
    return {
      name: externalTask.title,
      description: externalTask.description || '',
      is_completed: this.mapJiraStatusToInternal(externalTask.status),
      priority: this.mapPriority(externalTask.priority || 'medium'),
      deadline: externalTask.dueDate || null,
      estimate_minutes: this.parseEstimate(externalTask.description || '') || 0,
      dependencies: JSON.stringify({
        externalId: externalTask.externalId,
        externalUrl: externalTask.url,
        source: 'jira'
      })
    };
  }

  transformToExternal(task: TaskWithDetails): Partial<ExternalTask> {
    return {
      title: task.name,
      description: task.description || '',
      status: this.mapJiraStatusToExternal(task.is_completed),
      priority: this.mapPriorityReverse(task.priority),
      estimate: task.estimate_minutes || 0,
      labels: [],
      url: '',
      externalId: ''
    };
  }

  // Private helper methods
  private buildJQL(filters?: IntegrationFilters): string {
    let jql = 'project = ' + this.projectKey;

    if (filters?.priorityFilter) {
      const priorities = filters.priorityFilter.map(p => `priority = "${p}"`).join(' OR ');
      jql += ` AND (${priorities})`;
    }

    if (filters?.statusFilter) {
      const statuses = filters.statusFilter.map(s => `status = "${s}"`).join(' OR ');
      jql += ` AND (${statuses})`;
    }

    if (filters?.dateRange) {
      jql += ` AND duedate >= "${new Date(filters.dateRange.start).toISOString().split('T')[0]}"`;
      jql += ` AND duedate <= "${new Date(filters.dateRange.end).toISOString().split('T')[0]}"`;
    }

    return jql;
  }

  private buildJQLForCreate(task: Partial<ExternalTask>): string {
    let jql = `project = ${this.projectKey} AND summary = "${task.title || ''}"`;
    if (task.dueDate) jql += ` AND duedate = "${task.dueDate}"`;
    return jql;
  }

  private mapJiraStatusToInternal(jiraStatus: string): number {
    // Common done statuses
    const doneStatuses = ['done', 'resolved', 'closed', 'completed', 'inactive'];
    return doneStatuses.some(s => jiraStatus.toLowerCase().includes(s)) ? 1 : 0;
  }

  private mapJiraStatusToExternal(internalStatus: number): string {
    return internalStatus === 1 ? 'done' : 'open';
  }

  private mapPriority(priority: string): 'high' | 'medium' | 'low' | 'none' {
    switch (priority.toLowerCase()) {
      case 'high': case 'critical': case 'blocker': case 'p0': return 'high';
      case 'medium': case 'major': case 'p1': return 'medium';
      case 'low': case 'minor': case 'p2': case 'p3': return 'low';
      default: return 'none';
    }
  }

  private mapPriorityReverse(priority: string): string {
    return priority;
  }

  private parseEstimate(description: string): number | undefined {
    // Look for estimate in description like "Estimate: 8h" or "Story Points: 5"
    const timeMatch = description.match(/\b(?:estimate|effort|hours?)\s*:\s*(\d+(?:\.\d+)?)\s*h/ii);
    if (timeMatch) {
      return parseFloat(timeMatch[1]) * 60; // Convert hours to minutes
    }

    const spMatch = description.match(/\bstory\s*points?\s*[:=]\s*(\d+)/i);
    if (spMatch) {
      // Story points need velocity conversion, but return raw for now
      return undefined;
    }

    return undefined;
  }
}

// Factory registration
import { IntegrationFactory } from './integration-framework';
IntegrationFactory.register('jira', (config: IntegrationConfig) => new JiraIntegration(config));