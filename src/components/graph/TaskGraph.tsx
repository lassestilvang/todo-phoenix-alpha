import React, { useEffect, useState } from 'react';
import { Task, TaskWithDetails } from '@/lib/types';
import { taskOperations } from '@/lib/db/tasks';

/**
 * Gantt Chart Component for visualizing task dependencies and timelines
 */
export const TaskGraph: React.FC<{
  tasks?: TaskWithDetails[];
  onTaskSelect?: (taskId: number) => void;
  showDependencies?: boolean;
  showTimeline?: boolean;
}> = ({
  tasks,
  onTaskSelect,
  showDependencies = true,
  showTimeline = true
}) => {
  const [taskData, setTaskData] = useState<Map<number, TaskWithDetails>>(new Map());
  const [dependencyGraph, setDependencyGraph] = useState<Map<number, number[]>>(new Map());
  const [visibleTasks, setVisibleTasks] = useState<Set<number>>(new Set());

  // Load tasks if not provided
  useEffect(() => {
    if (!tasks) {
      const allTasks = taskOperations.getAll(false) as TaskWithDetails[];
      setTaskData(allTasks.reduce((map, task) => {
        map.set(task.id, task);
        return map;
      }, new Map<number, TaskWithDetails>()));

      // Build dependency graph
      const graph = new Map<number, number[]>();
      allTasks.forEach(task => {
        const deps = task.dependencies
          ? JSON.parse(task.dependencies) as number[]
          : [];
        graph.set(task.id, deps.filter(d => allTasks.has(d)));
      });
      setDependencyGraph(graph);

      // Calculate visible tasks (including dependencies)
      const allTaskIds = new Set(allTasks.map(t => t.id));
      const visited = new Set<number>();

      const visit = (id: number) => {
        if (visited.has(id)) return;
        visited.add(id);
        const deps = dependencyGraph.get(id) || [];
        deps.forEach(dep => visit(dep));
      };

      allTaskIds.forEach(id => visit(id));
      setVisibleTasks(visited);
    }
  }, [tasks]);

  // Calculate layout for Gantt chart
  const calculateLayout = (): {
    startDate: string;
    endDate: string;
    taskHeights: Map<number, number>;
    yPositions: Map<number, number>;
    barWidths: Map<number, number>;
  } => {
    const allTasks = Array.from(taskData.values());

    if (allTasks.length === 0) {
      return { startDate: '', endDate: '', taskHeights: new Map(), yPositions: new Map(), barWidths: new Map() };
    }

    // Find min and max dates
    const allDates = allTasks
      .filter(t => t.date)
      .map(t => new Date(t.date));

    const hasDeadlines = allTasks.some(t => t.deadline);
    const deadlineDates = hasDeadlines
      ? allTasks.filter(t => t.deadline).map(t => new Date(t.deadline!))
      : [];

    let minDate: Date;
    let maxDate: Date;

    if (allDates.length > 0) {
      minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
      maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
    } else {
      const now = new Date();
      minDate = new Date(now.getFullYear(), now.getMonth(), 1);
      maxDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    // Add some padding
    minDate = new Date(minDate.getTime() - 7 * 24 * 60 * 60 * 1000); // 1 week before
    maxDate = new Date(maxDate.getTime() + 7 * 24 * 60 * 60 * 1000); // 1 week after

    // Calculate task heights and Y positions
    const taskHeight = 40;
    const yPositions = new Map<number, number>();
    taskData.forEach((task, id) => {
      yPositions.set(id, (allTasks.indexOf(task) * taskHeight) + 20);
    });

    // Calculate bar widths based on duration
    const barWidths = new Map<number, number>();
    const oneDayMs = 24 * 60 * 60 * 1000;

    taskData.forEach((task, id) => {
      let startMs = 0;
      let endMs = 0;

      if (task.date) {
        startMs = new Date(task.date).getTime();
      }
      if (task.deadline) {
        endMs = new Date(task.deadline).getTime();
      } else if (task.date) {
        // Use date + 3 days as default end
        endMs = new Date(task.date).getTime() + 3 * oneDayMs;
      } else {
        // Default: 1 week from now
        endMs = Date.now() + 7 * oneDayMs;
        startMs = Date.now();
      }

      // Calculate width in pixels (assuming 50px per day)
      const durationDays = Math.max(1, (endMs - startMs) / oneDayMs);
      barWidths.set(id, Math.max(50, durationDays * 50));
    });

    return {
      startDate: minDate.toISOString().split('T')[0],
      endDate: maxDate.toISOString().split('T')[0],
      taskHeights: new Map(Object.entries({ taskHeight: taskHeight }).map(([k, v]) => [k, v])),
      yPositions,
      barWidths
    };
  };

  const layout = calculateLayout();

  // Get all dependencies (transitive closure)
  const getAllDependencies = (taskId: number): number[] => {
    const visited = new Set<number>();
    const stack = [taskId];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const deps = dependencyGraph.get(current) || [];
      deps.forEach(dep => {
        if (!visited.has(dep)) {
          stack.push(dep);
        }
      });
    }

    return Array.from(visited).filter(id => id !== taskId);
  };

  // Get tasks that depend on a given task
  const getDependents = (taskId: number): number[] => {
    const dependents: number[] = [];
    taskData.forEach((task, id) => {
      const deps = dependencyGraph.get(id) || [];
      if (deps.includes(taskId)) {
        dependents.push(id);
      }
    });
    return dependents;
  };

  // Critical path calculation
  const calculateCriticalPath = (): {
    criticalTasks: number[];
    pathLength: number;
  } => {
    const allTasks = Array.from(taskData.values());

    if (allTasks.length === 0) {
      return { criticalTasks: [], pathLength: 0 };
    }

    // Simple critical path: find tasks with no dependents that are on the longest path
    // This is a simplified version - full critical path would need forward/backward pass

    // For now, identify tasks that have no dependents (leaf tasks)
    const leafTasks = allTasks.filter(task => {
      const deps = dependencyGraph.get(task.id) || [];
      return deps.length === 0;
    });

    // Calculate approximate path length by finding the task with the longest date range
    let maxDuration = 0;
    let criticalTaskId = allTasks[0]?.id;

    allTasks.forEach(task => {
      const start = task.date ? new Date(task.date).getTime() : 0;
      const end = task.deadline ? new Date(task.deadline).getTime() : start;
      const duration = end - start;

      if (duration > maxDuration) {
        maxDuration = duration;
        criticalTaskId = task.id;
      }
    });

    return {
      criticalTasks: leafTasks.map(t => t.id),
      pathLength: Math.ceil(maxDuration / (24 * 60 * 60 * 1000)) // in days
    };
  };

  const criticalPath = calculateCriticalPath();

  return (
    <div className="task-graph-container">
      <div className="graph-header">
        <h2>Task Dependency Graph</h2>
        <p>Visualizes task dependencies, timelines, and critical path</p>
      </div>

      {/* Timeline Header */}
      {showTimeline && (
        <div className="timeline-header">
          <div className="timeline-range">
            <span>{layout.startDate}</span>
            <span>{layout.endDate}</span>
          </div>
        </div>
      )}

      {/* Tasks Container */}
      <div className="tasks-container">
        {visibleTasks.size === 0 ? (
          <p>No tasks found</p>
        ) : (
          taskData.forEach((task, id) => {
            const deps = dependencyGraph.get(id) || [];
            const dependents = getDependents(id);
            const yPos = layout.yPositions.get(id) || 0;
            const barWidth = layout.barWidths.get(id) || 100;

            return (
              <div
                key={id}
                className="graph-task-item"
                style={{
                  top: `${yPos}px`,
                  height: '36px',
                  borderRight: deps.length > 0 ? '2px solid #f6ad55' : 'none'
                }}
              >
                <div
                  className="graph-task-bar"
                  style={{
                    left: showTimeline ? '100px' : '0',
                    width: `${barWidth}px`,
                    backgroundColor: dependents.length > 0 ? '#3b82f6' : '#6366f1'
                  }}
                  onClick={() => onTaskSelect?.(id)}
                  title={task.name}
                >
                  <span className="task-name">{task.name.substring(0, 20)}</span>
                  <span className="task-duration">
                    {task.date ? new Date(task.date).toLocaleDateString() : 'No date'}
                  </span>
                </div>
                {showDependencies && deps.length > 0 && (
                  <div className="graph-dependency-lines">
                    {deps.map(depId => (
                      <div
                        key={depId}
                        className="dependency-line"
                        style={{
                          left: `${layout.yPositions.get(depId) || yPos + 18}px`,
                          top: '4px',
                          bottom: '4px'
                        }}
                      />
                    ))}
                  </div>
                )}
                {showDependencies && dependents.length > 0 && (
                  <div className="graph-dependency-lines">
                    {dependents.map(depId => (
                      <div
                        key={depId}
                        className="dependency-line reverse"
                        style={{
                          left: `${layout.yPositions.get(depId) || yPos + 18}px`,
                          top: '4px',
                          bottom: '4px'
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Critical Path Highlight */}
      {criticalPath.criticalTasks.length > 0 && (
        <div className="critical-path-highlight">
          <div>Critical Path Tasks: {criticalPath.criticalTasks.map(id =>
            taskData.get(id)?.name || 'Unknown'
          ).join(', ')}</div>
          <div>Path Length: {criticalPath.pathLength} days</div>
        </div>
      )}

      {/* Legend */}
      <div className="graph-legend">
        <span className="legend-item" style={{ backgroundColor: '#6366f1' }}>&nbsp;Task</span>
        <span className="legend-item" style={{ backgroundColor: '#3b82f6' }}>&nbsp;Task with dependents</span>
        <span className="legend-item" style={{ color: '#f6ad55' }}>&nbsp;Dependency</span>
        <span className="legend-item" style={{ color: '#10b981' }}>&nbsp;Critical Path</span>
      </div>
    </div>
  );
};

/**
 * Use hook to get dependency information for a task
 */
export const useTaskDependencies = (taskId: number) => {
  const [dependencies, setDependencies] = useState<number[]>([]);
  const [dependents, setDependents] = useState<number[]>([]);
  const [criticalPath, setCriticalPath] = useState<number[]>([]);

  useEffect(() => {
    // Fetch task data and calculate dependencies
    const allTasks = taskOperations.getAll(false) as TaskWithDetails[];
    const task = allTasks.find(t => t.id === taskId);

    if (task) {
      // Get direct dependencies
      const deps = task.dependencies
        ? JSON.parse(task.dependencies) as number[]
        : [];

      setDependencies(deps);

      // Get transitive dependencies
      const visited = new Set<number>();
      const stack = [...deps];

      while (stack.length > 0) {
        const current = stack.pop()!;
        if (visited.has(current)) continue;
        visited.add(current);
        const t = allTasks.find(t => t.id === current);
        if (t && t.dependencies) {
          const moreDeps = JSON.parse(t.dependencies) as number[];
          moreDeps.forEach(d => {
            if (!visited.has(d)) {
              stack.push(d);
            }
          });
        }
      }

      setDependencies(Array.from(visited));

      // Get dependents
      const allDependents = allTasks
        .filter(t => t.id !== taskId)
        .filter(t => {
          const tDeps = t.dependencies ? JSON.parse(t.dependencies) as number[] : [];
          return tDeps.includes(taskId);
        })
        .map(t => t.id);

      setDependents(allDependents);

      // Get critical path
      const { criticalTasks, pathLength } = (() => {
        const leafTasks = allTasks.filter(t => {
          const tDeps = t.dependencies ? JSON.parse(t.dependencies) : [];
          return tDeps.length === 0;
        });
        return { criticalTasks: leafTasks.map(t => t.id), pathLength: 0 };
      })();

      setCriticalPath(criticalTasks);
    }
  }, [taskId]);

  return { dependencies, dependents, criticalPath };
};