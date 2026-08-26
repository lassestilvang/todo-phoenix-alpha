import { Task, TaskWithDetails, Subtask } from '@/lib/types';

/**
 * Universal Integration Framework
 * Provides a standardized way to connect Todo Phoenix Alpha with third-party services
 */

// ============================================
// CORE TYPES AND INTERFACES
// ============================================

export interface IntegrationConfig {
  id: string;
  name: string;
  type: IntegrationType;
  enabled: boolean;
  credentials: IntegrationCredentials;
  settings: IntegrationSettings;
  webhookUrl?: string;
  lastSync?: string;
  syncStatus: 'idle' | 'syncing' | 'error' | 'success';
  errorMessage?: string;
}

export type IntegrationType =
  | 'slack'
  | 'github'
  | 'google-calendar'
  | 'jira'
  | 'teams'
  | 'outlook'
  | 'notion'
  | 'linear'
  | 'asana'
  | 'trello'
  | 'custom';

export interface IntegrationCredentials {
  // OAuth tokens
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: number;
  // API keys
  apiKey?: string;
  apiSecret?: string;
  // Service-specific
  workspaceId?: string;
  organizationId?: string;
  projectId?: string;
}

export interface IntegrationSettings {
  // Sync settings
  autoSync: boolean;
  syncInterval: number; // minutes
  syncDirection: 'bidirectional' | 'import-only' | 'export-only';
  // Task mapping
  taskMapping: TaskMappingConfig;
  // Filters
  filters: IntegrationFilters;
  // Webhooks
  webhooksEnabled: boolean;
  webhookEvents: WebhookEvent[];
}

export interface TaskMappingConfig {
  // Field mappings between Todo Phoenix and external service
  titleField: string;
  descriptionField: string;
  statusField: string;
  priorityField: string;
  assigneeField: string;
  dueDateField: string;
  estimateField: string;
  labelsField: string;
  // Custom field mappings
  customFields: Record<string, string>;
}

export interface IntegrationFilters {
  // Which tasks to sync
  listIds?: number[];
  labelIds?: number[];
  priorityFilter?: ('high' | 'medium' | 'low' | 'none')[];
  statusFilter?: ('active' | 'completed')[];
  dateRange?: {
    start: string;
    end: string;
  };
  // Exclude patterns
  excludePatterns: string[];
}

export type WebhookEvent =
  | 'task.created'
  | 'task.updated'
  | 'task.deleted'
  | 'task.completed'
  | 'task.reopened'
  | 'comment.added'
  | 'assignee.changed'
  | 'status.changed'
  | 'priority.changed'
  | 'due-date.changed';

export interface SyncResult {
  success: boolean;
  imported: number;
  exported: number;
  updated: number;
  deleted: number;
  errors: SyncError[];
  duration: number;
  timestamp: string;
}

export interface SyncError {
  itemId: string;
  itemType: 'task' | 'subtask' | 'comment' | 'attachment';
  error: string;
  severity: 'warning' | 'error';
  recoverable: boolean;
}

export interface ExternalTask {
  id: string;
  externalId: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  assignee?: ExternalUser;
  dueDate?: string;
  startDate?: string;
  estimate?: number;
  actualTime?: number;
  labels: string[];
  url: string;
  projectId?: string;
  parentId?: string;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface ExternalUser {
  id: string;
  externalId: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  role?: string;
}

export interface ExternalProject {
  id: string;
  externalId: string;
  name: string;
  description?: string;
  key?: string;
  url: string;
  color?: string;
  members: ExternalUser[];
  metadata: Record<string, any>;
}

export interface ExternalComment {
  id: string;
  externalId: string;
  taskId: string;
  author: ExternalUser;
  content: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, any>;
}

// ============================================
// ABSTRACT BASE INTEGRATION
// ============================================

export abstract class BaseIntegration {
  protected config: IntegrationConfig;
  protected syncQueue: SyncOperation[] = [];
  protected isSyncing = false;

  constructor(config: IntegrationConfig) {
    this.config = config;
  }

  getConfig(): IntegrationConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<IntegrationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  abstract authenticate(): Promise<boolean>;
  abstract testConnection(): Promise<{ success: boolean; message: string }>;

  abstract getProjects(): Promise<ExternalProject[]>;
  abstract getProject(projectId: string): Promise<ExternalProject | null>;

  abstract getTasks(projectId?: string, filters?: IntegrationFilters): Promise<ExternalTask[]>;
  abstract getTask(taskId: string): Promise<ExternalTask | null>;

  abstract createTask(task: Partial<ExternalTask>): Promise<ExternalTask>;
  abstract updateTask(taskId: string, updates: Partial<ExternalTask>): Promise<ExternalTask>;
  abstract deleteTask(taskId: string): Promise<boolean>;

