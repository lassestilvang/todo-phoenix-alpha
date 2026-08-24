/**
 * Plugin System for Todo Phoenix Alpha
 * Provides extensible architecture for adding custom functionality
 */

export interface AgentPlugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;

  // Lifecycle hooks
  onLoad?: () => Promise<void> | void;
  onUnload?: () => Promise<void> | void;

  // Integration points
  registerRoutes?: (app: any) => void;
  registerComponents?: () => Record<string, React.ComponentType<any>>;
  registerStyles?: () => string;

  // Task-related hooks
  onTaskCreate?: (task: any) => Promise<any> | any;
  onTaskUpdate?: (task: any, changes: any) => Promise<any> | any;
  onTaskDelete?: (taskId: number) => Promise<void> | void;
  onTaskComplete?: (taskId: number) => Promise<void> | void;

  // Time tracking hooks
  onTimeStart?: (timeEntry: any) => Promise<void> | void;
  onTimeStop?: (timeEntry: any) => Promise<void> | void;

  // Settings
  defaultSettings?: Record<string, any>;
  settingsSchema?: Record<string, any>;
}

export class PluginManager {
  private plugins: Map<string, AgentPlugin> = new Map();
  private pluginInstances: Map<string, any> = new Map();
  private pluginSettings: Map<string, Record<string, any>> = new Map();

  constructor() {
    // Load built-in plugins
    this.loadBuiltInPlugins();
  }

  /**
   * Register a plugin with the system
   */
  async registerPlugin(plugin: AgentPlugin): Promise<boolean> {
    try {
      // Validate plugin
      if (!plugin.id || !plugin.name) {
        console.error('Plugin must have id and name');
        return false;
      }

      // Check if already registered
      if (this.plugins.has(plugin.id)) {
        console.warn(`Plugin ${plugin.id} already registered`);
        return false;
      }

      // Store plugin
      this.plugins.set(plugin.id, plugin);

      // Load default settings
      if (plugin.defaultSettings) {
        this.pluginSettings.set(plugin.id, { ...plugin.defaultSettings });
      }

      // Initialize plugin
      if (plugin.onLoad) {
        await plugin.onLoad();
      }

      console.log(`Plugin registered: ${plugin.name} v${plugin.version}`);
      return true;
    } catch (error) {
      console.error(`Failed to register plugin ${plugin.id}:`, error);
      return false;
    }
  }

  /**
   * Unregister a plugin
   */
  async unregisterPlugin(pluginId: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      console.warn(`Plugin ${pluginId} not found`);
      return false;
    }

    try {
      // Unload plugin
      if (plugin.onUnload) {
        await plugin.onUnload();
      }

      // Clean up
      this.plugins.delete(pluginId);
      this.pluginInstances.delete(pluginId);
      this.pluginSettings.delete(pluginId);

      console.log(`Plugin unregistered: ${plugin.name}`);
      return true;
    } catch (error) {
      console.error(`Failed to unregister plugin ${pluginId}:`, error);
      return false;
    }
  }

  /**
   * Get a registered plugin
   */
  getPlugin(pluginId: string): AgentPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Get all registered plugins
   */
  getPlugins(): AgentPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get enabled plugins
   */
  getEnabledPlugins(): AgentPlugin[] {
    return Array.from(this.plugins.values()).filter(plugin =>
      !this.pluginSettings.get(plugin.id)?.disabled
    );
  }

  /**
   * Update plugin settings
   */
  async updatePluginSettings(
    pluginId: string,
    settings: Partial<Record<string, any>>
  ): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      console.warn(`Plugin ${pluginId} not found`);
      return false;
    }

    try {
      const currentSettings = this.pluginSettings.get(pluginId) || {};
      const updatedSettings = { ...currentSettings, ...settings };
      this.pluginSettings.set(pluginId, updatedSettings);

      // Notify plugin of settings change if it has a handler
      // This would be implemented in the plugin itself

      return true;
    } catch (error) {
      console.error(`Failed to update settings for plugin ${pluginId}:`, error);
      return false;
    }
  }

  /**
   * Get plugin settings
   */
  getPluginSettings(pluginId: string): Record<string, any> | undefined {
    return this.pluginSettings.get(pluginId);
  }

  /**
   * Execute a plugin hook across all enabled plugins
   */
  async executeHook<T = any>(
    hookName: keyof AgentPlugin,
    ...args: any[]
  ): Promise<T[]> {
    const results: T[] = [];

    for (const plugin of this.getEnabledPlugins()) {
      const hook = plugin[hookName];
      if (hook && typeof hook === 'function') {
        try {
          const result = await (hook as (...a: any[]) => Promise<T> | T)(...args);
          if (result !== undefined) {
            results.push(result);
          }
        } catch (error) {
          console.error(`Plugin ${plugin.id} hook ${hookName} failed:`, error);
        }
      }
    }

    return results;
  }

  /**
   * Load built-in plugins
   */
  private loadBuiltInPlugins() {
    // Built-in plugins would be registered here
    // For now, we'll leave this empty as plugins are loaded dynamically
  }
}

// Global plugin manager instance
export const pluginManager = new PluginManager();