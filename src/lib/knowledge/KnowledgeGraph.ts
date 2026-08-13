"use strict";

import { Task, TaskWithDetails } from '@/lib/types';
import { TaskParser } from '@/lib/nlp/task-parser';

export interface KnowledgeGraphNode {
  id: string;
  type: 'task' | 'project' | 'label' | 'concept' | 'insight';
  label: string;
  properties: Record<string, any>;
  embedding: number[] | null;
  confidence: number;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeGraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'depends_on' | 'related_to' | 'similar_to' | 'blocks' | 'duplicate_of' | 'part_of' | 'references' | 'has_label';
  weight: number;
  confidence: number;
  properties: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeGraphInsight {
  id: string;
  type: 'pattern' | 'bottleneck' | 'opportunity' | 'anomaly' | 'prediction';
  title: string;
  description: string;
  confidence: number;
  importance: number; // 1-10 scale
  actionable: boolean;
  suggestedAction?: string;
  relatedNodes: string[];
  metadata: Record<string, any>;
  createdAt: string;
}

export class KnowledgeGraph {
  private nodes: Map<string, KnowledgeGraphNode>;
  private edges: Map<string, KnowledgeGraphEdge>;
  private insights: Map<string, KnowledgeGraphInsight>;
  private taskCache: Map<string, TaskWithDetails>;
  private embeddingDimension = 384; // Matches common sentence transformer models

  constructor() {
    this.nodes = new Map();
    this.edges = new Map();
    this.insights = new Map();
    this.taskCache = new Map();

    // Load from storage if available
    this.loadFromStorage();
  }