  abstract getComments(taskId: string): Promise<ExternalComment[]>;
  abstract addComment(taskId: string, content: string): Promise<ExternalComment>;
  abstract updateComment(commentId: string, content: string): Promise<ExternalComment>;
  abstract deleteComment(commentId: string): Promise<boolean>;

  abstract getUsers(projectId?: string): Promise<ExternalUser[]>;

  // Webhook management
  abstract registerWebhook(url: string, events: WebhookEvent[]): Promise<string>;
  abstract unregisterWebhook(webhookId: string): Promise<boolean>;
  abstract verifyWebhook(payload: any, signature: string): boolean;
  abstract processWebhook(payload: any): Promise<WebhookResult>;

  // Sync operations
  async sync(): Promise<SyncResult> {
    if (this.isSyncing) {
      return {
        success: false,
        imported: 0,
        exported: 0,
        updated: 0,
        deleted: 0,
        errors: [{ itemId: '', itemType: 'task', error: 'Sync already in progress', severity: 'error', recoverable: false }],
        duration: 0,
        timestamp: new Date().toISOString()
      };
    }

    this.isSyncing = true;
    const startTime = Date.now();
    const errors: SyncError[] = [];
    let imported = 0, exported = 0, updated = 0, deleted = 0;

    try {
      if (this.config.settings.syncDirection !== 'export-only') {
        const importResult = await this.importTasks();
        imported = importResult.imported;
        updated = importResult.updated;
        deleted = importResult.deleted;
        errors.push(...importResult.errors);
      }

      if (this.config.settings.syncDirection !== 'import-only') {
        const exportResult = await this.exportTasks();
        exported = exportResult.exported;
        updated += exportResult.updated;
        errors.push(...exportResult.errors);
      }

      this.config.lastSync = new Date().toISOString();
      this.config.syncStatus = errors.some(e => e.severity === 'error') ? 'error' : 'success';
      this.config.errorMessage = errors.filter(e => e.severity === 'error').map(e => e.error).join('; ');

      return {
        success: errors.filter(e => e.severity === 'error').length === 0,
        imported,
        exported,
        updated,
        deleted,
        errors,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.config.syncStatus = 'error';
      this.config.errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return {
        success: false,
        imported: 0,
        exported: 0,
        updated: 0,
        deleted: 0,
        errors: [{ itemId: '', itemType: 'task', error: this.config.errorMessage, severity: 'error', recoverable: false }],
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    } finally {
      this.isSyncing = false;
    }
  }

  protected abstract importTasks(): Promise<{ imported: number; updated: number; deleted: number; errors: SyncError[] }>;
  protected abstract exportTasks(): Promise<{ exported: number; updated: number; errors: SyncError[] }>;

  // Task transformation
  abstract transformToInternal(externalTask: ExternalTask): Partial<TaskWithDetails>;
  abstract transformToExternal(task: TaskWithDetails): Partial<ExternalTask>;

  // Credentials management
  async refreshToken(): Promise<boolean> {
    // Override in subclasses that support OAuth
    return false;
  }

  isAuthenticated(): boolean {
    return !!this.config.credentials.accessToken || !!this.config.credentials.apiKey;
  }

  // Event handling
  protected emitSyncProgress(progress: SyncProgress): void {
    // Override in implementation to emit events
  }
}

export interface SyncOperation {
  id: string;
  type: 'import' | 'export' | 'update' | 'delete';
  itemType: 'task' | 'subtask' | 'comment' | 'attachment';
  itemId: string;
  payload?: any;
  priority: number;
  retries: number;
  maxRetries: number;
  createdAt: string;
}

export interface SyncProgress {
  phase: 'import' | 'export' | 'complete';
  current: number;
  total: number;
  currentItem?: string;
}

// ============================================
// INTEGRATION REGISTRY
// ============================================

export class IntegrationRegistry {
  private integrations: Map<string, BaseIntegration> = new Map();
  private configs: Map<string, IntegrationConfig> = new Map();
  private eventListeners: Map<string, Function[]> = new Map();

  register(integration: BaseIntegration): void {
    const config = integration.getConfig();
    this.integrations.set(config.id, integration);
    this.configs.set(config.id, config);
    this.emit('integration:registered', config);
  }

  unregister(integrationId: string): void {
    const config = this.configs.get(integrationId);
    if (config) {
      this.integrations.delete(integrationId);
      this.configs.delete(integrationId);
      this.emit('integration:unregistered', config);
    }
  }

  get(integrationId: string): BaseIntegration | undefined {
    return this.integrations.get(integrationId);
  }

  getConfig(integrationId: string): IntegrationConfig | undefined {
    return this.configs.get(integrationId);
  }

  getAll(): BaseIntegration[] {
    return Array.from(this.integrations.values());
  }

  getAllConfigs(): IntegrationConfig[] {
    return Array.from(this.configs.values());
  }

  getByType(type: IntegrationType): BaseIntegration[] {
    return Array.from(this.integrations.values()).filter(
      i => i.getConfig().type === type
    );
  }

  getEnabled(): BaseIntegration[] {
    return Array.from(this.integrations.values()).filter(
      i => i.getConfig().enabled
    );
  }

  async syncAll(): Promise<Record<string, SyncResult>> {
    const results: Record<string, SyncResult> = {};

    for (const integration of this.getEnabled()) {
      results[integration.getConfig().id] = await integration.sync();
    }

    return results;
  }

  async sync(integrationId: string): Promise<SyncResult | null> {
    const integration = this.integrations.get(integrationId);
    if (!integration) return null;
    return integration.sync();
  }

  on(event: string, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  off(event: string, listener: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) listeners.splice(index, 1);
    }
  }

  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(data));
    }
  }
}

