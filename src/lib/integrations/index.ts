/**
 * Integration Framework
 *
 * This module provides a plugin architecture for connecting
 * external services (calendars, notification services, etc.)
 */

export interface IntegrationConfig {
  id: string;
  name: string;
  type: 'calendar' | 'notification' | 'webhook' | 'api';
  enabled: boolean;
  credentials?: Record<string, string>;
  settings?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationEvent {
  type: 'task_created' | 'task_updated' | 'task_completed' | 'task_deleted';
  payload: any;
  timestamp: string;
  integrationId: string;
}

export interface Integration {
  // Called when integration is first configured
  initialize(config: IntegrationConfig): Promise<void>;

  // Called when integration is disabled/removed
  cleanup(): Promise<void>;

  // Handle incoming webhook/event
  handleEvent(event: IntegrationEvent): Promise<void>;

  // Sync data to external service
  syncOutbound(data: any): Promise<void>;

  // Poll for changes from external service
  syncInbound(): Promise<any[]>;

  // Get integration metadata
  getMetadata(): { name: string; version: string; description: string };
}

// Registry for managing integrations
class IntegrationRegistry {
  private integrations = new Map<string, Integration>();

  register(id: string, integration: Integration): void {
    this.integrations.set(id, integration);
  }

  unregister(id: string): void {
    this.integrations.delete(id);
  }

  get(id: string): Integration | undefined {
    return this.integrations.get(id);
  }

  getAll(): Integration[] {
    return Array.from(this.integrations.values());
  }

  // Initialize all enabled integrations
  async initializeAll(configs: IntegrationConfig[]): Promise<void> {
    for (const config of configs) {
      if (config.enabled) {
        const integration = this.get(config.id);
        if (integration) {
          try {
            await integration.initialize(config);
          } catch (error) {
            console.error(`Failed to initialize integration ${config.id}:`, error);
          }
        }
      }
    }
  }
}

export const integrationRegistry = new IntegrationRegistry();

// Base integration class for common functionality
export abstract class BaseIntegration implements Integration {
  protected config?: IntegrationConfig;

  abstract getMetadata(): { name: string; version: string; description: string };

  async initialize(config: IntegrationConfig): Promise<void> {
    this.config = config;
    await this.onInitialize(config);
  }

  async cleanup(): Promise<void> {
    await this.onCleanup();
  }

  async handleEvent(event: IntegrationEvent): Promise<void> {
    await this.onEvent(event);
  }

  async syncOutbound(data: any): Promise<void> {
    await this.onSyncOutbound(data);
  }

  async syncInbound(): Promise<any[]> {
    return this.onSyncInbound();
  }

  // Override in subclasses
  protected async onInitialize(config: IntegrationConfig): Promise<void> {}
  protected async onCleanup(): Promise<void> {}
  protected async onEvent(event: IntegrationEvent): Promise<void> {}
  protected async onSyncOutbound(data: any): Promise<void> {}
  protected async onSyncInbound(): Promise<any[]> { return []; }
}

// Example: Webhook integration
export class WebhookIntegration extends BaseIntegration {
  getMetadata() {
    return {
      name: 'Webhook Integration',
      version: '1.0.0',
      description: 'Send events to external webhook endpoints'
    };
  }

  protected async onEvent(event: IntegrationEvent): Promise<void> {
    if (!this.config?.settings?.webhookUrl) return;

    try {
      await fetch(this.config.settings.webhookUrl as string, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
      });
    } catch (error) {
      console.error('Webhook delivery failed:', error);
    }
  }
}