'use client';

import { useEffect, useRef, useState } from 'react';
import { getKnowledgeGraph, KnowledgeGraphNode, KnowledgeGraphEdge, KnowledgeGraphInsight } from '@/lib/knowledge/KnowledgeGraph';

interface KnowledgeGraphVisualizerProps {
  tasks: any[];
  labels?: any[];
  projects?: any[];
}
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Brain,
  Lightbulb,
  TrendingUp,
  BarChart3,
  Filter,
  Search,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Maximize2
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface KnowledgeGraphVisualizerProps {
  tasks: any[];
  labels?: any[];
  projects?: any[];
}

export function KnowledgeGraphVisualizer({ tasks, labels, projects }: KnowledgeGraphVisualizerProps) {
  const knowledgeGraph = useRef(getKnowledgeGraph());
  const [nodes, setNodes] = useState<KnowledgeGraphNode[]>([]);
  const [edges, setEdges] = useState<KnowledgeGraphEdge[]>([]);
  const [insights, setInsights] = useState<KnowledgeGraphInsight[]>([]);
  const [filteredNodes, setFilteredNodes] = useState<KnowledgeGraphNode[]>([]);
  const [nodePositions, setNodePositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [filter, setFilter] = useState<'all' | 'task' | 'project' | 'label' | 'insight'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [zoom, setZoom] = useState(1);
  const [selectedNode, setSelectedNode] = useState<KnowledgeGraphNode | null>(null);
  const [showInsights, setShowInsights] = useState(true);

  // Initialize graph with tasks
  useEffect(() => {
    const initGraph = async () => {
      // Add all tasks to the graph
      for (const task of tasks) {
        await knowledgeGraph.current.addTask(task);
      }

      // Get all nodes and edges
      // Note: In a real implementation, KnowledgeGraph would have getter methods
      // For now, we'll simulate based on available data
      const graphNodes = await buildGraphNodes(tasks, labels || [], projects || []);
      const graphEdges = buildGraphEdges(tasks);
      const generatedInsights = generateInsightsFromTasks(tasks);

      setNodes(graphNodes);
      setEdges(graphEdges);
      setInsights(generatedInsights);
      setFilteredNodes(graphNodes);
    };

    initGraph();
  }, [tasks, labels, projects]);

  // Apply filters
  useEffect(() => {
    let filtered = nodes;

    // Filter by type
    if (filter !== 'all') {
      filtered = filtered.filter(n => n.type === filter);
    }

    // Filter by search query
    if (searchQuery) {
      const queryLower = searchQuery.toLowerCase();
      filtered = filtered.filter(n =>
        n.label.toLowerCase().includes(queryLower) ||
        n.properties?.description?.toLowerCase()?.includes(queryLower) ||
        n.id.toLowerCase().includes(queryLower)
      );
    }

    setFilteredNodes(filtered);
  }, [nodes, filter, searchQuery]);

  // Initialize node positions
  useEffect(() => {
    const positions = new Map<string, { x: number; y: number }>();
    filteredNodes.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / filteredNodes.length;
      positions.set(node.id, {
        x: Math.cos(angle) * 300,
        y: Math.sin(angle) * 300,
      });
    });
    setNodePositions(positions);
  }, [filteredNodes]);

  // Build graph nodes from tasks
  const buildGraphNodes = async (
    tasks: any[],
    labels: any[],
    projects: any[]
  ): Promise<KnowledgeGraphNode[]> => {
    const nodes: KnowledgeGraphNode[] = [];

    // Task nodes
    tasks.forEach((task) => {
      nodes.push({
        id: `task-${task.id}`,
        type: 'task',
        label: task.name,
        properties: {
          description: task.description,
          priority: task.priority,
          is_completed: task.is_completed,
          deadline: task.deadline,
          estimate_minutes: task.estimate_minutes,
        },
        embedding: null,
        confidence: 1.0,
        createdAt: task.created_at || new Date().toISOString(),
        updatedAt: task.updated_at || new Date().toISOString(),
      });
    });

    // Label nodes
    labels.forEach((label) => {
      nodes.push({
        id: `label-${label.id}`,
        type: 'label',
        label: label.name,
        properties: {
          color: label.color,
          emoji: label.emoji,
        },
        embedding: null,
        confidence: 1.0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    // Project nodes
    projects.forEach((project) => {
      nodes.push({
        id: `project-${project.id}`,
        type: 'project',
        label: project.name,
        properties: {
          color: project.color,
          emoji: project.emoji,
          description: project.description,
        },
        embedding: null,
        confidence: 1.0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    return nodes;
  };

  // Build graph edges from task relationships
  const buildGraphEdges = (tasks: any[]): KnowledgeGraphEdge[] => {
    const edges: KnowledgeGraphEdge[] = [];

    tasks.forEach((task) => {
      // Dependency edges
      if (task.dependencies) {
        try {
          const deps = typeof task.dependencies === 'string'
            ? JSON.parse(task.dependencies)
            : task.dependencies;

          deps.forEach((depId: number) => {
            edges.push({
              id: `dep-${task.id}-${depId}`,
              source: `task-${depId}`,
              target: `task-${task.id}`,
              type: 'depends_on',
              weight: 1.0,
              confidence: 1.0,
              properties: {},
              createdAt: new Date().toISOString(),
            });
          });
        } catch (error) {
          console.warn('Failed to parse dependencies:', error);
        }
      }

      // Label relationships
      if (task.labels && Array.isArray(task.labels)) {
        task.labels.forEach((label: any) => {
          edges.push({
            id: `label-${task.id}-${label.id}`,
            source: `task-${task.id}`,
            target: `label-${label.id}`,
            type: 'related_to',
            weight: 0.8,
            confidence: 0.9,
            properties: {},
            createdAt: new Date().toISOString(),
          });
        });
      }

      // Project relationships
      if (task.projects && Array.isArray(task.projects)) {
        task.projects.forEach((project: any) => {
          edges.push({
            id: `project-${task.id}-${project.id}`,
            source: `task-${task.id}`,
            target: `project-${project.id}`,
            type: 'part_of',
            weight: 0.9,
            confidence: 1.0,
            properties: {},
            createdAt: new Date().toISOString(),
          });
        });
      }
    });

    return edges;
  };

  // Generate insights from task data
  const generateInsightsFromTasks = (tasks: any[]): KnowledgeGraphInsight[] => {
    const insights: KnowledgeGraphInsightInsight[] = [];
    const now = new Date();

    // Pattern: Frequent task creation
    if (tasks.length >= 5) {
      const recentTasks = tasks.filter(t => {
        const created = new Date(t.created_at || 0);
        return (now.getTime() - created.getTime()) < 7 * 24 * 60 * 60 * 1000;
      });

      if (recentTasks.length >= 10) {
        insights.push({
          id: 'pattern-frequent-tasks',
          type: 'pattern',
          title: 'High Task Creation Rate',
          description: `You created ${recentTasks.length} tasks this week, which is higher than usual.`,
          confidence: 0.85,
          importance: 7,
          actionable: true,
          suggestedAction: 'Consider batching similar tasks together',
          relatedNodes: recentTasks.slice(0, 3).map(t => `task-${t.id}`),
          metadata: { count: recentTasks.length, period: 'week' },
          createdAt: new Date().toISOString(),
        });
      }
    }

    // Pattern: Recurring task detection
    const recurringPattern = detectRecurringTasks(tasks);
    if (recurringPattern.tasks.length >= 3) {
      insights.push({
        id: 'pattern-recurring',
        type: 'pattern',
        title: 'Recurring Task Pattern Detected',
        description: `You have ${recurringPattern.tasks.length} tasks with similar descriptions.`,
        confidence: 0.9,
        importance: 6,
        actionable: true,
        suggestedAction: 'Consider creating a recurring template for these tasks',
        relatedNodes: recurringPattern.tasks.map(t => `task-${t.id}`),
        metadata: { pattern: recurringPattern.pattern },
        createdAt: new Date().toISOString(),
      });
    }

    // Opportunity: Time estimation insight
    const accurateTasks = tasks.filter(t =>
      t.estimate_minutes && t.actual_minutes &&
      Math.abs((t.actual_minutes || 0) - (t.estimate_minutes || 0)) <=
      (t.estimate_minutes || 1) * 0.2
    );

    if (tasks.length > 0) {
      const accuracy = (accurateTasks.length / tasks.length) * 100;
      if (accuracy > 70) {
        insights.push({
          id: 'estimation-accurate',
          type: 'opportunity',
          title: 'Accurate Time Estimation',
          description: `Your time estimates are accurate ${accuracy.toFixed(0)}% of the time.`,
          confidence: 0.8,
          importance: 5,
          actionable: false,
          relatedNodes: [],
          metadata: { accuracy },
          createdAt: new Date().toISOString(),
        });
      }
    }

    // Bottleneck: Overdue tasks
    const overdueTasks = tasks.filter(t =>
      t.deadline && new Date(t.deadline) < now && !t.is_completed
    );

    if (overdueTasks.length > 0) {
      insights.push({
        id: 'bottleneck-overdue',
        type: 'bottleneck',
        title: 'Overdue Tasks Detected',
        description: `${overdueTasks.length} tasks are overdue.`,
        confidence: 0.95,
        importance: 9,
        actionable: true,
        suggestedAction: 'Review overdue tasks and reschedule or mark as complete',
        relatedNodes: overdueTasks.map(t => `task-${t.id}`),
        metadata: { overdueCount: overdueTasks.length },
        createdAt: new Date().toISOString(),
      });
    }

    return insights;
  };

  // Helper function to detect recurring tasks
  const detectRecurringTasks = (tasks: any[]): { tasks: any[]; pattern: string } => {
    const descriptions = tasks.map(t => t.name.toLowerCase().substring(0, 20));
    const counts: Record<string, { count: number; tasks: any[] }> = {};

    descriptions.forEach((desc, index) => {
      if (!counts[desc]) {
        counts[desc] = { count: 0, tasks: [] };
      }
      counts[desc].count++;
      counts[desc].tasks.push(tasks[index]);
    });

    const mostFrequent = Object.entries(counts)
      .filter(([_, data]) => data.count >= 2)
      .sort((a, b) => b[1].count - a[1].count)[0];

    return mostFrequent
      ? { tasks: mostFrequent[1].tasks, pattern: mostFrequent[0] }
      : { tasks: [], pattern: '' };
  };

  // Node type styling
  const getNodeTypeStyle = (type: string) => {
    switch (type) {
      case 'task':
        return { bg: 'bg-blue-500', border: 'border-blue-500', text: 'text-blue-50' };
      case 'project':
        return { bg: 'bg-purple-500', border: 'border-purple-500', text: 'text-purple-50' };
      case 'label':
        return { bg: 'bg-green-500', border: 'border-green-500', text: 'text-green-50' };
      case 'insight':
        return { bg: 'bg-yellow-500', border: 'border-yellow-500', text: 'text-yellow-50' };
      case 'concept':
        return { bg: 'bg-gray-500', border: 'border-gray-500', text: 'text-gray-50' };
      default:
        return { bg: 'bg-gray-300', border: 'border-gray-300', text: 'text-gray-800' };
    }
  };

  // Edge type styling
  const getEdgeTypeStyle = (type: string) => {
    switch (type) {
      case 'depends_on':
        return 'stroke-red-500 stroke-2';
      case 'related_to':
        return 'stroke-blue-400 stroke-1';
      case 'similar_to':
        return 'stroke-green-400 stroke-1';
      case 'blocks':
        return 'stroke-orange-500 stroke-2';
      case 'part_of':
        return 'stroke-purple-400 stroke-1';
      default:
        return 'stroke-gray-400 stroke-1';
    }
  };

  const handleNodeClick = (node: KnowledgeGraphNode) => {
    setSelectedNode(node);
    if (node.type === 'task') {
      // Trigger task selection callback
      const taskId = node.id.replace('task-', '');
      console.log('Selected task:', taskId);
    }
  };

  const getNodeTypeLabel = (type: string): string => {
    switch (type) {
      case 'task': return 'Task';
      case 'project': return 'Project';
      case 'label': return 'Label';
      case 'insight': return 'Insight';
      case 'concept': return 'Concept';
      default: return type;
    }
  };

  return (
    <div className="knowledge-graph-visualizer w-full">
      {/* Controls */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search graph..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="task">Tasks</SelectItem>
              <SelectItem value="project">Projects</SelectItem>
              <SelectItem value="label">Labels</SelectItem>
              <SelectItem value="insight">Insights</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setZoom(Math.min(zoom + 0.1, 2))}
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setZoom(Math.max(zoom - 0.1, 0.5))}
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowInsights(!showInsights)}
            title="Toggle Insights"
          >
            <Brain className={`h-4 w-4 ${showInsights ? 'text-primary' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Graph Visualization */}
      <div className="relative bg-card rounded-xl border border-border p-6 overflow-hidden">
        <svg className="w-full h-[500px] overflow-visible">
          {/* Draw edges */}
          {edges.map((edge) => {
            const source = nodePositions.get(edge.source);
            const target = nodePositions.get(edge.target);

            if (!source || !target) return null;

            return (
              <line
                key={edge.id}
                x1={source.x * zoom + 400}
                y1={source.y * zoom + 250}
                x2={target.x * zoom + 400}
                y2={target.y * zoom + 250}
                className={getEdgeTypeStyle(edge.type)}
                strokeOpacity={edge.weight}
              />
            );
          })}

          {/* Draw nodes */}
          {filteredNodes.map((node) => {
            const pos = nodePositions.get(node.id);
            if (!pos) return null;

            const style = getNodeTypeStyle(node.type);
            const isSelected = selectedNode?.id === node.id;

            return (
              <g
                key={node.id}
                transform={`translate(${pos.x * zoom + 400}, ${pos.y * zoom + 250})`}
              >
                <circle
                  r={isSelected ? 18 : 12}
                  fill={style.bg}
                  stroke={isSelected ? '#ffffff' : style.border}
                  strokeWidth={isSelected ? 3 : 1}
                  onClick={() => handleNodeClick(node)}
                  style={{ cursor: 'pointer' }}
                />
                <text
                  textAnchor="middle"
                  dy={25}
                  className="text-xs fill-muted-foreground"
                  style={{ pointerEvents: 'none' }}
                >
                  {node.label.substring(0, 15)}
                  {node.label.length > 15 ? '...' : ''}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Insights Panel */}
      {showInsights && insights.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-500" />
              AI Insights
            </CardTitle>
            <CardDescription>
              Discover patterns and opportunities in your task data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-[400px] overflow-y-auto">
              {insights.map((insight) => (
                <div
                  key={insight.id}
                  className={`p-4 rounded-lg border ${
                    insight.importance >= 8
                      ? 'border-red-200 bg-red-50/30'
                      : insight.importance >= 6
                      ? 'border-yellow-200 bg-yellow-50/30'
                      : 'border-blue-200 bg-blue-50/30'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className="p-1 bg-primary/10 rounded-full">
                        {insight.type === 'pattern' && (
                          <BarChart3 className="h-4 w-4 text-blue-600" />
                        )}
                        {insight.type === 'bottleneck' && (
                          <AlertCircle className="h-4 w-4 text-red-600" />
                        )}
                        {insight.type === 'opportunity' && (
                          <Lightbulb className="h-4 w-4 text-yellow-600" />
                        )}
                        {insight.type === 'prediction' && (
                          <TrendingUp className="h-4 w-4 text-purple-600" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm">
                          {insight.title}
                        </h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {insight.description}
                        </p>
                        {insight.suggestedAction && (
                          <div className="mt-2 p-2 bg-background/50 rounded border-l-2 border-primary">
                            <p className="text-xs">
                              💡 {insight.suggestedAction}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge
                        variant={
                          insight.importance >= 8
                            ? 'destructive'
                            : insight.importance >= 6
                            ? 'default'
                            : 'secondary'
                        }
                        className="text-xs"
                      >
                        {insight.importance}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Graph Stats */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Knowledge Graph Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{nodes.filter(n => n.type === 'task').length}</div>
              <p className="text-xs text-muted-foreground">Tasks</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-500">{edges.length}</div>
              <p className="text-xs text-muted-foreground">Connections</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">{insights.filter(i => i.type === 'pattern').length}</div>
              <p className="text-xs text-muted-foreground">Patterns</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-500">{insights.filter(i => i.type === 'opportunity').length}</div>
              <p className="text-xs text-muted-foreground">Opportunities</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-500">{insights.filter(i => i.type === 'bottleneck').length}</div>
              <p className="text-xs text-muted-foreground">Bottlenecks</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default KnowledgeGraphVisualizer;