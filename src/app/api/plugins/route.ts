import { NextResponse } from 'next/server';
import { pluginManager } from '@/lib/plugins/plugin-system';

// Plugin actions interface
export interface PluginAction {
  type: string;
  payload: any;
}

// GET handler - list all plugins
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const pluginId = searchParams.get('pluginId');

    switch (action) {
      case 'toggle-plugin':
        return await handleTogglePlugin(pluginId);
      case 'update-settings':
        return await handleUpdateSettings(pluginId, await request.json());
      case 'execute-hook':
        return await handleExecuteHook(await request.json());
      case 'stats':
        return await handleGetPluginStats();
      default:
        // List all plugins
        const plugins = pluginManager.getPlugins();
        const enabledPlugins = pluginManager.getEnabledPlugins();

        return NextResponse.json({
          success: true,
          plugins: plugins.map(p => ({
            id: p.id,
            name: p.name,
            version: p.version,
            description: p.description,
            author: p.author,
            isEnabled: !pluginManager.getPluginSettings(p.id)?.disabled,
            settings: pluginManager.getPluginSettings(p.id)
          })),
          total: plugins.length,
          enabled: enabledPlugins.length
        });
    }
  } catch (error) {
    console.error('Plugin API error:', error);
    return NextResponse.json(
      { success: false, error: 'Plugin API error' },
      { status: 500 }
    );
  }
}

// POST handler - perform plugin actions
export async function POST(request: Request) {
  return GET(request); // Reuse GET logic for actions
}

// Handle toggle plugin
async function handleTogglePlugin(pluginId: string | null) {
  if (!pluginId) {
    return NextResponse.json(
      { success: false, error: 'Plugin ID is required' },
      { status: 400 }
    );
  }

  const plugin = pluginManager.getPlugin(pluginId);
  if (!plugin) {
    return NextResponse.json(
      { success: false, error: 'Plugin not found' },
      { status: 404 }
    );
  }

  const settings = pluginManager.getPluginSettings(pluginId) || {};
  const isCurrentlyDisabled = settings.disabled || false;

  // Toggle disabled state
  await pluginManager.updatePluginSettings(pluginId, {
    disabled: !isCurrentlyDisabled
  });

  return NextResponse.json({
    success: true,
    pluginId: pluginId,
    isEnabled: !isCurrentlyDisabled,
    message: `Plugin ${isCurrentlyDisabled ? 'enabled' : 'disabled'} successfully`
  });
}

// Handle update settings
async function handleUpdateSettings(
  pluginId: string | null,
  settings: Partial<Record<string, any>>
) {
  if (!pluginId) {
    return NextResponse.json(
      { success: false, error: 'Plugin ID is required' },
      { status: 400 }
    );
  }

  const plugin = pluginManager.getPlugin(pluginId);
  if (!plugin) {
    return NextResponse.json(
      { success: false, error: 'Plugin not found' },
      { status: 404 }
    );
  }

  const result = await pluginManager.updatePluginSettings(pluginId, settings);

  return NextResponse.json({
    success: result,
    pluginId: pluginId,
    settings: result ? pluginManager.getPluginSettings(pluginId) : null,
    message: result ? 'Settings updated successfully' : 'Failed to update settings'
  });
}

// Handle execute hook
async function handleExecuteHook(action: PluginAction) {
  const { type, payload } = action;

  if (!type) {
    return NextResponse.json(
      { success: false, error: 'Hook type is required' },
      { status: 400 }
    );
  }

  try {
    // Map action types to plugin hooks
    const hookMap: Record<string, keyof import('@/lib/plugins/plugin-system').AgentPlugin> = {
      'task-create': 'onTaskCreate',
      'task-update': 'onTaskUpdate',
      'task-delete': 'onTaskDelete',
      'task-complete': 'onTaskComplete',
      'time-start': 'onTimeStart',
      'time-stop': 'onTimeStop'
    };

    const hookName = hookMap[type];
    if (!hookName) {
      return NextResponse.json(
        { success: false, error: `Unknown hook type: ${type}` },
        { status: 400 }
      );
    }

    // Execute hook across all plugins
    const results = await pluginManager.executeHook(hookName, payload);

    return NextResponse.json({
      success: true,
      hook: type,
      results,
      executedBy: results.length
    });
  } catch (error) {
    console.error(`Error executing hook ${type}:`, error);
    return NextResponse.json(
      { success: false, error: `Failed to execute hook: ${error}` },
      { status: 500 }
    );
  }
}

// Handle get plugin stats
async function handleGetPluginStats() {
  const plugins = pluginManager.getPlugins();
  const enabledPlugins = pluginManager.getEnabledPlugins();

  // Calculate plugin statistics
  const stats = {
    total: plugins.length,
    enabled: enabledPlugins.length,
    disabled: plugins.length - enabledPlugins.length,
    byHook: {} as Record<string, number>,
    systemHealth: {
      active: true,
      errors: 0,
      lastCheck: new Date().toISOString()
    }
  };

  // Count hooks by enabled plugins
  const hookCounts: Record<string, number> = {};
  enabledPlugins.forEach(plugin => {
    // Count available hooks
    const hooks = Object.keys(plugin).filter(key => key.startsWith('on') && typeof plugin[key as keyof import('@/lib/plugins/plugin-system').AgentPlugin] === 'function');
    hooks.forEach(hook => {
      hookCounts[hook] = (hookCounts[hook] || 0) + 1;
    });
  });

  stats.byHook = hookCounts;

  return NextResponse.json({
    success: true,
    stats,
    plugins: plugins.map(p => ({
      id: p.id,
      name: p.name,
      version: p.version,
      isEnabled: !pluginManager.getPluginSettings(p.id)?.disabled,
      hooks: Object.keys(p).filter(key => key.startsWith('on') && typeof p[key as keyof import('@/lib/plugins/plugin-system').AgentPlugin] === 'function')
    }))
  });
}