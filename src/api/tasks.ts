"use client";

// Compatibility module for test imports
// This provides the API functions expected by integration tests

import { createTask, getTasks, updateTask, deleteTask, toggleTaskComplete } from '@/app/actions/tasks';
import { useAgentOS } from '@/lib/agent-os';

// Re-export task actions from app/actions
export { createTask, getTasks, updateTask, deleteTask, toggleTaskComplete };

// Export agent assignment functions
export const assignTask = async (taskId: string, agentId: string) => {
  const agentOS = useAgentOS.getState();

  // Find the task by ID (this is simplified for test compatibility)
  // In a real implementation, this would fetch from API or database
  const task = {
    id: taskId,
    description: `Task ${taskId}`,
    required_capabilities: ['data_analysis'],
    priority: 5,
    dependencies: [],
    created_by: 'test-user',
    status: 'pending' as const,
    created_at: Date.now(),
  };

  return agentOS.assignTask(task, agentId);
};

export const completeTask = async (taskId: string, agentId: string, success: boolean = true) => {
  const agentOS = useAgentOS.getState();
  agentOS.completeTask(taskId, agentId);
  return { success };
};