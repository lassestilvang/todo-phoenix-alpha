import { BaseIntegration, IntegrationConfig, SyncResult, SyncError, ExternalTask, ExternalUser, ExternalProject, ExternalComment, IntegrationFramework } from './integration-framework';
import fetch from 'node-fetch';

export class SlackIntegration extends BaseIntegration {
  private apiBase = 'https://slack.com/api';
  private rateLimitReset = 0;
  private channelId: string | null = null;

  constructor(config: IntegrationConfig) {
    super(config);
    if (!config.credentials.accessToken) {
      throw new Error('Slack integration requires access token');
    }
  }

  getHeaders(): HeadersInit {
    return {
      'Authorization': `Bearer ${this.config.credentials.accessToken}`,
      'Content-Type': 'application/json'
    };
  }

  async authenticate(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBase}/auth.test`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      const data = await response.json();
      return data.ok === true;
    } catch (error) {
      console.error('Slack authentication failed:', error);
      return false;
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const authenticated = await this.authenticate();
      if (authenticated) {
        return { success: true, message: 'Slack connection successful' };
      } else {
        return { success: false, message: 'Slack authentication failed' };
      }
    } catch (error) {
      return { success: false, message: `Slack connection error: ${error instanceof Error ? error.message : 'Unknown'}` };
    }
  }

  // For Slack, we'll map channels to projects
  async getProjects(): Promise<ExternalProject[]> {
    try {
      const response = await fetch(`${this.apiBase}/conversations.list`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      const data = await response.json();
      if (!data.ok) throw new Error(data.error || 'Failed to fetch conversations');

      return data.channels
        .filter((channel: any) => !channel.archived && channel.is_member)
        .map((channel: any) => ({
          id: channel.id,
          externalId: channel.id,
          name: channel.name,
          description: channel.topic?.value || '',
          key: channel.name.toUpperCase(),
          url: `https://slack.com/app_redirect?channel=${channel.id}`,
          color: '#4A154B',
          members: [], // Would need separate call to get members
          metadata: {
            isPrivate: channel.is_private,
            memberCount: channel.num_members,
            created: channel.created
          }
        }));
    } catch (error) {
      console.error('Failed to fetch Slack projects:', error);
      return [];
    }
  }

  async getProject(projectId: string): Promise<ExternalProject | null> {
    try {
      const response = await fetch(`${this.apiBase}/conversations.info?channel=${projectId}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      const data = await response.json();
      if (!data.ok) throw new Error(data.error || 'Failed to fetch conversation');

      const channel = data.channel;
      return {
        id: channel.id,
        externalId: channel.id,
        name: channel.name,
        description: channel.topic?.value || '',
        key: channel.name.toUpperCase(),
        url: `https://slack.com/app_redirect?channel=${channel.id}`,
        color: '#4A154B',
        members: [],
        metadata: {
          isPrivate: channel.is_private,
          memberCount: channel.num_members,
          created: channel.created
        }
      };
    } catch (error) {
      console.error(`Failed to fetch Slack project ${projectId}:`, error);
      return null;
    }
  }

  // For Slack integration, we'll treat messages as tasks
  // Using threads as task containers
  async getTasks(projectId?: string, filters?: IntegrationFilters): Promise<ExternalTask[]> {
    try {
      const channelId = projectId || this.channelId;
      if (!channelId) {
        // Get first available channel if none specified
        const projects = await this.getProjects();
        if (projects.length === 0) return [];
        this.channelId = projects[0].id;
      }

      const response = await fetch(`${this.apiBase}/conversations.history?channel=${this.channelId}&limit=100`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      const data = await response.json();
      if (!data.ok) throw new Error(data.error || 'Failed to fetch messages');

      const tasks: ExternalTask[] = [];

      // Process messages and group by thread
      const threadMap = new Map<string, ExternalTask[]>();

      for (const message of data.messages) {
        // Skip bot messages and system messages
        if (message.subtype || !message.text) continue;

        const threadTs = message.thread_ts || message.ts;

        if (!threadMap.has(threadTs)) {
          threadMap.set(threadTs, []);
        }

        threadMap.get(threadTs)!.push(message);
      }

      // Convert each thread to a task
      for (const [threadTs, messages] of threadMap.entries()) {
        const firstMessage = messages[0];
        const task: ExternalTask = {
          id: `slack_${threadTs}`,
          externalId: threadTs,
          title: this.extractTaskTitle(firstMessage.text),
          description: this.extractTaskDescription(messages),
          status: this.extractTaskStatus(firstMessage, messages),
          priority: this.extractTaskPriority(firstMessage.text),
          assignee: this.extractAssignee(firstMessage, messages),
          dueDate: this.extractDueDate(firstMessage.text),
          estimate: this.extractEstimate(firstMessage.text),
          labels: this.extractLabels(firstMessage.text),
          url: `https://slack.com/app_redirect?channel=${this.channelId}&message=${threadTs}`,
          projectId: this.channelId,
          parentId: null,
          metadata: {
            channel: this.channelId,
            threadTs,
            messageCount: messages.length,
            reactions: firstMessage.reactions || []
          },
          createdAt: new Date(parseInt(firstMessage.ts.split('.')[0]) * 1000).toISOString(),
          updatedAt: new Date(parseInt(messages[messages.length - 1].ts.split('.')[0]) * 1000).toISOString()
        };

        tasks.push(task);
      }

      return tasks;
    } catch (error) {
      console.error('Failed to fetch Slack tasks:', error);
      return [];
    }
  }

  async getTask(taskId: string): Promise<ExternalTask | null> {
    try {
      // Extract thread_ts from taskId
      const threadTs = taskId.replace('slack_', '');

      const response = await fetch(`${this.apiBase}/conversations.replies?channel=${this.channelId}&ts=${threadTs}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      const data = await response.json();
      if (!data.ok) throw new Error(data.error || 'Failed to fetch thread replies');

      const messages = data.messages;
      if (messages.length === 0) return null;

      const firstMessage = messages[0];
      const task: ExternalTask = {
        id: taskId,
        externalId: threadTs,
        title: this.extractTaskTitle(firstMessage.text),
        description: this.extractTaskDescription(messages),
        status: this.extractTaskStatus(firstMessage, messages),
        priority: this.extractTaskPriority(firstMessage.text),
        assignee: this.extractAssignee(firstMessage, messages),
        dueDate: this.extractDueDate(firstMessage.text),
        estimate: this.extractEstimate(firstMessage.text),
        labels: this.extractLabels(firstMessage.text),
        url: `https://slack.com/app_redirect?channel=${this.channelId}&message=${threadTs}`,
        projectId: this.channelId,
        parentId: null,
        metadata: {
          channel: this.channelId,
          threadTs,
          messageCount: messages.length,
          reactions: firstMessage.reactions || []
        },
        createdAt: new Date(parseInt(firstMessage.ts.split('.')[0]) * 1000).toISOString(),
        updatedAt: new Date(parseInt(messages[messages.length - 1].ts.split('.')[0]) * 1000).toISOString()
      };

      return task;
    } catch (error) {
      console.error(`Failed to fetch Slack task ${taskId}:`, error);
      return null;
    }
  }

  async createTask(task: Partial<ExternalTask>): Promise<ExternalTask> {
    try {
      // Create initial message
      const initialMessage = this.buildSlackMessage(task);

      const response = await fetch(`${this.apiBase}/chat.postMessage`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          channel: this.channelId,
          text: initialMessage
        })
      });

      const data = await response.json();
      if (!data.ok) throw new Error(data.error || 'Failed to create message');

      const messageTs = data.ts;

      // Add description as reply if provided
      if (task.description && task.description.trim() !== '') {
        await fetch(`${this.apiBase}/chat.postMessage`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            channel: this.channelId,
            text: task.description,
            thread_ts: messageTs
          })
        });
      }

      // Add labels as reactions
      for (const label of task.labels || []) {
        await this.addReaction(messageTs, label);
      }

      // Set due date reminder if provided
      if (task.dueDate) {
        await this.setReminder(messageTs, task.dueDate, `Due date for task: ${task.title}`);
      }

      const createdTask = await this.getTask(`slack_${messageTs}`);
      if (!createdTask) throw new Error('Failed to retrieve created task');

      return createdTask;
    } catch (error) {
      console.error('Failed to create Slack task:', error);
      throw error;
    }
  }

  async updateTask(taskId: string, updates: Partial<ExternalTask>): Promise<ExternalTask> {
    try {
      const threadTs = taskId.replace('slack_', '');

      // Update the main message if title or description changed
      if (updates.title || updates.description) {
        const messageText = this.buildSlackMessage({
          title: updates.title || '',
          description: updates.description || '',
          priority: updates.priority,
          assignee: updates.assignee,
          dueDate: updates.dueDate,
          estimate: updates.estimate,
          labels: updates.labels
        });

        await fetch(`${this.apiBase}/chat.update`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            channel: this.channelId,
            ts: threadTs,
            text: messageText
          })
        });
      }

      // Handle status changes (complete/incomplete)
      if (updates.status !== undefined) {
        const isCompleted = updates.status === 'completed';
        const reaction = isCompleted ? 'white_check_mark' : 'x';

        // Remove opposite reaction
        const oppositeReaction = isCompleted ? 'x' : 'white_check_mark';
        await this.removeReaction(threadTs, oppositeReaction);

        // Add completion/incomplete reaction
        await this.addReaction(threadTs, reaction);
      }

      // Update labels (reactions)
      if (updates.labels) {
        // Clear existing label reactions (simplified - in practice would track which reactions are labels)
        // For now, just add new ones
        for (const label of updates.labels) {
          await this.addReaction(threadTs, label);
        }
      }

      const updatedTask = await this.getTask(taskId);
      if (!updatedTask) throw new Error('Failed to retrieve updated task');

      return updatedTask;
    } catch (error) {
      console.error(`Failed to update Slack task ${taskId}:`, error);
      throw error;
    }
  }

  async deleteTask(taskId: string): Promise<boolean> {
    try {
      const threadTs = taskId.replace('slack_', '');

      // Delete by setting deletion timestamp and archiving
      await fetch(`${this.apiBase}/chat.delete`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          channel: this.channelId,
          ts: threadTs
        })
      });

      return true;
    } catch (error) {
      console.error(`Failed to delete Slack task ${taskId}:`, error);
      return false;
    }
  }

  async getComments(taskId: string): Promise<ExternalComment[]> {
    try {
      const threadTs = taskId.replace('slack_', '');

      const response = await fetch(`${this.apiBase}/conversations.replies?channel=${this.channelId}&ts=${threadTs}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      const data = await response.json();
      if (!data.ok) throw new Error(data.error || 'Failed to fetch thread replies');

      // Skip the first message (the task itself)
      const replyMessages = data.messages.slice(1);

      const comments: ExternalComment[] = [];
      for (const message of replyMessages) {
        if (message.subtype || !message.text) continue;

        const comment: ExternalComment = {
          id: `comment_${message.ts}`,
          externalId: message.ts,
          taskId,
          author: {
            id: message.user,
            externalId: message.user,
            name: this.getUserName(message.user) || 'Unknown User',
            email: '',
            avatarUrl: `https://slack.com/img/${message.user}_512.png`
          },
          content: message.text,
          createdAt: new Date(parseInt(message.ts.split('.')[0]) * 1000).toISOString(),
          updatedAt: new Date(parseInt(message.ts.split('.')[0]) * 1000).toISOString(),
          metadata: {
            reactions: message.reactions || []
          }
        };

        comments.push(comment);
      }

      return comments;
    } catch (error) {
      console.error(`Failed to fetch comments for Slack task ${taskId}:`, error);
      return [];
    }
  }

  async addComment(taskId: string, content: string): Promise<ExternalComment> {
    try {
      const threadTs = taskId.replace('slack_', '');

      const response = await fetch(`${this.apiBase}/chat.postMessage`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          channel: this.channelId,
          text: content,
          thread_ts: threadTs
        })
      });

      const data = await response.json();
      if (!data.ok) throw new Error(data.error || 'Failed to add comment');

      const comment: ExternalComment = {
        id: `comment_${data.ts}`,
        externalId: data.ts,
        taskId,
        author: {
          id: 'bot', // Would need to get actual user
          externalId: 'bot',
          name: 'Todo Phoenix Bot',
          email: '',
          avatarUrl: ''
        },
        content,
        createdAt: new Date(parseInt(data.ts.split('.')[0]) * 1000).toISOString(),
        updatedAt: new Date(parseInt(data.ts.split('.')[0]) * 1000).toISOString(),
        metadata: {}
      };

      return comment;
    } catch (error) {
      console.error(`Failed to add comment to Slack task ${taskId}:`, error);
      throw error;
    }
  }

  async updateComment(commentId: string, content: string): Promise<ExternalComment> {
    try {
      const ts = commentId.replace('comment_', '');

      await fetch(`${this.apiBase}/chat.update`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          channel: this.channelId,
          ts,
          text: content
        })
      });

      // Return updated comment (simplified)
      const comment: ExternalComment = {
        id: commentId,
        externalId: ts,
        taskId: '', // Would need to lookup
        author: {
          id: 'bot',
          externalId: 'bot',
          name: 'Todo Phoenix Bot',
          email: '',
          avatarUrl: ''
        },
        content,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {}
      };

      return comment;
    } catch (error) {
      console.error(`Failed to update comment ${commentId}:`, error);
      throw error;
    }
  }

  async deleteComment(commentId: string): Promise<boolean> {
    try {
      const ts = commentId.replace('comment_', '');

      await fetch(`${this.apiBase}/chat.delete`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          channel: this.channelId,
          ts
        })
      });

      return true;
    } catch (error) {
      console.error(`Failed to delete comment ${commentId}:`, error);
      return false;
    }
  }

  async getUsers(projectId?: string): Promise<ExternalUser[]> {
    try {
      const response = await fetch(`${this.apiBase}/users.list`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      const data = await response.json();
      if (!data.ok) throw new Error(data.error || 'Failed to fetch users');

      return data.members
        .filter((user: any) => !user.deleted && !user.is_bot)
        .map((user: any) => ({
          id: user.id,
          externalId: user.id,
          name: user.real_name || user.name,
          email: user.profile?.email,
          avatarUrl: user.profile?.image_512,
          role: user.is_admin ? 'admin' : user.is_owner ? 'owner' : 'member',
          metadata: {
            timezone: user.tz,
            status: user.profile?.status
          }
        }));
    } catch (error) {
      console.error('Failed to fetch Slack users:', error);
      return [];
    }
  }

  // Webhook methods (Slack uses Events API)
  async registerWebhook(url: string, events: WebhookEvent[]): Promise<string> {
    // In practice, this would be done via Slack API or config
    // For now, return a placeholder
    return `webhook_${Date.now()}`;
  }

  async unregisterWebhook(webhookId: string): Promise<boolean> {
    return true;
  }

  verifyWebhook(payload: any, signature: string): boolean {
    // Slack signature verification
    // Requires signing secret from config
    // Simplified for now
    return true;
  }

  async processWebhook(payload: any): Promise<{ success: boolean; action: string; itemId: string }> {
    try {
      const event = payload.event;

      switch (event.type) {
        case 'message':
          if (event.subtype === 'message_deleted') {
            return { success: true, action: 'deleted', itemId: `slack_${event.previous_message.ts}` };
          }
          // New message in thread
          if (event.thread_ts) {
            return { success: true, action: 'updated', itemId: `slack_${event.thread_ts}` };
          }
          // New top-level message (potential new task)
          return { success: true, action: 'created', itemId: `slack_${event.ts}` };

        case 'reaction_added':
          // Handle status changes via reactions
          if (event.item.channel === this.channelId) {
            const taskId = `slack_${event.item.ts}`;
            if (event.reaction === 'white_check_mark') {
              // Task completed
              return { success: true, action: 'updated', itemId: taskId };
            } else if (event.reaction === 'x') {
              // Task reopened
              return { success: true, action: 'updated', itemId: taskId };
            }
          }
          return { success: true, action: 'ignored', itemId: '' };

        default:
          return { success: true, action: 'ignored', itemId: '' };
      }
    } catch (error) {
      console.error('Failed to process Slack webhook:', error);
      return { success: false, action: 'error', itemId: '' };
    }
  }

  // Transformations
  transformToInternal(externalTask: ExternalTask): Partial<TaskWithDetails> {
    const mapper = new TaskMapper(this.config.settings.taskMapping);
    return mapper.mapToInternal(externalTask, {
      externalId: externalTask.externalId,
      url: externalTask.url
    });
  }

  transformToExternal(task: TaskWithDetails): Partial<ExternalTask> {
    const mapper = new TaskMapper(this.config.settings.taskMapping);
    return mapper.mapToExternal(task);
  }

  // Helper methods
  private extractTaskTitle(text: string): string {
    // Extract title from first line or first 100 chars
    const lines = text.split('\n');
    const firstLine = lines[0].trim();
    if (firstLine.length > 0 && firstLine.length < 100) {
      return firstLine;
    }
    return text.substring(0, Math.min(100, text.length)).trim();
  }

  private extractTaskDescription(messages: any[]): string {
    // Combine all messages except the first as description
    if (messages.length <= 1) return '';

    return messages.slice(1)
      .map(m => m.text)
      .filter(t => t && t.trim().length > 0)
      .join('\n\n');
  }

  private extractTaskStatus(firstMessage: any, messages: any[]): string {
    // Check for completion reactions
    const hasCheck = firstMessage.reactions?.some((r: any) => r.name === 'white_check_mark');
    const hasX = firstMessage.reactions?.some((r: any) => r.name === 'x');

    if (hasCheck && !hasX) return 'completed';
    if (hasX && !hasCheck) return 'active';
    // Default to active if unclear
    return 'active';
  }

  private extractTaskPriority(text: string): string {
    // Look for priority indicators
    const textLower = text.toLowerCase();
    if (textLower.includes('(p1)') || textLower.includes('[high]') || textLower.includes('!')) return 'high';
    if (textLower.includes('(p3)') || textLower.includes('[low]') || textLower.includes('?')) return 'low';
    return 'medium';
  }

  private extractAssignee(firstMessage: any, messages: any[]): ExternalUser | undefined {
    // Look for @mentions
    const mentionMatch = firstMessage.text.match(/<@([A-Z0-9]+)>/);
    if (mentionMatch) {
      const userId = mentionMatch[1];
      return {
        id: userId,
        externalId: userId,
        name: `<@${userId}>`, // Would resolve to actual name
        email: '',
        avatarUrl: ''
      };
    }
    return undefined;
  }

  private extractDueDate(text: string): string | undefined {
    // Look for date patterns
    const datePatterns = [
      /due:?\s*(\d{4}-\d{2}-\d{2})/i,
      /due:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
      /(?:due|deadline):?\s*(\w+ \d{1,2},? \d{4})/i
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        // Try to parse and format as ISO
        try {
          const date = new Date(match[1]);
          if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
          }
        } catch {}
      }
    }
    return undefined;
  }

  private extractEstimate(text: string): number | undefined {
    // Look for time estimates like (2h), (30m), (1.5h)
    const timeMatch = text.match(/\((\d+(?:\.\d+)?)\s*([hm])\)/i);
    if (timeMatch) {
      const value = parseFloat(timeMatch[1]);
      const unit = timeMatch[2].toLowerCase();
      return unit === 'h' ? value * 60 : value;
    }
    return undefined;
  }

  private extractLabels(text: string): string[] {
    // Extract hashtags as labels
    const hashtagMatches = text.match(/#(\w+)/g);
    if (hashtagMatches) {
      return hashtagMatches.map(tag => tag.substring(1));
    }
    return [];
  }

  private buildSlackMessage(task: Partial<ExternalTask>): string {
    let message = task.title || '';

    // Add priority indicator
    if (task.priority) {
      const priorityMap: Record<string, string> = {
        high: '[HIGH]',
        medium: '[MED]',
        low: '[LOW]',
        none: ''
      };
      if (priorityMap[task.priority]) {
        message = `${priorityMap[task.priority]} ${message}`;
      }
    }

    // Add assignee
    if (task.assignee) {
      message += ` ${task.assignee.externalId || task.assignee.name}`;
    }

    // Add estimate
    if (task.estimate) {
      const hours = Math.floor(task.estimate / 60);
      const minutes = task.estimate % 60;
      const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      message += ` (${timeStr})`;
    }

    // Add due date
    if (task.dueDate) {
      const due = new Date(task.dueDate);
      message += ` Due: ${due.toLocaleDateString()}`;
    }

    // Add labels
    if (task.labels && task.labels.length > 0) {
      const labelsStr = task.labels.map(l => `#${l}`).join(' ');
      message += ` ${labelsStr}`;
    }

    return message.trim();
  }

  private async addReaction(timestamp: string, reaction: string): Promise<void> {
    await fetch(`${this.apiBase}/reactions.add`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        channel: this.channelId,
        name: reaction,
        timestamp
      })
    });
  }

  private async removeReaction(timestamp: string, reaction: string): Promise<void> {
    await fetch(`${this.apiBase}/reactions.remove`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        channel: this.channelId,
        name: reaction,
        timestamp
      })
    });
  }

  private async setReminder(timestamp: string, dueDate: string, text: string): Promise<void> {
    const due = new Date(dueDate);
    const timestampSeconds = Math.floor(due.getTime() / 1000);

    await fetch(`${this.apiBase}/reminders.add`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        text,
        time: timestampSeconds.toString()
      })
    });
  }

  private getUserName(userId: string): string | undefined {
    // Would normally cache this
    return undefined;
  }
}

// Register Slack integration with the factory
import { IntegrationFactory } from './integration-framework';
IntegrationFactory.register('slack', (config: IntegrationConfig) => new SlackIntegration(config));