  // Add a task to the knowledge graph
  async addTask(task: TaskWithDetails): Promise<string> {
    const nodeId = `task-${task.id}`;

    // Check if node already exists
    if (this.nodes.has(nodeId)) {
      this.updateTaskNode(nodeId, task);
      return nodeId;
    }

    // Create node
    const node: KnowledgeGraphNode = {
      id: nodeId,
      type: 'task',
      label: task.name || 'Untitled Task',
      properties: {
        description: task.description,
        priority: task.priority,
        deadline: task.deadline,
        estimate_minutes: task.estimate_minutes,
        actual_minutes: task.actual_minutes,
        is_completed: task.is_completed,
        is_recurring: task.is_recurring,
        list_id: task.list_id,
        created_at: task.created_at,
        updated_at: task.updated_at,
        project_ids: task.projects?.map(p => p.id) || [],
        label_ids: task.labels?.map(l => l.id) || [],
      },
      embedding: await this.generateTaskEmbedding(task),
      confidence: 1.0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.nodes.set(nodeId, node);

    // Create relationships
    await this.createTaskRelationships(task, nodeId);

    // Update insights
    this.updateInsights();

    // Save to storage
    this.saveToStorage();

    return nodeId;
  }

  // Update existing task node
  private async updateTaskNode(nodeId: string, task: TaskWithDetails): Promise<void> {
    const existing = this.nodes.get(nodeId);
    if (!existing) return;

    // Update properties
    const updatedNode: KnowledgeGraphNode = {
      ...existing,
      label: task.name || 'Untitled Task',
      properties: {
        ...existing.properties,
        description: task.description,
        priority: task.priority,
        deadline: task.deadline,
        estimate_minutes: task.estimate_minutes,
        actual_minutes: task.actual_minutes,
        is_completed: task.is_completed,
        is_recurring: task.is_recurring,
        list_id: task.list_id,
        created_at: task.created_at,
        updated_at: task.updated_at,
        project_ids: task.projects?.map(p => p.id) || [],
        label_ids: task.labels?.map(l => l.id) || [],
      },
      embedding: await this.generateTaskEmbedding(task),
      updatedAt: new Date().toISOString(),
    };

    this.nodes.set(nodeId, updatedNode);
    this.saveToStorage();
  }

  // Generate embedding for a task (simplified - in production would use actual ML model)
  private async generateTaskEmbedding(task: TaskWithDetails): Promise<number[]> {
    // Simple hash-based embedding for demo
    // In production: use sentence transformers, OpenAI embeddings, or similar
    const text = [
      task.name || '',
      task.description || '',
      task.priority || '',
      task.deadline || '',
      (task.labels || []).map(l => l.name).join(' '),
      (task.projects || []).map(p => p.name).join(' '),
    ].join(' ');

    // Create deterministic embedding from text hash
    const hash = this.simpleHash(text);
    const embedding = new Array(this.embeddingDimension);

    for (let i = 0; i < this.embeddingDimension; i++) {
      // Use multiple hash functions for better distribution
      const hash1 = this.simpleHash(text + i);
      const hash2 = this.simpleHash(text + i + 1000);
      embedding[i] = ((hash1 % 10000) / 10000) * 2 - 1; // Normalize to [-1, 1]
    }

    return embedding;
  }

  private simpleHash(text: string): number {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  // Calculate cosine similarity between two vectors
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      normA += vec1[i] * vec1[i];
      normB += vec2[i] * vec2[i];
    }

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // Create relationships for a task
  private async createTaskRelationships(task: TaskWithDetails, taskNodeId: string): Promise<void> {
    // 1. Label relationships
    if (task.labels) {
      for (const label of task.labels) {
        const labelNodeId = `label-${label.id}`;
        await this.ensureLabelNode(label);
        await this.createEdge(taskNodeId, labelNodeId, 'has_label', 1.0);
      }
    }

    // 2. Project relationships
    if (task.projects) {
      for (const project of task.projects) {
        const projectNodeId = `project-${project.id}`;
        await this.ensureProjectNode(project);
        await this.createEdge(taskNodeId, projectNodeId, 'part_of', 0.9);
      }
    }

    // 3. Dependency relationships (from task.dependencies)
    if (task.dependencies && typeof task.dependencies === 'object' && task.dependencies !== null) {
      try {
        const deps = Array.isArray(task.dependencies) ? task.dependencies :
                      typeof task.dependencies === 'string' ? JSON.parse(task.dependencies) : [];

        for (const depId of deps) {
          const depTaskId = `task-${depId}`;
          // Check if dependency task exists
          const depNode = this.nodes.get(depTaskId);
          if (depNode) {
            await this.createEdge(depTaskId, taskNodeId, 'depends_on', 1.0);
          }
        }
      } catch (error) {
        // Handle invalid dependencies
        console.warn('Invalid dependencies format:', task.dependencies);
      }
    }

    // 4. Similarity relationships with other tasks
    await this.createSimilarityRelationships(task, taskNodeId);
  }

  // Ensure label node exists
  private async ensureLabelNode(label: any): Promise<string> {
    const labelNodeId = `label-${label.id}`;
    if (!this.nodes.has(labelNodeId)) {
      const node: KnowledgeGraphNode = {
        id: labelNodeId,
        type: 'label',
        label: label.name,
        properties: {
          color: label.color,
          emoji: label.emoji,
          description: label.description,
        },
        embedding: await this.generateLabelEmbedding(label),
        confidence: 1.0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      this.nodes.set(labelNodeId, node);
      this.saveToStorage();
    }
    return labelNodeId;
  }

  // Ensure project node exists
  private async ensureProjectNode(project: any): Promise<string> {
    const projectNodeId = `project-${project.id}`;
    if (!this.nodes.has(projectNodeId)) {
      const node: KnowledgeGraphNode = {
        id: projectNodeId,
        type: 'project',
        label: project.name,
        properties: {
          color: project.color,
          emoji: project.emoji,
          description: project.description,
          parent_id: project.parent_id,
        },
        embedding: await this.generateProjectEmbedding(project),
        confidence: 1.0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      this.nodes.set(projectNodeId, node);
      this.saveToStorage();
    }
    return projectNodeId;
  }

  // Generate embedding for label
  private async generateLabelEmbedding(label: any): Promise<number[]> {
    const text = [label.name || '', label.description || ''].join(' ');
    return this.generateTaskEmbedding({ name: label.name, description: label.description } as any);
  }

  // Generate embedding for project
  private async generateProjectEmbedding(project: any): Promise<number[]> {
    const text = [project.name || '', project.description || ''].join(' ');
    return this.generateTaskEmbedding({ name: project.name, description: project.description } as any);
  }

  // Create similarity relationships using embeddings
  private async createSimilarityRelationships(task: TaskWithDetails, taskNodeId: string): Promise<void> {
    const taskEmbedding = await this.generateTaskEmbedding(task);
    const similarityThreshold = 0.7; // Adjust based on testing

    for (const [otherNodeId, otherNode] of this.nodes.entries()) {
      if (otherNodeId === taskNodeId) continue;
      if (otherNode.type !== 'task') continue;

      // Get the other task to compute similarity
      const otherTaskId = otherNodeId.replace('task-', '');
      const cachedTask = this.taskCache.get(otherTaskId);

      if (cachedTask) {
        const otherEmbedding = await this.generateTaskEmbedding(cachedTask);
        const similarity = this.cosineSimilarity(taskEmbedding, otherEmbedding);

        if (similarity >= similarityThreshold) {
          // Create similarity edge
          await this.createEdge(
            taskNodeId,
            otherNodeId,
            'similar_to',
            similarity,
            { similarityScore: similarity }
          );
        }
      }
    }
  }

  // Create an edge between two nodes
  private async createEdge(
    sourceId: string,
    targetId: string,
    type: KnowledgeGraphEdge['type'],
    weight: number,
    properties: Record<string, any> = {}
  ): Promise<string> {
    // Check if edge already exists
    const existingEdgeId = `${sourceId}-${targetId}-${type}`;
    if (this.edges.has(existingEdgeId)) {
      // Update existing edge
      const existing = this.edges.get(existingEdgeId)!;
      const updatedEdge: KnowledgeGraphEdge = {
        ...existing,
        weight: (existing.weight + weight) / 2, // Average weight
        confidence: Math.min(existing.confidence + 0.1, 1.0), // Increase confidence
        properties: { ...existing.properties, ...properties },
        updatedAt: new Date().toISOString(),
      };

      this.edges.set(existingEdgeId, updatedEdge);
      return existingEdgeId;
    }

    // Create new edge
    const edgeId = `${sourceId}-${targetId}-${Date.now()}`;
    const edge: KnowledgeGraphEdge = {
      id: edgeId,
      source: sourceId,
      target: targetId,
      type,
      weight,
      confidence: 0.8, // Start with moderate confidence
      properties,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.edges.set(edgeId, edge);
    this.saveToStorage();
    return edgeId;
  }

  // Update insights based on current graph state
  private updateInsights(): void {
    // Clear existing insights
    this.insights.clear();

    // Generate new insights
    this.generatePatternInsights();
    this.generateBottleneckInsights();
    this.generateOpportunityInsights();
    this.generatePredictionInsights();

    this.saveToStorage();
  }

  // Generate pattern insights (e.g., common task sequences)
  private generatePatternInsights(): void {
    const tasks: KnowledgeGraphNode[] = Array.from(this.nodes.values())
      .filter(node => node.type === 'task');

    if (tasks.length < 3) return;

    // Group by labels to find common patterns
    const labelGroups: Map<string, KnowledgeGraphNode[]> = new Map();

    for (const task of tasks) {
      const labelIds = task.properties.label_ids || [];
      for (const labelId of labelIds) {
        const labelKey = `label-${labelId}`;
        if (!labelGroups.has(labelKey)) {
          labelGroups.set(labelKey, []);
        }
        labelGroups.get(labelKey)!.push(task);
      }
    }

    // Find patterns in groups with sufficient tasks
    for (const [labelId, groupTasks] of labelGroups.entries()) {
      if (groupTasks.length >= 3) {
        // Check for temporal patterns
        const sortedByDate = [...groupTasks].sort((a, b) =>
          new Date(a.properties.created_at || 0).getTime() -
          new Date(b.properties.created_at || 0).getTime()
        );

        // Check if tasks are created close together in time
        const timeSpans: number[] = [];
        for (let i = 1; i < sortedByDate.length; i++) {
          const prevTime = new Date(sortedByDate[i-1].properties.created_at || 0).getTime();
          const currTime = new Date(sortedByDate[i].properties.created_at || 0).getTime();
          timeSpans.push(currTime - prevTime);
        }

        const avgTimeSpan = timeSpans.reduce((a, b) => a + b, 0) / timeSpans.length;

        // If tasks are created within 1 day of each other on average, it's a pattern
        if (avgTimeSpan < 24 * 60 * 60 * 1000) { // Less than 1 day
          const labelNode = this.nodes.get(labelId);
          const labelName = labelNode?.label || 'Unknown';

          const insight: KnowledgeGraphInsight = {
            id: `pattern-${Date.now()}-${labelId}`,
            type: 'pattern',
            title: `Frequent ${labelName} tasks`,
            description: `You frequently create tasks with the "${labelName}" label (${groupTasks.length} times)`,
            confidence: 0.8,
            importance: Math.min(groupTasks.length / 5 * 10, 8), // Scale 1-10
            actionable: true,
            suggestedAction: `Consider creating a recurring task template for ${labelName} activities`,
            relatedNodes: groupTasks.map(t => t.id),
            metadata: {
              labelId,
              taskCount: groupTasks.length,
              avgTimeSpanHours: avgTimeSpan / (60 * 60 * 1000),
            },
            createdAt: new Date().toISOString(),
          };

          this.insights.set(insight.id, insight);
        }
      }
    }
  }

  // Generate bottleneck insights (tasks that block many others)
  private generateBottleneckInsights(): void {
    // Count incoming dependencies for each task
    const dependencyCounts: Map<string, number> = new Map();

    for (const edge of this.edges.values()) {
      if (edge.type === 'depends_on') {
        const count = dependencyCounts.get(edge.target) || 0;
        dependencyCounts.set(edge.target, count + 1);
      }
    }

    // Find tasks with high dependency counts (bottlenecks)
    for (const [taskId, count] of dependencyCounts.entries()) {
      if (count >= 3) { // Task blocks 3 or more other tasks
        const taskNode = this.nodes.get(taskId);
        if (!taskNode) continue;

        const insight: KnowledgeGraphInsight = {
          id: `bottleneck-${Date.now()}-${taskId}`,
          type: 'bottleneck',
          title: `Task bottleneck detected`,
          description: `The task "${taskNode.label}" is blocking ${count} other tasks`,
          confidence: 0.85,
          importance: Math.min(count / 5 * 10, 9), // Scale up to 9
          actionable: true,
          suggestedAction: `Consider breaking this task into smaller subtasks or delegating parts of it`,
          relatedNodes: [taskId],
          metadata: {
            blockedTaskCount: count,
            blockedTasks: Array.from(this.edges.values())
              .filter(edge => edge.type === 'depends_on' && edge.target === taskId)
              .map(edge => edge.source),
          },
          createdAt: new Date().toISOString(),
        };

        this.insights.set(insight.id, insight);
      }
    }
  }

  // Generate opportunity insights (suggested improvements)
  private generateOpportunityInsights(): void {
    // Find tasks with low completion rates or high estimated vs actual time
    const tasks: KnowledgeGraphNode[] = Array.from(this.nodes.values())
      .filter(node => node.type === 'task');

    for (const task of tasks) {
      const estimated = task.properties.estimate_minutes || 0;
      const actual = task.properties.actual_minutes || 0;

      if (estimated > 0 && actual > 0 && estimated / actual > 2) {
        // Task took much less time than estimated - opportunity for better estimation
        const insight: KnowledgeGraphInsight = {
          id: `opportunity-${Date.now()}-${task.id}`,
          type: 'opportunity',
          title: `Time estimation improvement opportunity`,
          description: `Task "${task.label}" took ${Math.round(actual/estimated * 100)}% of estimated time`,
          confidence: 0.75,
          importance: 6,
          actionable: true,
          suggestedAction: `Review your time estimation habits for similar tasks`,
          relatedNodes: [task.id],
          metadata: {
            estimatedTime: estimated,
            actualTime: actual,
            ratio: estimated / actual,
          },
          createdAt: new Date().toISOString(),
        };

        this.insights.set(insight.id, insight);
      }
    }
  }

  // Generate prediction insights (what's likely to happen next)
  private generatePredictionInsights(): void {
    // Predict overdue tasks based on current trends
    const now = new Date();
    const overdueRisk: KnowledgeGraphNode[] = [];

    for (const task of Array.from(this.nodes.values()).filter(node => node.type === 'task')) {
      const deadlineStr = task.properties.deadline;
      if (!deadlineStr) continue;

      const deadline = new Date(deadlineStr);
      if (deadline <= now) continue; // Skip already overdue

      const timeLeft = deadline.getTime() - now.getTime();
      const estimatedTime = (task.properties.estimate_minutes || 60) * 60 * 1000; // Convert to ms

      // If estimated time to complete is greater than time left, there's risk
      if (estimatedTime > timeLeft) {
        const riskLevel = Math.min(estimatedTime / timeLeft, 3); // Cap at 3x
        if (riskLevel > 1.5) {
          overdueRisk.push(task);
        }
      }
    }

    if (overdueRisk.length > 0) {
      const insight: KnowledgeGraphInsight = {
        id: `prediction-${Date.now()}-overdue`,
        type: 'prediction',
        title: `Potential overdue tasks detected`,
        description: `${overdueRisk.length} task(s) may become overdue based on current progress`,
        confidence: 0.7,
        importance: 8,
        actionable: true,
        suggestedAction: `Consider prioritizing these tasks or requesting deadline extensions`,
        relatedNodes: overdueRisk.map(t => t.id),
        metadata: {
          atRiskCount: overdueRisk.length,
          atRiskTasks: overdueRisk.map(t => t.label),
        },
        createdAt: new Date().toISOString(),
      };

      this.insights.set(insight.id, insight);
    }
  }

  // Get insights for the dashboard
  getInsights(): KnowledgeGraphInsight[] {
    return Array.from(this.insights.values())
      .sort((a, b) => b.importance - a.importance);
  }

  // Get related tasks for a given task
  getRelatedTasks(taskId: string, limit: number = 5): KnowledgeGraphNode[] {
    const taskNodeId = `task-${taskId}`;
    const related: KnowledgeGraphNode[] = [];

    // Find nodes connected by similarity or dependency edges
    for (const edge of this.edges.values()) {
      let connectedId: string | null = null;

      if (edge.source === taskNodeId && (edge.type === 'similar_to' || edge.type === 'related_to' || edge.type === 'depends_on')) {
        connectedId = edge.target;
      } else if (edge.target === taskNodeId && (edge.type === 'similar_to' || edge.type === 'related_to')) {
        connectedId = edge.source;
      }

      if (connectedId) {
        const node = this.nodes.get(connectedId);
        if (node && node.type === 'task') {
          related.push(node);
        }
      }
    }

    // Sort by edge weight (confidence)
    return related
      .sort((a, b) => {
        const weightA = this.getEdgeWeightBetween(taskNodeId, a.id) || 0;
        const weightB = this.getEdgeWeightBetween(taskNodeId, b.id) || 0;
        return weightB - weightA;
      })
      .slice(0, limit);
  }

  private getEdgeWeightBetween(node1Id: string, node2Id: string): number | null {
    for (const edge of this.edges.values()) {
      if ((edge.source === node1Id && edge.target === node2Id) ||
          (edge.source === node2Id && edge.target === node1Id)) {
        return edge.weight;
      }
    }
    return null;
  }

  // Save to localStorage
  private saveToStorage(): void {
    try {
      const data = {
        nodes: Array.from(this.nodes.entries()),
        edges: Array.from(this.edges.entries()),
        insights: Array.from(this.insights.entries()),
        timestamp: Date.now(),
      };

      localStorage.setItem('knowledge-graph-data', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save knowledge graph:', error);
    }
  }

  // Load from localStorage
  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem('knowledge-graph-data');
      if (data) {
        const parsed = JSON.parse(data);

        // Restore nodes
        this.nodes.clear();
        for (const [id, nodeData] of parsed.nodes || []) {
          this.nodes.set(id, nodeData as KnowledgeGraphNode);
        }

        // Restore edges
        this.edges.clear();
        for (const [id, edgeData] of parsed.edges || []) {
          this.edges.set(id, edgeData as KnowledgeGraphEdge);
        }

        // Restore insights
        this.insights.clear();
        for (const [id, insightData] of parsed.insights || []) {
          this.insights.set(id, insightData as KnowledgeGraphInsight);
        }
      }
    } catch (error) {
      console.warn('Failed to load knowledge graph from storage:', error);
      // Initialize empty if corrupted
      this.nodes = new Map();
      this.edges = new Map();
      this.insights = new Map();
    }
  }

  // Clear all data (for testing/reset)
  clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.insights.clear();
    this.taskCache.clear();
    localStorage.removeItem('knowledge-graph-data');
  }

  // Get statistics
  getStats(): {
    nodes: number;
    edges: number;
    insights: number;
    tasks: number;
    labels: number;
    projects: number;
  } {
    const nodesArray = Array.from(this.nodes.values());
    return {
      nodes: this.nodes.size,
      edges: this.edges.size,
      insights: this.insights.size,
      tasks: nodesArray.filter(n => n.type === 'task').length,
      labels: nodesArray.filter(n => n.type === 'label').length,
      projects: nodesArray.filter(n => n.type === 'project').length,
    };
  }

  // Dispose resources
  dispose(): void {
    this.saveToStorage();
  }
}

// Singleton instance
let knowledgeGraphInstance: KnowledgeGraph | null = null;

export function getKnowledgeGraph(): KnowledgeGraph {
  if (!knowledgeGraphInstance) {
    knowledgeGraphInstance = new KnowledgeGraph();
  }
  return knowledgeGraphInstance;
}