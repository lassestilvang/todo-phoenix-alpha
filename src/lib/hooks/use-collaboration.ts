import { useState, useEffect, useCallback, useRef } from 'react';
import { useCollaboration as useRawCollaboration } from '@/lib/collaboration/websocket';
import { useAgentRegistry } from '@/lib/agent-registry';
import { useAgentOS } from '@/lib/agent-os';

export interface CollaborationMessage {
  type: string;
  payload: any;
  timestamp?: string;
  senderId?: string;
}

export interface TaskCollaborationData {
  taskId: number;
  userId: string;
  action: 'create' | 'update' | 'delete' | 'comment' | 'assign' | 'complete';
  data: any;
  timestamp: string;
}

export interface UserPresence {
  userId: string;
  status: 'online' | 'away' | 'offline' | 'busy';
  lastSeen: string;
  currentTask?: number;
}

export interface TaskComment {
  id: string;
  taskId: number;
  userId: string;
  content: string;
  timestamp: string;
}

export function useTaskCollaboration(userId: string, taskId?: number) {
  const [collabState, setCollabState] = useState({
    connected: false,
    clientCount: 0,
    presence: new Map<string, UserPresence>(),
    comments: new Map<string, TaskComment[]>(),
    taskUpdates: new Map<number, any>(),
  });

  const agentRegistry = useAgentRegistry();
  const agentOS = useAgentOS();
  const collabRef = useRef<any>(null);
  const presenceIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Handle incoming collaboration messages - defined before use
  const handleIncomingMessage = useCallback((data: CollaborationMessage) => {
    setCollabState(prev => {
      switch (data.type) {
        case 'presence-update':
          const newPresence = new Map(prev.presence);
          newPresence.set(data.payload.userId, {
            userId: data.payload.userId,
            status: data.payload.status,
            lastSeen: data.payload.lastSeen,
            currentTask: data.payload.currentTask
          });
          return { ...prev, presence: newPresence };

        case 'task-update':
          const taskUpdates = new Map(prev.taskUpdates);
          taskUpdates.set(data.payload.taskId, {
            ...data.payload,
            timestamp: data.timestamp || new Date().toISOString()
          });
          // Keep only last 10 updates per task
          const updates = Array.from(taskUpdates.get(data.payload.taskId) || []).slice(-10);
          taskUpdates.set(data.payload.taskId, updates);
          return { ...prev, taskUpdates };

        case 'task-comment':
          const commentsMap = new Map(prev.comments);
          const taskComments = commentsMap.get(data.payload.taskId) || [];
          const newComment: TaskComment = {
            id: data.payload.id || `${Date.now()}-${Math.random()}`,
            taskId: data.payload.taskId,
            userId: data.payload.userId,
            content: data.payload.content,
            timestamp: data.timestamp || new Date().toISOString()
          };
          commentsMap.set(data.payload.taskId, [...taskComments, newComment].slice(-50)); // Keep last 50 comments
          return { ...prev, comments: commentsMap };

        case 'user-joined':
        case 'user-left':
          // Update presence based on join/leave events
          const updatedPresence = new Map(prev.presence);
          if (data.type === 'user-joined') {
            updatedPresence.set(data.payload.userId, {
              userId: data.payload.userId,
              status: 'online',
              lastSeen: data.payload.timestamp,
              currentTask: undefined
            });
          } else if (data.type === 'user-left') {
            updatedPresence.delete(data.payload.userId);
          }
          return { ...prev, presence: updatedPresence };

        default:
          return prev;
      }
    });
  }, [taskId]);

  const {
    socket,
    connected,
    clientCount,
    sendMessage,
    setUserRooms
  } = useRawCollaboration(userId, handleIncomingMessage);

  // Set up rooms for task collaboration
  useEffect(() => {
    if (taskId !== undefined) {
      setUserRooms(new Set([`task-${taskId}`, `global`]));
    } else {
      setUserRooms(new Set([`global`]));
    }
  }, [taskId, setUserRooms]);

  // Send presence updates periodically
  useEffect(() => {
    if (!connected) return;

    presenceIntervalRef.current = setInterval(() => {
      sendMessage({
        type: 'presence',
        payload: {
          status: 'online',
          currentTask: taskId
        }
      });
    }, 30000); // Every 30 seconds

    return () => {
      if (presenceIntervalRef.current) {
        clearInterval(presenceIntervalRef.current);
      }
    };
  }, [connected, sendMessage, taskId]);

  // Task creation/update/deletion handlers
  const handleTaskCreated = useCallback((taskData: any) => {
    sendMessage({
      type: 'task-update',
      payload: {
        taskId: taskData.id,
        action: 'create',
        data: taskData,
        userId
      }
    });
  }, [sendMessage, userId]);

  const handleTaskUpdated = useCallback((taskId: number, updates: any) => {
    sendMessage({
      type: 'task-update',
      payload: {
        taskId,
        action: 'update',
        data: updates,
        userId
      }
    });
  }, [sendMessage, userId]);

  const handleTaskDeleted = useCallback((taskId: number) => {
    sendMessage({
      type: 'task-update',
      payload: {
        taskId,
        action: 'delete',
        data: {},
        userId
      }
    });
  }, [sendMessage, userId]);

  const handleTaskCompleted = useCallback((taskId: number) => {
    sendMessage({
      type: 'task-update',
      payload: {
        taskId,
        action: 'complete',
        data: {},
        userId
      }
    });
  }, [sendMessage, userId]);

  const handleTaskAssigned = useCallback((taskId: number, assigneeId: string) => {
    sendMessage({
      type: 'task-update',
      payload: {
        taskId,
        action: 'assign',
        data: { assigneeId },
        userId
      }
    });
  }, [sendMessage, userId]);

  const handleAddComment = useCallback((taskId: number, content: string) => {
    const commentId = `${Date.now()}-${Math.random()}`;
    sendMessage({
      type: 'task-comment',
      payload: {
        taskId,
        content,
        userId,
        id: commentId
      }
    });
  }, [sendMessage, userId]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (presenceIntervalRef.current) {
        clearInterval(presenceIntervalRef.current);
      }
      // Send leave message when component unmounts
      if (connected) {
        sendMessage({
          type: 'presence',
          payload: {
            status: 'offline',
            currentTask: null
          }
        });
      }
    };
  }, [connected, sendMessage]);

  return {
    // Connection status
    connected,
    clientCount,

    // Collaboration data
    presence: collabState.presence,
    comments: taskId ? (collabState.comments.get(String(taskId)) || []) : [],
    taskUpdates: taskId ? collabState.taskUpdates.get(taskId) : null,

    // Action handlers
    handleTaskCreated,
    handleTaskUpdated,
    handleTaskDeleted,
    handleTaskCompleted,
    handleTaskAssigned,
    handleAddComment,

    // Utility functions
    sendMessage,
    setUserRooms
  };
}

// Hook for general collaboration (not tied to a specific task)
export function useGeneralCollaboration(userId: string) {
  return useTaskCollaboration(userId, undefined);
}