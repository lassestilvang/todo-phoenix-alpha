import { BaseIntegration, IntegrationConfig, ExternalTask, ExternalComment, ExternalUser, ExternalProject } from './integration-framework';
import fetch from 'node-fetch';

/**
 * Microsoft Teams Integration
 * Syncs tasks with Microsoft Teams channels and Planner
 */
export class TeamsIntegration extends BaseIntegration {
  private apiBase = 'https://graph.microsoft.com/v1.0';
  private teamId?: string;
  private channelId?: string;

  constructor(config: IntegrationConfig) {
    super(config);
    this.teamId = config.credentials.workspaceId;
    this.channelId = config.credentials.projectId;
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
      console.error('Teams authentication failed:', error);
      return false;
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const authenticated = await this.authenticate();
      if (!authenticated) {
        return { success: false, message: 'Teams authentication failed' };
      }

      if (this.channelId) {
        const response = await fetch(`${this.apiBase}/channels/${this.channelId}`, {
          method: 'GET',
          headers: this.getHeaders()
        });

        if (response.ok) {
          const data = await response.json();
          return { success: true, message: `Teams connection successful (${data.displayName})` };
        }
      }

      return { success: true, message: 'Teams connection successful' };
    } catch (error) {
      return { success: false, message: `Teams connection error: ${error instanceof Error ? error.message : 'Unknown'}` };
    }
  }

  // For Teams, each channel is a project/list
  async getProjects(): Promise<ExternalProject[]> {
    try {
      if (!this.teamId) {
        // Get user's teams
        const response = await fetch(`${this.apiBase}/teams`, { method: 'GET', headers: this.getHeaders() });
        const data = await response.json();
        return (data?.value || []).map((team: any) => ({
          id: team.id,
          externalId: team.id,
          name: team.displayName,
          description: team.description || '',
          key: team.id,
          url: team.webUrl,
          color: '#0076D7',
          members: [],
          metadata: {
            isArchived: team.isArchived,
            memberCount: team.members?.length
          }
        }));
      }

      // Get channel details
      const response = await fetch(`${this.apiBase}/teams/${this.teamId}/channels`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Failed to fetch channels');

      return (data?.value || []).map((channel: any) => ({
        id: channel.id,
        externalId: channel.id,
        name: channel.displayName,
        description: channel.description || '',
        key: channel.id,
        url: channel.webUrl,
        color: '#0076D7',
        members: [],
        metadata: {
          isFavorite: channel.isFavorite,
          isPrivate: channel.membership?.role !== 'owner',
          memberCount: channel.membership?.totalMemberCount
        }
      }));
    } catch (error) {
      console.error('Failed to fetch Teams projects:', error);
      return [];
    }
  }

  async getProject(projectId: string): Promise<ExternalProject | null> {
    try {
      if (this.channelId) {
        const response = await fetch(`${this.apiBase}/channels/${this.channelId}`, {
          method: 'GET', headers: this.getHeaders()
        });
        const data = await response.json();

        if (!response.ok) throw new Error(data.error?.message || 'Failed to fetch channel');

        return {
          id: data.id,
          externalId: data.id,
          name: data.displayName,
          description: data.description || '',
          key: data.id,
          url: data.webUrl,
          color: '#0076D7',
          members: [],
          metadata: {
            isPrivate: data.membership?.role !== 'owner',
            memberCount: data.membership?.totalMemberCount
          }
        };
      }

      // Find project by channel
      const channels = await this.getProjects();
      const found = channels.find(c => c.id === projectId);
      return found || null;
    } catch (error) {
      console.error(`Failed to fetch Teams project ${projectId}:`, error);
      return null;
    }
  }

  // For Teams, tasks map to Planner tasks
  async getTasks(projectId?: string, filters?: IntegrationFilters): Promise<ExternalTask[]> {
    try {
      const channelId = projectId || this.channelId;
      if (!channelId) {
        // Get first available channel if none specified
        const projects = await this.getProjects();
        if (projects.length === 0) return [];
        this.channelId = projects[0].id;
      }

      // Get tasks from Planner in this channel
      const response = await fetch(
        `${this.apiBase}/planner/tasks?$filter=bucketId ne ''&$orderBy=createdDateTime`,
        { method: 'GET', headers: this.getHeaders() }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Failed to fetch Teams tasks');

      return (data?.value || []).map((task: any) => this.transformPlannerTaskToExternal(task));
    } catch (error) {
      console.error('Failed to fetch Teams tasks:', error);
      return [];
    }
  }

  async getTask(taskId: string): Promise<ExternalTask | null> {
    try {
      const response = await fetch(
        `${this.apiBase}/planner/tasks/${taskId}`,
        { method: 'GET', headers: this.getHeaders() }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Failed to fetch task');

      return this.transformPlannerTaskToExternal(data);
    } catch (error) {
      console.error(`Failed to fetch Teams task ${taskId}:`, error);
      return null;
    }
  }

  async createTask(task: Partial<ExternalTask>): Promise<ExternalTask> {
    try {
      const channelId = task.projectId || this.channelId;
      if (!channelId) throw new Error('No channel ID specified for task creation');

      // Create bucket if needed
      await this.ensureBucketExists(channelId);

      // Create the planner task
      const response = await fetch(
        `${this.apiBase}/planner/tasks`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            title: task.title || 'New Task',
            bucketId: await this.ensureBucketExists(channelId),
            planId: channelId,
            assignmentMethod: 'individual',
            owner: { '@odata.type': '#microsoft.graph.identitySet' }, // Simplified
            startDate: task.dueDate || undefined,
            dueDate: task.dueDate || undefined,
            priority: task.priority || 'normal'
          })
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Failed to create Teams task');

      return this.transformPlannerTaskToExternal(data);
    } catch (error) {
      console.error('Failed to create Teams task:', error);
      throw error;
    }
  }

  async updateTask(taskId: string, updates: Partial<ExternalTask>): Promise<ExternalTask> {
    try {
      const response = await fetch(
        `${this.apiBase}/planner/tasks/${taskId}`,
        {
          method: 'PATCH',
          headers: this.getHeaders(),
          body: JSON.stringify({
            title: updates.title,
            priority: updates.priority || 'normal',
            dueDate: updates.dueDate || undefined
          })
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Failed to update Teams task');

      return this.transformPlannerTaskToExternal(data);
    } catch (error) {
      console.error(`Failed to update Teams task ${taskId}:`, error);
      throw error;
    }
  }

  async deleteTask(taskId: string): Promise<boolean> {
    try {
      await fetch(
        `${this.apiBase}/planner/tasks/${taskId}`,
        { method: 'DELETE', headers: this.getHeaders() }
      );
      return true;
    } catch (error) {
      console.error(`Failed to delete Teams task ${taskId}:`, error);
      return false;
    }
  }

  async getComments(taskId: string): Promise<ExternalComment[]> {
    try {
      const response = await fetch(
        `${this.apiBase}/planner/tasks/${taskId}/comments`,
        { method: 'GET', headers: this.getHeaders() }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Failed to fetch comments');

      return (data?.value || []).map((comment: any) => ({
        id: `teams_comment_${comment.id}`,
        externalId: comment.id.toString(),
        taskId,
        author: {
          id: comment.author?.user?.id || comment.author?.id || '',
          externalId: comment.author?.user?.id || comment.author?.id || '',
          name: comment.author?.user?.displayName || comment.author?.displayName || 'Unknown User',
          email: comment.author?.user?.mail || comment.author?.emailAddress || '',
          avatarUrl: ''
        },
        content: comment.content?.preview || comment.content?.body || '',
        createdAt: comment.createdDateTime,
        updatedAt: comment.lastUpdatedDateTime,
        metadata: {}
      }));
    } catch (error) {
      console.error(`Failed to fetch comments for Teams task ${taskId}:`, error);
      return [];
    }
  }

  async addComment(taskId: string, content: string): Promise<ExternalComment> {
    try {
      const response = await fetch(
        `${this.apiBase}/planner/tasks/${taskId}/comments`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ content: { body: content } })
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Failed to add comment');

      return {
        id: `teams_comment_${data.id}`,
        externalId: data.id.toString(),
        taskId,
        author: { id: 'current_user', externalId: 'current_user', name: 'Todo Phoenix User', email: '', avatarUrl: '' },
        content,
        createdAt: data.lastUpdatedDateTime,
        updatedAt: data.lastUpdatedDateTime,
        metadata: {}
      };
    } catch (error) {
      console.error(`Failed to add comment to Teams task ${taskId}:`, error);
      throw error;
    }
  }

  async updateComment(commentId: string, content: string): Promise<ExternalComment> {
    try {
      await fetch(
        `${this.apiBase}/planner/tasks/${commentId}/comments`,
        {
          method: 'PATCH',
          headers: this.getHeaders(),
          body: JSON.stringify({ content: { body: content } })
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
        `${this.apiBase}/planner/tasks/${commentId}/comments/${commentId}`,
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
      // Get users from Teams channel
      const channelId = projectId || this.channelId;
      if (!channelId) {
        const projects = await this.getProjects();
        if (projects.length === 0) return [];
        const channel = await this.getProject(projects[0].id);
        if (!channel) return [];
      }

      const response = await fetch(
        `${this.apiBase}/teams/${this.teamId || 'current'}/members/${projectId || this.channelId}`,
        { method: 'GET', headers: this.getHeaders() }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Failed to fetch users');

      return (data?.members || []).map((member: any) => ({
        id: member.id,
        externalId: member.id,
        name: member.displayName || member.user?.displayName || 'Unknown User',
        email: member.user?.emailAddress || '',
        avatarUrl: member.photo?.url || '',
        role: member.role
      }));
    } catch (error) {
      console.error('Failed to fetch Teams users:', error);
      return [];
    }
  }

  // Webhook methods
  async registerWebhook(url: string, events: any[]): Promise<string> {
    try {
      // Set up Teams connector webhook or Graph API subscription
      const response = await fetch(
        `${this.apiBase}/subscriptions`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            id: `subscription_${Date.now()}`,
            changeType: 'created',
            notificationUrl: url,
            resource: 'plannerTasks',
            expirationDateTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
          })
        }
      );

      const data = await response.json();
      return data.id || '';
    } catch (error) {
      console.error('Failed to register Teams webhook:', error);
      return '';
    }
  }

  async unregisterWebhook(webhookId: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.apiBase}/subscriptions/${webhookId}`,
        { method: 'DELETE', headers: this.getHeaders() }
      );
      return response.ok;
    } catch (error) {
      console.error(`Failed to unregister Teams webhook ${webhookId}:`, error);
      return false;
    }
  }

  verifyWebhook(payload: any, signature: string): boolean {
    // Teams webhook verification
    // Would verify the HMAC signature
    return true;
  }

  async processWebhook(payload: any): Promise<{ success: boolean; action: string; itemId: string }> {
    try {
      const resourceData = payload.resourceData;
      return {
        success: true,
        action: 'updated',
        itemId: resourceData?.id || ''
      };
    } catch (error) {
      console.error('Failed to process Teams webhook:', error);
      return { success: false, action: 'error', itemId: '' };
    }
  }

  // Transformation methods
  transformToInternal(externalTask: ExternalTask): Partial<TaskWithDetails> {
    return {
      name: externalTask.title,
      description: externalTask.description || '',
      is_completed: this.mapTeamsStatusToInternal(externalTask.status),
      priority: this.mapPriority(externalTask.priority || 'medium'),
      deadline: externalTask.dueDate || null,
      estimate_minutes: this.parseEstimate(externalTask.description || '') || 0,
      dependencies: JSON.stringify({
        externalId: externalTask.externalId,
        externalUrl: externalTask.url,
        source: 'teams'
      })
    };
  }

  transformToExternal(task: TaskWithDetails): Partial<ExternalTask> {
    return {
      title: task.name,
      description: task.description || '',
      status: this.mapTeamsStatusToExternal(task.is_completed),
      priority: this.mapPriorityReverse(task.priority),
      estimate: task.estimate_minutes || 0,
      labels: [],
      url: '',
      externalId: ''
    };
  }

  // Private helpers
  private async ensureBucketExists(channelId: string): Promise<string> {
    // Check if bucket exists, create if not
    try {
      const response = await fetch(
        `${this.apiBase}/planner/buckets?planId=${channelId}`,
        { method: 'GET', headers: this.getHeaders() }
      );
      const data = await response.json();

      if (data?.value && data.value.length > 0) {
        return data.value[0].id;
      }

      // Create default bucket
      const createResponse = await fetch(
        `${this.apiBase}/planner/buckets`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            planId: channelId,
            name: 'Tasks'
          })
        }
      );

      const created = await createResponse.json();
      return created.id;
    } catch (error) {
      console.error('Failed to ensure bucket exists:', error);
      return 'defaultBucket';
    }
  }

  private mapTeamsStatusToInternal(teamsStatus: string): number {
    const doneStatuses = ['completed', 'finished', 'done'];
    return doneStatuses.some(s => teamsStatus.toLowerCase().includes(s)) ? 1 : 0;
  }

  private mapTeamsStatusToExternal(internalStatus: number): string {
    return internalStatus === 1 ? 'completed' : 'active';
  }

  private mapPriority(priority: string): 'high' | 'medium' | 'low' | 'none' {
    switch (priority.toLowerCase()) {
      case 'high': case 'urgent': return 'high';
      case 'low': return 'low';
      default: return 'medium';
    }
  }

  private mapPriorityReverse(priority: string): string {
    return priority;
  }

  private parseEstimate(description: string): number | undefined {
    // Look for estimate patterns
    const timeMatch = description.match(/\((\d+(?:\.\d+)?)\s*h\)/i);
    if (timeMatch) {
      return parseFloat(timeMatch[1]) * 60;
    }
    return undefined;
  }
}

// Factory registration
import { IntegrationFactory } from './integration-framework';
IntegrationFactory.register('teams', (config: IntegrationConfig) => new TeamsIntegration(config));