// ============================================
// INTEGRATION MANAGER (Singleton)
// ============================================

export class IntegrationManager {
  private static instance: IntegrationManager;
  private registry: IntegrationRegistry;
  private syncScheduler: NodeJS.Timeout | null = null;

  private constructor() {
    this.registry = new IntegrationRegistry();
    this.startSyncScheduler();
  }

  static getInstance(): IntegrationManager {
    if (!IntegrationManager.instance) {
      IntegrationManager.instance = new IntegrationManager();
    }
    return IntegrationManager.instance;
  }

  getRegistry(): IntegrationRegistry {
    return this.registry;
  }

  registerIntegration(integration: BaseIntegration): void {
    this.registry.register(integration);
  }

  unregisterIntegration(integrationId: string): void {
    this.registry.unregister(integrationId);
  }

  async syncIntegration(integrationId: string): Promise<SyncResult | null> {
    return this.registry.sync(integrationId);
  }

  async syncAll(): Promise<Record<string, SyncResult>> {
    return this.registry.syncAll();
  }

  private startSyncScheduler(): void {
    // Run sync check every minute
    this.syncScheduler = setInterval(async () => {
      await this.processScheduledSyncs();
    }, 60000);
  }

  private async processScheduledSyncs(): Promise<void> {
    const now = Date.now();

    for (const integration of this.registry.getEnabled()) {
      const config = integration.getConfig();

      if (!config.settings.autoSync || !config.lastSync) continue;

      const lastSync = new Date(config.lastSync).getTime();
      const intervalMs = config.settings.syncInterval * 60 * 1000;

      if (now - lastSync >= intervalMs) {
        try {
          await integration.sync();
        } catch (error) {
          console.error(`Scheduled sync failed for ${config.id}:`, error);
        }
      }
    }
  }

  stop(): void {
    if (this.syncScheduler) {
      clearInterval(this.syncScheduler);
      this.syncScheduler = null;
    }
  }
}

// ============================================
// TASK MAPPER UTILITY
// ============================================

export class TaskMapper {
  private mapping: TaskMappingConfig;

  constructor(mapping: TaskMappingConfig) {
    this.mapping = mapping;
  }

  mapToInternal(external: ExternalTask, fieldMap: Record<string, any>): Partial<TaskWithDetails> {
    const result: Partial<TaskWithDetails> = {};

    // Map standard fields
    if (this.mapping.titleField && external[this.mapping.titleField as keyof ExternalTask]) {
      result.name = String(external[this.mapping.titleField as keyof ExternalTask]);
    } else {
      result.name = external.title;
    }

    if (this.mapping.descriptionField && external[this.mapping.descriptionField as keyof ExternalTask]) {
      result.description = String(external[this.mapping.descriptionField as keyof ExternalTask]);
    } else {
      result.description = external.description;
    }

    // Map status
    const status = external[this.mapping.statusField as keyof ExternalTask] || external.status;
    result.is_completed = this.mapStatusToInternal(status);

    // Map priority
    const priority = external[this.mapping.priorityField as keyof ExternalTask] || external.priority;
    result.priority = this.mapPriorityToInternal(String(priority));

    // Map due date
    const dueDate = external[this.mapping.dueDateField as keyof ExternalTask] || external.dueDate;
    if (dueDate) result.deadline = String(dueDate);

    // Map estimate
    const estimate = external[this.mapping.estimateField as keyof ExternalTask] || external.estimate;
    if (estimate) result.estimate_minutes = Number(estimate);

    // Map labels
    const labels = external[this.mapping.labelsField as keyof ExternalTask] || external.labels;
    if (Array.isArray(labels)) {
      // Labels would need to be created/found in DB
      // result.labels = labels; // This would be handled by the integration
    }

    // Map custom fields
    for (const [internalField, externalField] of Object.entries(this.mapping.customFields)) {
      if (external[externalField as keyof ExternalTask] !== undefined) {
        (result as any)[internalField] = external[externalField as keyof ExternalTask];
      }
    }

    // Store external reference
    result.dependencies = JSON.stringify({
      externalId: external.externalId,
      externalUrl: external.url,
      source: 'integration',
      syncedAt: new Date().toISOString()
    });

    return result;
  }

