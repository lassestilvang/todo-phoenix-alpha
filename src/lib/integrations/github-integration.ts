import { BaseIntegration, IntegrationConfig, ExternalTask, ExternalComment, ExternalUser, ExternalProject, IntegrationFilters } from './integration-framework';
import fetch from 'node-fetch';

/**
 * GitHub Integration
 * Syncs tasks with GitHub Issues, Projects, and PRs
 */
export class GitHubIntegration extends BaseIntegration {
  private apiBase = 'https://api.github.com';
  private organization?: string;
  private repo?: string;

  constructor(config: IntegrationConfig) {
    super(config);
    this.organization = this.config.credentials.workspaceId;
    this.repo = this.config.credentials.projectId;

    if (!this.config.credentials.accessToken) {
      throw new Error('GitHub integration requires access token');
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Authorization': `token ${this.config.credentials.accessToken}`,
      'Accept': 'application/vnd.github.v3+json'
    };

    if (this.config.credentials.tokenExpiry && Date.now() < this.config.credentials.tokenExpiry) {
      // Token is still valid
    }

    return headers;
  }

  async authenticate(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBase}/user`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      return response.ok;
    } catch (error) {
      console.error('GitHub authentication failed:', error);
      return false;
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const authenticated = await this.authenticate();
      if (!authenticated) {
        return { success: false, message: 'GitHub authentication failed' };
      }

      if (this.repo) {
        const response = await fetch(`${this.apiBase}/repos/${this.organization}/${this.repo}`, {
          method: 'GET',
          headers: this.getHeaders()
        });

        if (response.ok) {
          return { success: true, message: `GitHub connection successful (${this.organization}/${this.repo})` };
        } else {
          return { success: false, message: 'GitHub repository access denied' };
        }
      }

      return { success: true, message: 'GitHub connection successful' };
    } catch (error) {
      return { success: false, message: `GitHub connection error: ${error instanceof Error ? error.message : 'Unknown'}` };
    }
  }

  // For GitHub, projects map to GitHub Projects (not repos)
  async getProjects(): Promise<ExternalProject[]> {
    try {
      let response;
      let data;

      if (this.organization) {
        // Get organization projects
        response = await fetch(`${this.apiBase}/orgs/${this.organization}/projects`, {
          method: 'GET',
          headers: this.getHeaders()
        });
        data = await response.json();
      } else {
        // Get user projects
        response = await fetch(`${this.apiBase}/user/projects`, {
          method: 'GET',
          headers: this.getHeaders()
        });
        data = await response.json();
      }

      if (!response.ok) throw new Error(data.message || 'Failed to fetch projects');

      return data.map((project: any) => ({
        id: project.id.toString(),
        externalId: project.id.toString(),
        name: project.name,
        description: project.body || '',
        key: project.name.replace(/\s+/g, '-').toLowerCase(),
        url: project.html_url,
        color: '#6e5494',
        members: [],
        metadata: {
          state: project.state,
          number: project.number,
          createdAt: project.created_at,
          updatedAt: project.updated_at
        }
      }));
    } catch (error) {
      console.error('Failed to fetch GitHub projects:', error);
      return [];
    }
  }

  async getProject(projectId: string): Promise<ExternalProject | null> {
    try {
      if (!this.organization) {
        // User project
        const response = await fetch(`${this.apiBase}/user/projects/${projectId}`, {
          method: 'GET',
          headers: this.getHeaders()
        });
        const data = await response.json();

        if (!response.ok) throw new Error(data.message || 'Failed to fetch project');

        return {
          id: data.id.toString(),
          externalId: data.id.toString(),
          name: data.name,
          description: data.body || '',
          key: data.name.replace(/\s+/g, '-').toLowerCase(),
          url: data.html_url,
          color: '#6e5494',
          members: [],
          metadata: {
            state: data.state,
            number: data.number,
            createdAt: data.created_at,
            updatedAt: data.updated_at
          }
        };
      } else {
        return await this.getProject(projectId);
      }
    } catch (error) {
      console.error(`Failed to fetch GitHub project ${projectId}:`, error);
      return null;
    }
  }

  // For GitHub, tasks map to Issues
  async getTasks(projectId?: string, filters?: IntegrationFilters): Promise<ExternalTask[]> {
    try {
      const owner = this.organization;
      const repo = this.repo;

      const params = new URLSearchParams({
        state: 'all',
        per_page: '100'
      });

      if (filters?.priorityFilter) {
        // GitHub uses labels for priority
        const priorityLabels = filters.priorityFilter.map(p => `priority:${p}`).join(',');
        params.append('labels', priorityLabels);
      }

      const response = await fetch(
        `${this.apiBase}/repos/${owner}/${repo}/issues?${params.toString()}`,
        { method: 'GET', headers: this.getHeaders() }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch issues');

      // Filter out PRs (they have pull_request property)
      const issues = data.filter((item: any) => !item.pull_request);

      return issues.map((issue: any) => this.transformIssueToTask(issue, `${owner}/${repo}`));
    } catch (error) {
      console.error('Failed to fetch GitHub tasks:', error);
      return [];
    }
  }

  async getTask(taskId: string): Promise<ExternalTask | null> {
    try {
      const issueNumber = parseInt(taskId);
      if (isNaN(issueNumber)) throw new Error('Invalid task ID');

      const response = await fetch(
        `${this.apiBase}/repos/${this.organization}/${this.repo}/issues/${issueNumber}`,
        { method: 'GET', headers: this.getHeaders() }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch issue');

      return this.transformIssueToTask(data, `${this.organization}/${this.repo}`);
    } catch (error) {
      console.error(`Failed to fetch GitHub task ${taskId}:`, error);
      return null;
    }
  }

  async createTask(task: Partial<ExternalTask>): Promise<ExternalTask> {
    try {
      const response = await fetch(
        `${this.apiBase}/repos/${this.organization}/${this.repo}/issues`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            title: task.title,
            body: task.description || '',
            labels: this.buildLabels(task),
            assignees: task.assignee ? [task.assignee.externalId] : []
          })
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to create issue');

      // Set due date if provided (requires GitHub project integration)
      if (task.dueDate) {
        await this.setIssueDueDate(data.number, task.dueDate);
      }

      return this.transformIssueToTask(data, `${this.organization}/${this.repo}`);
    } catch (error) {
      console.error('Failed to create GitHub task:', error);
      throw error;
    }
  }

  async updateTask(taskId: string, updates: Partial<ExternalTask>): Promise<ExternalTask> {
    try {
      const issueNumber = parseInt(taskId);
      const updateData: any = {};

      if (updates.title) updateData.title = updates.title;
      if (updates.description !== undefined) updateData.body = updates.description || '';
      if (updates.labels) updateData.labels = this.buildLabels(updates);
      if (updates.assignee) updateData.assignees = [updates.assignee.externalId];

      if (updates.status) {
        const state = this.mapStatus(updates.status);
        if (state) updateData.state = state;
      }

      const response = await fetch(
        `${this.apiBase}/repos/${this.organization}/${this.repo}/issues/${issueNumber}`,
        {
          method: 'PATCH',
          headers: this.getHeaders(),
          body: JSON.stringify(updateData)
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to update issue');

      return this.transformIssueToTask(data, `${this.organization}/${this.repo}`);
    } catch (error) {
      console.error(`Failed to update GitHub task ${taskId}:`, error);
      throw error;
    }
  }

  async deleteTask(taskId: string): Promise<boolean> {
    try {
      // GitHub issues cannot be truly deleted, only closed
      await this.updateTask(taskId, { status: 'completed' });
      return true;
    } catch (error) {
      console.error(`Failed to delete GitHub task ${taskId}:`, error);
      return false;
    }
  }

  async getComments(taskId: string): Promise<ExternalComment[]> {
    try {
      const issueNumber = parseInt(taskId);
      const response = await fetch(
        `${this.apiBase}/repos/${this.organization}/${this.repo}/issues/${issueNumber}/comments`,
        { method: 'GET', headers: this.getHeaders() }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch comments');

      return data.map((comment: any) => ({
        id: `github_comment_${comment.id}`,
        externalId: comment.id.toString(),
        taskId,
        author: {
          id: comment.user.id.toString(),
          externalId: comment.user.id.toString(),
          name: comment.user.login,
          email: comment.user.email || '',
          avatarUrl: comment.user.avatar_url
        },
        content: comment.body,
        createdAt: comment.created_at,
        updatedAt: comment.updated_at,
        metadata: {
          url: comment.html_url
        }
      }));
    } catch (error) {
      console.error(`Failed to fetch comments for GitHub task ${taskId}:`, error);
      return [];
    }
  }

  async addComment(taskId: string, content: string): Promise<ExternalComment> {
    try {
      const issueNumber = parseInt(taskId);
      const response = await fetch(
        `${this.apiBase}/repos/${this.organization}/${this.repo}/issues/${issueNumber}/comments`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ body: content })
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to add comment');

      return {
        id: `github_comment_${data.id}`,
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
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        metadata: {}
      };
    } catch (error) {
      console.error(`Failed to add comment to GitHub task ${taskId}:`, error);
      throw error;
    }
  }

  async updateComment(commentId: string, content: string): Promise<ExternalComment> {
    try {
      const commentIdNum = commentId.replace('github_comment_', '');

      await fetch(
        `${this.apiBase}/repos/${this.organization}/${this.repo}/issues/comments/${commentIdNum}`,
        {
          method: 'PATCH',
          headers: this.getHeaders(),
          body: JSON.stringify({ body: content })
        }
      );

      return {
        id: commentId,
        externalId: commentIdNum,
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
      const commentIdNum = commentId.replace('github_comment_', '');

      const response = await fetch(
        `${this.apiBase}/repos/${this.organization}/${this.repo}/issues/comments/${commentIdNum}`,
        { method: 'DELETE', headers: this.getHeaders() }
      );

      return response.ok || response.status === 204;
    } catch (error) {
      console.error(`Failed to delete comment ${commentId}:`, error);
      return false;
    }
  }

  async getUsers(projectId?: string): Promise<ExternalUser[]> {
    try {
      let response;
      let data;

      if (this.organization) {
        response = await fetch(`${this.apiBase}/orgs/${this.organization}/members`, {
          method: 'GET',
          headers: this.getHeaders()
        });
        data = await response.json();
      } else {
        response = await fetch(`${this.apiBase}/user/followers`, {
          method: 'GET',
          headers: this.getHeaders()
        });
        data = await response.json();
      }

      if (!response.ok) throw new Error(data.message || 'Failed to fetch users');

      return data.map((user: any) => ({
        id: user.id.toString(),
        externalId: user.id.toString(),
        name: user.login,
        email: user.email || `${user.login}@users.noreply.github.com`,
        avatarUrl: user.avatar_url,
        role: user.role || 'member'
      }));
    } catch (error) {
      console.error('Failed to fetch GitHub users:', error);
      return [];
    }
  }

  // Webhook methods
  async registerWebhook(url: string, events: any[]): Promise<string> {
    try {
      const response = await fetch(
        `${this.apiBase}/repos/${this.organization}/${this.repo}/hooks`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            name: 'web',
            active: true,
            events: events.map(e => e.replace('issue', 'issues').replace('pull_request', 'pull_request')),
            config: {
              url,
              content_type: 'json'
            }
          })
        }
      );

      const data = await response.json();
      return data.id ? data.id.toString() : '';
    } catch (error) {
      console.error('Failed to register GitHub webhook:', error);
      return '';
    }
  }

  async unregisterWebhook(webhookId: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.apiBase}/repos/${this.organization}/${this.repo}/hooks/${webhookId}`,
        { method: 'DELETE', headers: this.getHeaders() }
      );

      return response.ok;
    } catch (error) {
      console.error(`Failed to unregister GitHub webhook ${webhookId}:`, error);
      return false;
    }
  }

  verifyWebhook(payload: any, signature: string): boolean {
    // GitHub webhook signature verification
    // Would use crypto to verify HMAC-SHA256 signature
    return true;
  }

  async processWebhook(payload: any): Promise<{ success: boolean; action: string; itemId: string }> {
    try {
      const action = payload.action;
      const issue = payload.issue;

      switch (action) {
        case 'opened':
          return { success: true, action: 'created', itemId: issue.number.toString() };
        case 'closed':
          return { success: true, action: 'updated', itemId: issue.number.toString() };
        case 'reopened':
          return { success: true, action: 'updated', itemId: issue.number.toString() };
        case 'edited':
          return { success: true, action: 'updated', itemId: issue.number.toString() };
        case 'deleted':
          return { success: true, action: 'deleted', itemId: issue.number.toString() };
        case 'labeled':
          return { success: true, action: 'updated', itemId: issue.number.toString() };
        default:
          return { success: true, action: 'ignored', itemId: '' };
      }
    } catch (error) {
      console.error('Failed to process GitHub webhook:', error);
      return { success: false, action: 'error', itemId: '' };
    }
  }

  // Transformation methods
  transformToInternal(externalTask: ExternalTask): Partial<TaskWithDetails> {
    return {
      name: externalTask.title,
      description: externalTask.description || '',
      is_completed: externalTask.status === 'completed' ? 1 : 0,
      priority: this.mapPriority(externalTask.priority || 'medium'),
      deadline: externalTask.dueDate || null,
      estimate_minutes: externalTask.estimate || 0,
      dependencies: JSON.stringify({
        externalId: externalTask.externalId,
        externalUrl: externalTask.url,
        source: 'github'
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
      externalId: ''
    };
  }

  // Private helper methods
  private transformIssueToTask(issue: any, repoPath: string): ExternalTask {
    // Parse labels for priority
    const priority = this.parsePriorityFromLabels(issue.labels);
    const dueDate = issue.due_on ? issue.due_on.to || null : null;

    // Parse estimate from body or labels
    const estimate = this.parseEstimate(issue.body || '');

    return {
      id: issue.number.toString(),
      externalId: issue.id.toString(),
      title: issue.title,
      description: issue.body || '',
      status: issue.state === 'closed' ? 'completed' : 'active',
      priority,
      assignee: issue.assignee ? {
        id: issue.assignee.id.toString(),
        externalId: issue.assignee.id.toString(),
        name: issue.assignee.login,
        email: issue.assignee.email || `${issue.assignee.login}@users.noreply.github.com`,
        avatarUrl: issue.assignee.avatar_url
      } : undefined,
      dueDate,
      estimate,
      labels: issue.labels.map((l: any) => l.name),
      url: issue.html_url,
      projectId: repoPath,
      parentId: null,
      metadata: {
        number: issue.number,
        comments: issue.comments,
        author: issue.user?.login
      },
      createdAt: issue.created_at,
      updatedAt: issue.updated_at
    };
  }

  private parsePriorityFromLabels(labels: any[]): string {
    for (const label of labels) {
      const name = label.name.toLowerCase();
      if (name.includes('priority:high') || name.includes('p0') || name.includes('p1')) return 'high';
      if (name.includes('priority:low') || name.includes('p4') || name.includes('p3')) return 'low';
      if (name.includes('priority:medium') || name.includes('p2')) return 'medium';
    }
    return 'none';
  }

  private parseEstimate(body: string): number | undefined {
    // Look for estimate patterns in body
    const timeMatch = body.match(/\bin\s*(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i);
    if (timeMatch) {
      const value = parseFloat(timeMatch[1]);
      return value * 60;
    }

    const hoursMatch = body.match(/\btbd\s*:\s*(\d+(?:\.\d+)?)\s*h\b/i);
    if (hoursMatch) {
      const value = parseFloat(hoursMatch[1]);
      return value * 60;
    }

    return undefined;
  }

  private buildLabels(task: Partial<ExternalTask>): string[] {
    const labels: string[] = [];

    if (task.priority) {
      labels.push(`priority:${task.priority}`);
    }

    if (task.labels) {
      labels.push(...task.labels);
    }

    return labels;
  }

  private mapStatus(status: string): 'open' | 'closed' | null {
    if (status === 'completed') return 'closed';
    if (status === 'active') return 'open';
    return null;
  }

  private mapPriority(priority: string): 'high' | 'medium' | 'low' | 'none' {
    switch (priority) {
      case 'high': return 'high';
      case 'medium': return 'medium';
      case 'low': return 'low';
      default: return 'none';
    }
  }

  private mapPriorityReverse(priority: string): string {
    return priority;
  }

  private async setIssueDueDate(issueNumber: number, dueDate: string): Promise<void> {
    // GitHub doesn't have native due dates - would need to use a project board
    // or milestone for due dates. This is a placeholder.
    try {
      // Create a milestone with the due date
      const milestoneName = `Due: ${new Date(dueDate).toLocaleDateString()}`;
      // Implementation would create/update a milestone
    } catch (error) {
      console.warn('Could not set GitHub due date (milestones not supported):', error);
    }
  }
}

// Factory registration
import { IntegrationFactory } from './integration-framework';
IntegrationFactory.register('github', (config: IntegrationConfig) => new GitHubIntegration(config));