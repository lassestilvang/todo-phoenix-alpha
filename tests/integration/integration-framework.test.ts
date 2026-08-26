import { IntegrationFactory, IntegrationRegistry, IntegrationManager, IntegrationConfig, IntegrationType } from '@/lib/integrations/integration-framework';
import { SlackIntegration } from '@/lib/integrations/slack-integration';
import { GitHubIntegration } from '@/lib/integrations/github-integration';
import { GoogleCalendarIntegration } from '@/lib/integrations/google-calendar-integration';
import { JiraIntegration } from '@/lib/integrations/jira-integration';
import { TeamsIntegration } from '@/lib/integrations/teams-integration';
import { NotionIntegration } from '@/lib/integrations/notion-integration';
import { OutlookIntegration } from '@/lib/integrations/outlook-integration';

describe('Integration Framework', () => {
  describe('IntegrationFactory', () => {
    it('should register and create Slack integration', () => {
      const config: IntegrationConfig = {
        id: 'slack_test',
        name: 'Test Slack',
        type: 'slack',
        enabled: true,
        credentials: { accessToken: 'xoxb-test-token' },
        settings: {
          autoSync: true,
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
          filters: { excludePatterns: [] },
          webhooksEnabled: true,
          webhookEvents: ['task.created', 'task.updated']
        },
        syncStatus: 'idle'
      };

      const integration = IntegrationFactory.create('slack', config);
      expect(integration).toBeInstanceOf(SlackIntegration);
    });

    it('should register and create GitHub integration', () => {
      const config: IntegrationConfig = {
        id: 'github_test',
        name: 'Test GitHub',
        type: 'github',
        enabled: true,
        credentials: { accessToken: 'ghp_test-token' },
        settings: {
          autoSync: true,
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
          filters: { excludePatterns: [] },
          webhooksEnabled: true,
          webhookEvents: ['task.created', 'task.updated']
        },
        syncStatus: 'idle'
      };

      const integration = IntegrationFactory.create('github', config);
      expect(integration).toBeInstanceOf(GitHubIntegration);
    });

    it('should return null for unsupported integration type', () => {
      const config: IntegrationConfig = {
        id: 'test',
        name: 'Test',
        type: 'unknown' as any,
        enabled: true,
        credentials: {},
        settings: {
          autoSync: true,
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
          filters: { excludePatterns: [] },
          webhooksEnabled: true,
          webhookEvents: ['task.created']
        },
        syncStatus: 'idle'
      };

      const integration = IntegrationFactory.create('unknown' as IntegrationType, config);
      expect(integration).toBeNull();
    });
  });

  describe('IntegrationRegistry', () => {
    it('should register and retrieve integrations', () => {
      const registry = new IntegrationRegistry();
      const slackConfig: IntegrationConfig = {
        id: 'slack_test',
        name: 'Test Slack',
        type: 'slack',
        enabled: true,
        credentials: { accessToken: 'xoxb-test-token' },
        settings: {
          autoSync: true,
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
          filters: { excludePatterns: [] },
          webhooksEnabled: true,
          webhookEvents: ['task.created', 'task.updated']
        },
        syncStatus: 'idle'
      };

      const slackIntegration = new SlackIntegration(slackConfig);
      registry.register(slackIntegration);

      const retrieved = registry.get('slack_test');
      expect(retrieved).toBe(slackIntegration);

      const config = registry.getConfig('slack_test');
      expect(config?.id).toBe('slack_test');
    });

    it('should return enabled integrations', () => {
      const registry = new IntegrationRegistry();

      // Create enabled integration
      const enabledConfig: IntegrationConfig = {
        id: 'enabled',
        name: 'Enabled',
        type: 'slack',
        enabled: true,
        credentials: { accessToken: 'xoxb-test-token' },
        settings: {
          autoSync: true,
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
          filters: { excludePatterns: [] },
          webhooksEnabled: true,
          webhookEvents: ['task.created']
        },
        syncStatus: 'idle'
      };

      // Create disabled integration
      const disabledConfig: IntegrationConfig = {
        id: 'disabled',
        name: 'Disabled',
        type: 'slack',
        enabled: false,
        credentials: { accessToken: 'xoxb-test-token' },
        settings: {
          autoSync: true,
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
          filters: { excludePatterns: [] },
          webhooksEnabled: true,
          webhookEvents: ['task.created']
        },
        syncStatus: 'idle'
      };

      registry.register(new SlackIntegration(enabledConfig));
      registry.register(new SlackIntegration(disabledConfig));

      const enabled = registry.getEnabled();
      expect(enabled).toHaveLength(1);
      expect(enabled[0].getConfig().id).toBe('enabled');
    });
  });

  describe('IntegrationManager', () => {
    let manager: IntegrationManager;

    beforeEach(() => {
      manager = IntegrationManager.getInstance();
      // Clear any existing registrations
      // In practice would need a reset method
    });

    afterEach(() => {
      manager.stop();
    });

    it('should be a singleton', () => {
      const manager2 = IntegrationManager.getInstance();
      expect(manager).toBe(manager2);
    });

    it('should register integration via manager', () => {
      const config: IntegrationConfig = {
        id: 'test_integration',
        name: 'Test Integration',
        type: 'slack': 'test_integration',
        type: 'slack',
        enabled: true,
        credentials: { accessToken: 'xoxb-test-token' },
        settings: {
          autoSync: true,
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
          filters: { excludePatterns: [] },
          webhooksEnabled: true,
          webhookEvents: ['task.created']
        },
        syncStatus: 'idle'
      };

      manager.registerIntegration(new SlackIntegration(config));
      const integration = manager.getRegistry().get('test_integration');
      expect(integration).toBeDefined();
    });
  });
});