  mapToExternal(internal: TaskWithDetails): Partial<ExternalTask> {
    const result: Partial<ExternalTask> = {};

    // Map standard fields
    result.title = internal.name;
    result.description = internal.description || '';
    result.status = this.mapStatusToExternal(internal.is_completed);
    result.priority = this.mapPriorityToExternal(internal.priority);
    result.dueDate = internal.deadline || undefined;
    result.estimate = internal.estimate_minutes || undefined;
    result.actualTime = internal.actual_minutes || undefined;
    result.labels = []; // Would be populated from internal.labels

    // Map custom fields
    for (const [internalField, externalField] of Object.entries(this.mapping.customFields)) {
      if ((internal as any)[internalField] !== undefined) {
        result[externalField] = (internal as any)[internalField];
      }
    }

    return result;
  }

  private mapStatusToInternal(externalStatus: string): number {
    const completedStatuses = ['done', 'completed', 'closed', 'resolved', 'finished'];
    return completedStatuses.some(s => externalStatus.toLowerCase().includes(s)) ? 1 : 0;
  }

  private mapStatusToExternal(internalStatus: number): string {
    return internalStatus === 1 ? 'completed' : 'active';
  }

  private mapPriorityToInternal(externalPriority: string): 'high' | 'medium' | 'low' | 'none' {
    const p = externalPriority.toLowerCase();
    if (['high', 'critical', 'urgent', 'p1', 'p0'].includes(p)) return 'high';
    if (['medium', 'normal', 'p2', 'p3'].includes(p)) return 'medium';
    if (['low', 'minor', 'p4'].includes(p)) return 'low';
    return 'none';
  }

  private mapPriorityToExternal(internalPriority: string): string {
    const map: Record<string, string> = {
      high: 'high',
      medium: 'medium',
      low: 'low',
      none: 'none'
    };
    return map[internalPriority] || 'none';
  }
}

// ============================================
// WEBHOOK HANDLER
// ============================================

export interface WebhookResult {
  success: boolean;
  action: 'created' | 'updated' | 'deleted' | 'ignored';
  itemType: 'task' | 'subtask' | 'comment' | 'attachment';
  itemId: string;
  internalId?: number;
  message?: string;
}

export abstract class WebhookHandler {
  abstract verifySignature(payload: string, signature: string): boolean;
  abstract parsePayload(payload: any): WebhookPayload | null;
  abstract handleEvent(payload: WebhookPayload): Promise<WebhookResult>;
}

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: {
    task?: ExternalTask;
    comment?: ExternalComment;
    user?: ExternalUser;
    project?: ExternalProject;
    changes?: Record<string, { old: any; new: any }>;
  };
  source: IntegrationType;
}

// ============================================
// FACTORY FOR CREATING INTEGRATIONS
// ============================================

export class IntegrationFactory {
  private static creators: Map<IntegrationType, (config: IntegrationConfig) => BaseIntegration> = new Map();

  static register(type: IntegrationType, creator: (config: IntegrationConfig) => BaseIntegration): void {
    this.creators.set(type, creator);
  }

  static create(type: IntegrationType, config: IntegrationConfig): BaseIntegration | null {
    const creator = this.creators.get(type);
    if (!creator) {
      console.warn(`No integration creator registered for type: ${type}`);
      return null;
    }
    return creator(config);
  }

  static getSupportedTypes(): IntegrationType[] {
    return Array.from(this.creators.keys());
  }
}

// ============================================
// DEFAULT CONFIGURATIONS
// ============================================

export function createDefaultConfig(type: IntegrationType): Partial<IntegrationConfig> {
  return {
    type,
    enabled: true,
    credentials: {},
    settings: {
      autoSync: false,
      syncInterval: 15,
      syncDirection: 'bidirectional',
      taskMapping: {
        titleField: 'title',
        descriptionField: 'description',
        statusField: 'status',
        priorityField: 'priority',
        assigneeField: 'assignee',
        dueDateField: 'dueDate',
        estimateField: 'estimate',
        labelsField: 'labels',
        customFields: {}
      },
      filters: {
        excludePatterns: []
      },
      webhooksEnabled: true,
      webhookEvents: [
        'task.created',
        'task.updated',
        'task.deleted',
        'task.completed',
        'comment.added'
      ]
    },
    syncStatus: 'idle'
  };
}