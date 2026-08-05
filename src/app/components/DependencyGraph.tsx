'use client';

import { useEffect, useRef, useState } from 'react';

interface TaskNode {
  id: number;
  name: string;
  list_id: number;
  depends_on?: number[];
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface DependencyEdge {
  source: number;
  target: number;
}

interface DependencyGraphProps {
  tasks: TaskNode[];
  onNodeClick?: (task: TaskNode) => void;
  width?: number;
  height?: number;
}

export default function DependencyGraph({
  tasks,
  onNodeClick,
  width = 800,
  height = 600,
}: DependencyGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<TaskNode[]>([]);
  const [edges, setEdges] = useState<DependencyEdge[]>([]);
  const [isDragging, setIsDragging] = useState<number | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  // Build nodes and edges from tasks
  useEffect(() => {
    const nodeMap = new Map<number, TaskNode>();

    // Initialize nodes with random positions
    tasks.forEach((task) => {
      nodeMap.set(task.id, {
        ...task,
        x: task.x ?? Math.random() * (width - 100) + 50,
        y: task.y ?? Math.random() * (height - 100) + 50,
        vx: 0,
        vy: 0,
      });
    });

    // Build edges from dependencies
    const newEdges: DependencyEdge[] = [];
    tasks.forEach((task) => {
      if (task.depends_on?.length) {
        task.depends_on.forEach((depId) => {
          if (nodeMap.has(depId)) {
            newEdges.push({ source: depId, target: task.id });
          }
        });
      }
    });

    setNodes(Array.from(nodeMap.values()));
    setEdges(newEdges);
  }, [tasks, width, height]);

  // Simple force-directed layout simulation
  useEffect(() => {
    if (nodes.length === 0) return;

    let animationFrame: number;
    const k = 30000; // spring constant
    const repulsion = 5000; // repulsion force

    const tick = () => {
      const newNodes = nodes.map((node) => {
        let fx = 0;
        let fy = 0;

        // Repulsion between all nodes
        nodes.forEach((other) => {
          if (node.id === other.id) return;
          const dx = (node.x ?? 0) - (other.x ?? 0);
          const dy = (node.y ?? 0) - (other.y ?? 0);
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = repulsion / (dist * dist);
          fx += (dx / dist) * force;
          fy += (dy / dist) * force;
        });

        // Spring forces along edges
        edges.forEach((edge) => {
          const source = nodes.find((n) => n.id === edge.source);
          const target = nodes.find((n) => n.id === edge.target);
          if (!source || !target) return;

          const dx = (target.x ?? 0) - (source.x ?? 0);
          const dy = (target.y ?? 0) - (source.y ?? 0);
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = (dist - 150) * (k / dist);

          if (node.id === source.id) {
            fx += (dx / dist) * force;
            fy += (dy / dist) * force;
          } else if (node.id === target.id) {
            fx -= (dx / dist) * force;
            fy -= (dy / dist) * force;
          }
        });

        // Damping
        const damping = 0.9;
        const newVx = (node.vx ?? 0) * damping + fx * 0.01;
        const newVy = (node.vy ?? 0) * damping + fy * 0.01;

        return {
          ...node,
          vx: newVx,
          vy: newVy,
          x: Math.max(30, Math.min(width - 30, (node.x ?? 0) + newVx)),
          y: Math.max(30, Math.min(height - 30, (node.y ?? 0) + newVy)),
        };
      });

      setNodes(newNodes);
      animationFrame = requestAnimationFrame(tick);
    };

    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [nodes, edges, width, height]);

  const handleMouseDown = (e: React.MouseEvent<SVGCircleElement>, nodeId: number) => {
    e.stopPropagation();
    setIsDragging(nodeId);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isDragging === null || !dragStartRef.current) return;

    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;

    setNodes((prev) =>
      prev.map((node) =>
        node.id === isDragging
          ? { ...node, x: (node.x ?? 0) + dx, y: (node.y ?? 0) + dy, vx: 0, vy: 0 }
          : node
      )
    );

    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    setIsDragging(null);
    dragStartRef.current = null;
  };

  const handleNodeClick = (task: TaskNode) => {
    onNodeClick?.(task);
  };

  return (
    <div style={{ width, height, border: '1px solid #e5e7eb', borderRadius: '8px', background: '#fff' }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isDragging ? 'grabbing' : 'default' }}
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#6b7280" />
          </marker>
        </defs>

        {/* Edges */}
        {edges.map((edge, index) => {
          const source = nodes.find((n) => n.id === edge.source);
          const target = nodes.find((n) => n.id === edge.target);
          if (!source || !target) return null;

          const dx = (target.x ?? 0) - (source.x ?? 0);
          const dy = (target.y ?? 0) - (source.y ?? 0);
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;

          // Shorten the line to not overlap with node circles
          const nodeRadius = 28;
          const sx = (source.x ?? 0) + (dx / dist) * nodeRadius;
          const sy = (source.y ?? 0) + (dy / dist) * nodeRadius;
          const tx = (target.x ?? 0) - (dx / dist) * nodeRadius;
          const ty = (target.y ?? 0) - (dy / dist) * nodeRadius;

          return (
            <line
              key={index}
              x1={sx}
              y1={sy}
              x2={tx}
              y2={ty}
              stroke="#6b7280"
              strokeWidth={2}
              markerEnd="url(#arrowhead)"
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => (
          <g
            key={node.id}
            onMouseDown={(e) => handleMouseDown(e, node.id)}
            onClick={() => handleNodeClick(node)}
            style={{ cursor: 'pointer' }}
          >
            <circle
              cx={node.x ?? 0}
              cy={node.y ?? 0}
              r={28}
              fill={node.list_id === 1 ? '#6366f1' : '#ec4899'}
              stroke="#fff"
              strokeWidth={2}
              filter="drop-shadow(0 2px 4px rgba(0,0,0,0.1))"
            />
            <text
              x={node.x ?? 0}
              y={node.y ?? 0 + 4}
              textAnchor="middle"
              fill="#fff"
              fontSize="11"
              fontWeight={600}
              style={{ pointerEvents: 'none' }}
            >
              {node.name.length > 16 ? node.name.slice(0, 16) + '...' : node.name}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}