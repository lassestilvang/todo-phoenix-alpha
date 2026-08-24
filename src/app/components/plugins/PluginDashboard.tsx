"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plug } from 'lucide-react';

interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  isEnabled: boolean;
  settings: Record<string, any>;
  hooks: string[];
}

interface PluginStats {
  total: number;
  enabled: number;
  disabled: number;
  byHook: Record<string, number>;
  systemHealth: {
    active: boolean;
    errors: number;
    lastCheck: string;
  };
}

export default function PluginDashboard() {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [stats, setStats] = useState<PluginStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch plugins and stats
  useEffect(() => {
    fetchPlugins();
    fetchPluginStats();
  }, []);

  const fetchPlugins = async () => {
    try {
      const response = await fetch('/api/plugins');
      const data = await response.json();
      if (data.success) {
        setPlugins(data.plugins);
      }
    } catch (error) {
      console.error('Failed to fetch plugins:', error);
    }
  };

  const fetchPluginStats = async () => {
    try {
      const response = await fetch('/api/plugins?action=stats');
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch plugin stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTogglePlugin = async (pluginId: string, currentEnabled: boolean) => {
    try {
      const response = await fetch(`/api/plugins?action=toggle-plugin&pluginId=${pluginId}`, {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        setPlugins(prev => prev.map(p =>
          p.id === pluginId ? { ...p, isEnabled: data.isEnabled } : p
        ));
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Failed to toggle plugin:', error);
    }
  };

  const handleUpdateSettings = async (pluginId: string, newSettings: Partial<Record<string, any>>) => {
    try {
      const response = await fetch('/api/plugins?action=update-settings&pluginId=' + pluginId, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
      const data = await response.json();

      if (data.success) {
        setPlugins(prev => prev.map(p =>
          p.id === pluginId ? { ...p, settings: { ...p.settings, ...newSettings } } : p
        ));
      }
    } catch (error) {
      console.error('Failed to update plugin settings:', error);
    }
  };

  const filteredPlugins = plugins.filter(plugin =>
    plugin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    plugin.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Plugin Management</h1>
          <p className="text-muted-foreground">
            Manage and configure plugins for extended functionality
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Plug className="h-5 w-5 text-blue-600" />
          <span className="text-sm text-muted-foreground">
            {stats?.enabled || 0} of {stats?.total || 0} plugins enabled
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Plugins</CardTitle>
              <Plug className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Enabled</CardTitle>
              <div className="h-4 w-4 rounded-full bg-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.enabled}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Disabled</CardTitle>
              <div className="h-4 w-4 rounded-full bg-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-600">{stats.disabled}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Health</CardTitle>
              <div className={`h-4 w-4 rounded-full ${stats.systemHealth.active ? 'bg-green-500' : 'bg-red-500'}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.systemHealth.active ? 'Active' : 'Inactive'}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.systemHealth.errors} errors
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs defaultValue="plugins" className="space-y-4">
        <TabsList>
          <TabsTrigger value="plugins">Plugins</TabsTrigger>
          <TabsTrigger value="hooks">Hook Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="plugins" className="space-y-4">
          {/* Search */}
          <div className="flex items-center space-x-2">
            <Input
              placeholder="Search plugins..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>

          {/* Plugin Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredPlugins.map((plugin) => (
              <Card key={plugin.id} className="relative">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{plugin.name}</CardTitle>
                      <CardDescription>{plugin.description}</CardDescription>
                    </div>
                    <Switch
                      checked={plugin.isEnabled}
                      onCheckedChange={() => handleTogglePlugin(plugin.id, plugin.isEnabled)}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>v{plugin.version}</span>
                    <span>{plugin.author}</span>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Enabled Hooks</Label>
                    <div className="flex flex-wrap gap-1">
                      {plugin.hooks.map((hook) => (
                        <Badge key={hook} variant="secondary" className="text-xs">
                          {hook}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {Object.keys(plugin.settings).length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Settings</Label>
                      <div className="text-xs text-muted-foreground">
                        {Object.keys(plugin.settings).length} configuration options
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="hooks" className="space-y-4">
          {stats?.byHook && Object.keys(stats.byHook).length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Hook Distribution</CardTitle>
                <CardDescription>
                  Statistics on which hooks are available across enabled plugins
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(stats.byHook).map(([hook, count]) => (
                    <div key={hook} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{hook}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {count} plugin{count !== 1 ? 's' : ''} using this hook
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-muted-foreground">No hook statistics available</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}