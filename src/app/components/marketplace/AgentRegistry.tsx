"use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Bot,
  Play,
  Pause,
  Settings,
  Activity,
  DollarSign,
  Users,
  Shield,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Brain,
  Cpu,
  Globe,
  Search,
  Star,
  Download,
  Upload,
  Trash2,
  Plus,
  Edit,
} from 'lucide-react';

interface AgentManifest {
  id: string;
  name: string;
  description: string;
  version: string;
  category: string;
  tags: string[];
  capabilities: string[];
  inputs: AgentInput[];
  outputs: AgentOutput[];
  pricing: AgentPricing;
  requirements: AgentRequirements;
  security: AgentSecurity;
  stats: AgentStats;
  author: AgentAuthor;
  rating: number;
  installs: number;
  health: number;
  lastUpdated: string;
  isVerified: boolean;
  isFeatured: boolean;
}

interface AgentInput {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'file';
  description: string;
  required: boolean;
  default?: any;
  validation?: ValidationRule;
}

interface AgentOutput {
  name: string;
  type: 'task' | 'insight' | 'action' | 'data' | 'notification';
  description: string;
  schema?: any;
}

interface ValidationRule {
  min?: number;
  max?: number;
  pattern?: string;
  enum?: string[];
}

interface AgentPricing {
  model: 'free' | 'subscription' | 'paypercall' | 'freemium';
  price?: number;
  currency?: string;
  interval?: 'hour' | 'day' | 'month' | 'year';
  limits?: { [key: string]: number };
}

interface AgentRequirements {
  minMemory?: string;
  maxMemory?: string;
  minCpu?: string;
  maxCpu?: string;
  permissions?: string[];
}

interface AgentSecurity {
  sandbox: boolean;
  isolationLevel: 'low' | 'medium' | 'high';
  encryption?: boolean;
  auditLogging: boolean;
  dataHandling: 'user_only' | 'internal' | 'public';
}

interface AgentStats {
  usageCount: number;
  successRate: number;
  avgExecutionTime: number;
  lastExecution?: string;
  uptime: number;
}

interface AgentAuthor {
  name: string;
  email: string;
  organization?: string;
  website?: string;
  verified: boolean;
}

interface AgentExecution {
  id: string;
  agentId: string;
  input: any;
  output: any;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout';
  startedAt: string;
  completedAt?: string;
  executionTime: number;
  error?: string;
}

const AGENT_CATEGORIES = [
  { value: 'ai', label: 'AI & Machine Learning', icon: Brain },
  { value: 'productivity', label: 'Productivity', icon: TrendingUp },
  { value: 'communication', label: 'Communication', icon: Globe },
  { value: 'analysis', label: 'Data Analysis', icon: Activity },
  { value: 'automation', label: 'Automation', icon: Cpu },
  { value: 'security', label: 'Security', icon: Shield },
  { value: 'integration', label: 'Integrations', icon: Download },
  { value: 'utility', label: 'Utilities', icon: Settings },
];

const SECURITY_LEVELS = [
  { value: 'low', label: 'Standard', description: 'User data access' },
  { value: 'medium', label: 'Restricted', description: 'Limited data access' },
  { value: 'high', label: 'Isolated', description: 'Full sandbox isolation' },
];

// Agent capability icons mapping
const CAPABILITY_ICONS: Record<string, any> = {
  'parse-text': Brain,
  'extract-tasks': Target,
  'priority-suggest': TrendingUp,
  'check-availability': Calendar,
  'find-slots': Clock,
  'send-invitations': Users,
  'track-time': Activity,
  'categorize-activities': BarChart3,
  'generate-reports': FileText,
  'analyze-tasks': Search,
  'calculate-priority': Star,
  'suggest-order': ListOrdered,
  'check-agent-status': AlertCircle,
  'send-message': MessageSquare,
  'schedule-meeting': CalendarDays,
  'manage-calendar': Calendar,
  'send-notification': Bell,
  'track-progress': TrendingUp,
  'generate-insight': Lightbulb,
  'validate-input': CheckCircle,
  'sanitize-output': Shield,
};

