'use client';

import { useEffect, useRef, useState } from 'react';
import { useOnboarding } from '@/lib/onboarding/useOnboarding';

// Force-directed graph layout types
type GraphNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  fixed?: boolean;
};

type GraphEdge = {
  source: string;
  target: string;
  type: 'dependency' | 'related' | 'similar';
};

export function TaskGraph({ tasks, onTaskSelect }: { tasks: any[]; onTaskSelect?: (taskId: string) => void }) {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const graphRef = useRef<any>(null);

  // Compute initial layout on mount
  useEffect(() => {
    if (tasks.length === 0) return;

    const graphNodes: GraphNode[] = tasks.map((task, index) => ({
      id: `task-${task.id || index}`,
      label: task.name || `Task ${index + 1}`,
      x: Math.random() * 800 - 400,
      y: Math.random() * 600 - 300,
      fixed: false,
    }));

    // Build edges based on dependencies
    const graphEdges: GraphEdge[] = [];
    const taskMap = new Map(tasks.map(t => [t.id || 0, t]));

    tasks.forEach((task) => {
      if (task.dependencies && typeof task.dependencies === 'object') {
        const deps = Array.isArray(task.dependencies) ? task.dependencies :
                     typeof task.dependencies === 'string' ? JSON.parse(task.dependencies) : [];

        deps.forEach((depId: number) => {
          const depTask = taskMap.get(depId);
          if (depTask) {
            graphEdges.push({
              source: `task-${depId}`,
              target: `task-${task.id || 0}`,
              type: 'dependency',
            });
          }
        });
      }
    });

    setNodes(graphNodes);
    setEdges(graphEdges);
  }, [tasks]);

  // Run force-directed layout simulation
  useEffect(() => {
    if (nodes.length === 0 || edges.length === 0) return;

    setIsAnimating(true);

    const width = graphRef.current?.clientWidth || 800;
    const height = graphRef.current?.clientHeight || 600;

    // Simulation parameters
    const simulation = (nodes: GraphNode[], edges: GraphEdge[]) => {
      const numNodes = nodes.length;
      const iterationCount = 100;

      // Initialize forces
      for (let k = 0; k < iterationCount; k++) {
        // Calculate repulsive forces (Barnes-Hut approximation simplified)
        const velocities: { x: number; y: number }[] = Array(numNodes)
          .fill({ x: 0, y: 0 });

        // Repulsion between all node pairs
        for (let i = 0; i < numNodes; i++) {
          for (let j = i + 1; j < numNodes; j++) {
            const dx = nodes[i].x - nodes[j].x;
            const dy = nodes[i].y - nodes[j].y;
            const distance = Math.sqrt(dx * dx + dy * dy) || 0.01;
            // Repulsive force F = k^2 / distance
            const k = Math.sqrt(width * height / numNodes);
            const force = (k * k) / distance;

            // Apply force direction
            const fx = (force * dx) / distance;
            const fy = (force * dy) / distance;

            velocities[i].x -= fx;
            velocities[i].y -= fy;
            velocities[j].x += fx;
            velocities[j].y += fy;
          }
        }

        // Calculate attractive forces (edges)
        for (const edge of edges) {
          const sourceIdx = nodes.findIndex(n => n.id === edge.source);
          const targetIdx = nodes.findIndex(n => n.id === edge.target);

          if (sourceIdx >= 0 && targetIdx >= 0) {
            const dx = nodes[targetIdx].x - nodes[sourceIdx].x;
            const dy = nodes[targetIdx].y - nodes[sourceIdx].y;
            const distance = Math.sqrt(dx * dx + dy * dy) || 0.01;

            // Attractive force F = distance^2 / k
            const k = Math.sqrt(width * height / numNodes);
            const force = (distance * distance) / k;

            // Apply force in direction of edge
            const fx = (force * dx) / distance;
            const fy = (force * dy) / distance;

            velocities[sourceIdx].x += fx;
            velocities[sourceIdx].y += fy;
            velocities[targetIdx].x -= fx;
            velocities[targetIdx].y -= fy;
          }
        }

        // Apply velocities with damping
        const damping = 0.1;
        for (let i = 0; i < numNodes; i++) {
          if (!nodes[i].fixed) {
            nodes[i].x += velocities[i].x * damping;
            nodes[i].y += velocities[i].y * damping;

            // Keep nodes in bounds
            nodes[i].x = Math.max(-width / 2, Math.min(width / 2, nodes[i].x));
            nodes[i].y = Math.max(-height / 2, Math.min(height / 2, nodes[i].y));
          }
        }
      }

      return nodes;
    };

    const simulatedNodes = simulation(nodes, edges);

    setNodes(simulatedNodes);
    setIsAnimating(false);
  }, [nodes, edges]);

  // Handle node click
  const handleNodeClick = (nodeId: string) => {
    const task = tasks.find(t => `task-${t.id || 0}` === nodeId);
    if (task && onTaskSelect) {
      onTaskSelect(task.id!.toString());
    }
    setSelectedNode(nodeId);
  };

  // Toggle node fix on double click (for manual repositioning)
  useEffect(() => {
    let clickTimeout: NodeJS.Timeout;

    graphRef.current?.addEventListener('click', (e: MouseEvent) => {
      clearTimeout(clickTimeout);
      clickTimeout = setTimeout(() => {
        // Single click - select
        const clickedNode = nodes.find(n =>
          Math.hypot(n.x - e.clientX, n.y - e.clientY) < 50
        );

        if (clickedNode) {
          handleNodeClick(clickedNode.id);
        }
      }, 300);
    });

    return () => {
      clearTimeout(clickTimeout);
      graphRef.current?.removeEventListener('click', (e: MouseEvent) => {});
    };
  }, [nodes]);

  return (
    <div className="task-graph relative w-full h-[600] md:h-[700] bg-card rounded-lg border border-border p-6">
      <div className="absolute inset-0" ref={graphRef} />

      {/* Legend */}
      <div className="absolute top-4 left-4 flex gap-2 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-500 rounded" />
          <span>Dependency</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-500 rounded" />
          <span>Related</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-500 rounded" />
          <span>Similar</span>
        </div>
      </div>

      {/* Graph SVG */}
      <svg
        className="absolute inset-0"
        aria-label="Task dependency graph"
      >
        {/* Draw edges */}
        {edges.map((edge, index) => {
          const source = nodes.find(n => n.id === edge.source);
          const target = nodes.find(n => n.id === edge.target);

          if (!source || !target) return null;

          const sourceColor = edge.type === 'dependency' ? '#ef4444' :
                            edge.type === 'related' ? '#10b981' :
                            '#3b82f6';

          return (
            <line
              key={index}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke={sourceColor}
              stroke-width={2}
              stroke-opacity={0.6}
            />
          );
        })}

        {/* Draw nodes */}
        {nodes.map((node, index) => {
          const task = tasks.find(t => `task-${t.id || 0}` === node.id);
          const isSelected = node.id === selectedNode;
          const taskStatus = task?.is_completed ? 'completed' : task?.status || 'pending';

          return (
            <g key={index} onClick={() => handleNodeClick(node.id)}>
              {/* Node circle */}
              <circle
                cx={node.x}
                cy={node.y}
                r={isSelected ? 16 : 12}
                fill={isSelected ? '#3b82f6' : taskStatus === 'completed' ? '#10b981' : '#6366f1'}
                stroke={ '#ffffff' }
                stroke-width={2}
              />

              {/* Node label */}
              <text
                x={node.x}
                y={node.y + 5}
                text-anchor="middle"
                font-size={11}
                font-weight={500}
                fill={ '#ffffff' }
                pointer-events="none"
              >
                {node.label.substring(0, 15)}${node.label.length > 15 ? '...' : ''}
              </text>

              {/* Selection ring (when selected) */}
              {isSelected && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={20}
                  fill="none"
                  stroke="#3b82f6"
                  stroke-width={3}
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Controls */}
      <div className="absolute bottom-4 right-4 flex gap-2">
        <button
          onClick={() => {
            // Re-randomize layout
            setNodes(prev => prev.map(n => ({
              ...n,
              x: Math.random() * 800 - 400,
              y: Math.random() * 600 - 300,
            })));
          }}
          className="px-3 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          title="Randomize layout"
        >
          🔄
        </button>
        <button
          onClick={() => setNodes(prev => prev.map(n => ({ ...n, fixed: !n.fixed })))}
          className="px-3 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          title="Toggle node locking"
        >
          📍
        </button>
      </div>

      {/* Selected task info */}
      {selectedNode && (
        <div className="absolute left-4 bottom-4 bg-card border border-border p-4 max-w-xs w-full text-xs text-foreground">
          <p className="font-medium mb-1">Selected Task</p>
          <p className="truncate">{nodes.find(n => n.id === selectedNode)?.label || 'Unknown'}</p>
        </div>
      )}
    </div>
  );
}