// Other needed imports
import {
  CalendarDays,
  Calendar,
  AlertCircle,
  FileText,
  ListOrdered,
  MessageSquare,
  Bell,
  Lightbulb,
  CheckCircle,
  Shield,
} from 'lucide-react';

export function AgentRegistry() {
  const [agents, setAgents] = useState<AgentManifest[]>([]);
  const [filteredAgents, setFilteredAgents] = useState<AgentManifest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSecurity, setSelectedSecurity] = useState<string | null>(null);
  const [installedAgents, setInstalledAgents] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentManifest | null>(null);

  useEffect(() => {
    fetchAgents();
    loadInstalledAgents();
  }, []);

  useEffect(() => {
    filterAgents();
  }, [agents, searchQuery, selectedCategory, selectedSecurity]);

  const fetchAgents = async () => {
    setLoading(true);
    try {
      // Simulated API call
      const mockAgents: AgentManifest[] = [
        {
          id: 'email-summarizer',
          name: 'Email Summarizer',
          description: 'Analyzes emails and extracts actionable tasks',
          version: '1.2.0',
          category: 'productivity',
          tags: ['email', 'summarization', 'tasks', 'automation'],
          capabilities: ['parse-text', 'extract-tasks', 'priority-suggest', 'validate-input', 'sanitize-output'],
          inputs: [
            { name: 'emails', type: 'array', description: 'List of email contents', required: true },
            { name: 'timeframe', type: 'string', description: 'Analysis period', required: false, default: 'today' },
          ],
          outputs: [
            { name: 'tasks', type: 'task', description: 'Extracted tasks' },
            { name: 'summary', type: 'data', description: 'Summary statistics' },
          ],
          pricing: { model: 'freemium', limits: { requests: 100, 'max-emails': 50 } },
          requirements: { minMemory: '256MB', minCpu: '1 core' },
          security: { sandbox: true, isolationLevel: 'medium', auditLogging: true, dataHandling: 'user_only' },
          stats: { usageCount: 1250, successRate: 0.94, avgExecutionTime: 2.3, uptime: 0.98 },
          author: { name: 'Todo Phoenix Labs', email: 'labs@todophoenix.ai', verified: true },
          rating: 4.7,
          installs: 1250,
          health: 98,
          lastUpdated: '2024-01-15',
          isVerified: true,
          isFeatured: true,
        },
        {
          id: 'meeting-scheduler',
          name: 'Meeting Scheduler',
          description: 'Automatically schedules meetings based on calendar availability',
          version: '0.9.1',
          category: 'automation',
          tags: ['calendar', 'scheduling', 'meetings', 'availability'],
          capabilities: ['check-availability', 'find-slots', 'send-invitations'],
          inputs: [
            { name: 'attendees', type: 'array', description: 'List of attendees', required: true },
            { name: 'preferences', type: 'object', description: 'Scheduling preferences', required: false },
          ],
          outputs: [
            { name: 'meetings', type: 'task', description: 'Proposed meeting slots' },
            { name: 'invitation', type: 'notification', description: 'Calendar invitation' },
          ],
          pricing: { model: 'subscription', price: 9.99, currency: 'USD', interval: 'month', limits: { 'max-attendees': 20 } },
          requirements: { minMemory: '512MB', minCpu: '2 cores' },
          security: { sandbox: true, isolationLevel: 'high', auditLogging: true, dataHandling: 'user_only' },
          stats: { usageCount: 850, successRate: 0.89, avgExecutionTime: 5.1, uptime: 0.96 },
          author: { name: 'CalendarPro', email: 'contact@calendarpro.com', verified: true },
          rating: 4.5,
          installs: 850,
          health: 94,
          lastUpdated: '2024-01-10',
          isVerified: true,
          isFeatured: false,
        },
        {
          id: 'time-tracker',
          name: 'Intelligent Time Tracker',
          description: 'Tracks time spent on tasks with AI-powered categorization',
          version: '2.1.0',
          category: 'productivity',
          tags: ['time-tracking', 'analytics', 'categorization', 'productivity'],
          capabilities: ['track-time', 'categorize-activities', 'generate-reports'],
          inputs: [
            { name: 'activities', type: 'array', description: 'List of activities', required: true },
            { name: 'project', type: 'string', description: 'Project context', required: false },
          ],
          outputs: [
            { name: 'time-data', type: 'data', description: 'Processed time entries' },
            { name: 'insights', type: 'insight', description: 'Productivity insights' },
          ],
          pricing: { model: 'free' },
          requirements: { minMemory: '128MB', minCpu: '1 core' },
          security: { sandbox: false, isolationLevel: 'low', auditLogging: true, dataHandling: 'user_only' },
          stats: { usageCount: 2100, successRate: 0.92, avgExecutionTime: 1.8, uptime: 0.99 },
          author: { name: 'TimeFlow', email: 'support@timeflow.app', verified: false },
          rating: 4.3,
          installs: 2100,
          health: 99,
          lastUpdated: '2024-01-20',
          isVerified: false,
          isFeatured: true,
        },
        {
          id: 'task-prioritorizer',
          name: 'Task Prioritizer',
          description: 'AI-powered task prioritization based on deadlines, dependencies, and importance',
          version: '1.5.0',
          category: 'ai',
          tags: ['prioritization', 'ai', 'dependencies', 'urgency'],
          capabilities: ['analyze-tasks', 'calculate-priority', 'suggest-order'],
          inputs: [
            { name: 'tasks', type: 'array', description: 'List of tasks to prioritize', required: true },
            { name: 'context', type: 'object', description: 'User context and preferences', required: false },
          ],
          outputs: [
            { name: 'prioritized-tasks', type: 'task', description: 'Tasks ordered by priority' },
            { name: 'recommendations', type: 'insight', description: 'Prioritization reasoning' },
          ],
          pricing: { model: 'paypercall', price: 0.1, currency: 'USD' },
          requirements: { minMemory: '256MB', minCpu: '2 cores' },
          security: { sandbox: true, isolationLevel: 'high', auditLogging: true, dataHandling: 'user_only' },
          stats: { usageCount: 600, successRate: 0.91, avgExecutionTime: 3.2, uptime: 0.95 },
          author: { name: 'SmartPriority', email: 'hello@smartpriority.ai', verified: true },
          rating: 4.8,
          installs: 600,
          health: 92,
          lastUpdated: '2024-01-05',
          isVerified: true,
          isFeatured: true,
        },
      ];

      setAgents(mockAgents);
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadInstalledAgents = () => {
    try {
      const installed = localStorage.getItem('installed-agents');
      if (installed) {
        setInstalledAgents(JSON.parse(installed));
      }
    } catch (error) {
      console.error('Failed to load installed agents:', error);
    }
  };

  const filterAgents = () => {
    let filtered = agents.filter((agent) => {
      const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           agent.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           agent.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = !selectedCategory || agent.category === selectedCategory;
      const matchesSecurity = !selectedSecurity || agent.security.isolationLevel === selectedSecurity;
      return matchesSearch && matchesCategory && matchesSecurity;
    });

    setFilteredAgents(filtered);
  };

  const installAgent = async (agent: AgentManifest) => {
    try {
      // Simulate installation
      await new Promise(resolve => setTimeout(resolve, 1000));

      const updatedInstalled = [...installedAgents, agent.id];
      setInstalledAgents(updatedInstalled);
      localStorage.setItem('installed-agents', JSON.stringify(updatedInstalled));

      // Show success message
      console.log(`Installed agent: ${agent.name}`);
    } catch (error) {
      console.error('Failed to install agent:', error);
    }
  };

  const uninstallAgent = async (agentId: string) => {
    try {
      const updatedInstalled = installedAgents.filter((id) => id !== agentId);
      setInstalledAgents(updatedInstalled);
      localStorage.setItem('installed-agents', JSON.stringify(updatedInstalled));

      console.log(`Uninstalled agent: ${agentId}`);
    } catch (error) {
      console.error('Failed to uninstall agent:', error);
    }
  };

  const getCategoryIcon = (category: string) => {
    const cat = AGENT_CATEGORIES.find((c) => c.value === category);
    return cat?.icon || Bot;
  };n
  const getSecurityColor = (level: string) => {
    switch (level) {
      case 'high': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="agent-registry w-full max-w-7xl mx-auto p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Agent Marketplace</h1>
        <p className="text-muted-foreground">
          Discover and install intelligent agents to enhance your task management workflow.
        </p>
      </header>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4 md:space-y-0 md:flex md:gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search agents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="md:w-48">
          <Select value={selectedCategory || ''} onValueChange={(value) => setSelectedCategory(value || null)}>
            <SelectTrigger>
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {AGENT_CATEGORIES.map((category) => (
                <SelectItem key={category.value} value={category.value}>
                  <div className="flex items-center gap-2">
                    <category.icon className="h-4 w-4" />
                    {category.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="md:w-48">
          <Select value={selectedSecurity || ''} onValueChange={(value) => setSelectedSecurity(value || null)}>
            <SelectTrigger>
              <SelectValue placeholder="Security Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              {SECURITY_LEVELS.map((level) => (
                <SelectItem key={level.value} value={level.value}>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    {level.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats and Loading */}
      <div className="flex justify-between items-center mb-6">
        <div className="text-sm text-muted-foreground">
          {loading ? 'Loading...' : `${filteredAgents.length} agents found`}
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="secondary">
            <CheckCircle className="h-3 w-3 mr-1" />
            {installedAgents.length} Installed
          </Badge>
        </div>
      </div>

      {/* Agent Grid */}
      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="h-3 bg-muted rounded" />
                  <div className="h-3 bg-muted rounded w-5/6" />
                  <div className="h-8 bg-muted rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredAgents.map((agent) => (
            <Card
              key={agent.id}
              className={`relative hover:shadow-lg transition-shadow ${agent.isFeatured ? 'border-primary/50' : ''}`}
            >
              {agent.isFeatured && (
                <div className="absolute top-2 right-2">
                  <Badge variant="default" className="bg-primary text-primary-foreground">
                    <Star className="h-3 w-3 mr-1 fill-current" />
                    Featured
                  </Badge>
                </div>
              )}

              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      {React.createElement(getCategoryIcon(agent.category), { className: "h-5 w-5 text-primary" })}
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg">{agent.name}</CardTitle>
                      <CardDescription>{agent.description}</CardDescription>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>v{agent.version}</span>
                  <span>•</span>
                  <span>{agent.installs} installs</span>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Tags */}
                <div className="flex flex-wrap gap-2">
                  {agent.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>

                {/* Rating and Health */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm font-medium">{agent.rating}</span>
                    </div>
                    <Badge className={`text-xs ${getSecurityColor(agent.security.isolationLevel)}`}>
                      <Shield className="h-3 w-3 mr-1" />
                      {agent.security.isolationLevel}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {agent.stats.uptime}% uptime
                  </div>
                </div>

                {/* Pricing */}
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    {agent.pricing.model === 'free' ? (
                      <span className="text-green-600 font-medium">Free</span>
                    ) : agent.pricing.model === 'subscription' ? (
                      <span className="text-blue-600 font-medium">
                        ${agent.pricing.price}/{agent.pricing.interval}
                      </span>
                    ) : (
                      <span className="text-purple-600 font-medium">
                        ${agent.pricing.price} per call
                      </span>
                    )}
                  </div>
                  {installedAgents.includes(agent.id) && (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Installed
                    </Badge>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setSelectedAgent(agent)}
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Details
                      </Button>
                    </DialogTrigger>
                    <AgentDetailsDialog agent={selectedAgent} onClose={() => setSelectedAgent(null)} />
                  </Dialog>

                  {installedAgents.includes(agent.id) ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => uninstallAgent(agent.id)}
                      className="flex-1"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Uninstall
                    </Button>
                  ) : (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => installAgent(agent)}
                      className="flex-1"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Install
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {filteredAgents.length === 0 && !loading && (
        <div className="text-center py-12">
          <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No agents found</h3>
          <p className="text-muted-foreground">
            Try adjusting your search or category filters.
          </p>
        </div>
      )}
    </div>
  );
}

function AgentDetailsDialog({ agent, onClose }: { agent: AgentManifest | null; onClose: () => void }) {
  if (!agent) return null;

  const CategoryIcon = AGENT_CATEGORIES.find((c) => c.value === agent.category)?.icon || Bot;

  return (
    <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-3">
          <CategoryIcon className="h-6 w-6 text-primary" />
          {agent.name}
          {agent.isVerified && <Shield className="h-4 w-4 text-green-600" />}
        </DialogTitle>
      </DialogHeader>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="capabilities">Capabilities</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Description</h4>
            <p className="text-muted-foreground">{agent.description}</p>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Tags</h4>
            <div className="flex flex-wrap gap-2">
              {agent.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Version</h4>
            <p className="text-sm">v{agent.version} • Last updated: {new Date(agent.lastUpdated).toLocaleDateString()}</p>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Author</h4>
            <p className="text-sm">{agent.author.name}</p>
            {agent.author.organization && (
              <p className="text-xs text-muted-foreground">{agent.author.organization}</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="capabilities" className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Capabilities</h4>
            <div className="flex flex-wrap gap-2">
              {agent.capabilities.map((capability) => (
                <Badge key={capability} variant="outline">
                  {capability}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Inputs</h4>
            {agent.inputs.map((input) => (
              <div key={input.name} className="p-3 border rounded-lg mb-2">
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono">{input.name}</code>
                  <Badge variant="secondary" className="text-xs">
                    {input.type}
                  </Badge>
                  {input.required && (
                    <Badge variant="destructive" className="text-xs">
                      Required
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">{input.description}</p>
                {input.default && (
                  <p className="text-xs text-muted-foreground">Default: {JSON.stringify(input.default)}</p>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2">Sandbox</h4>
              <p className="text-sm">{agent.security.sandbox ? '✅' : '❌'}</p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Isolation Level</h4>
              <Badge className={getSecurityColor(agent.security.isolationLevel)}>
                {agent.security.isolationLevel}
              </Badge>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Data Handling</h4>
              <p className="text-sm">{agent.security.dataHandling}</p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Audit Logging</h4>
              <p className="text-sm">{agent.security.auditLogging ? '✅' : '❌'}</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{agent.stats.usageCount}</div>
              <div className="text-xs text-muted-foreground">Total Usage</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{agent.stats.successRate}%</div>
              <div className="text-xs text-muted-foreground">Success Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{agent.stats.avgExecutionTime}s</div>
              <div className="text-xs text-muted-foreground">Avg Time</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{agent.stats.uptime}%</div>
              <div className="text-xs text-muted-foreground">Uptime</div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end mt-6">
        <Button onClick={onClose}>Close</Button>
      </div>
    </DialogContent>
  );
}

// Helper function
function getSecurityColor(level: string): string {
  switch (level) {
    case 'high': return 'bg-green-100 text-green-800 border-green-300';
    case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'low': return 'bg-gray-100 text-gray-800 border-gray-300';
    default: return 'bg-gray-100 text-gray-800 border-gray-300';
  }
}

export default AgentRegistry;