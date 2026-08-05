import WebSocket from 'ws';

// WebSocket server instance
let wss: WebSocket.Server | null = null;

// Track connected users and their rooms
type ConnectedUser = {
  userId: string;
  socket: WebSocket;
  rooms: Set<string>; // Task list IDs they're subscribed to
};

const connectedUsers = new Map<string, ConnectedUser>();

/**
 * Initialize WebSocket server for real-time collaboration
 */
export function initCollaborationServer() {
  if (wss) return wss; // Already initialized

  wss = new WebSocket.Server({ port: 8080 });

  wss.on('connection', (ws) => {
    console.log('New client connected to collaboration server');

    // User joins with their ID on first message
    let userId: string | null = null;

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        handleClientMessage(ws, data, userId);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
        ws.send(JSON.stringify({
          type: 'error',
          payload: { message: 'Invalid message format' }
        }));
      }
    });

    ws.on('close', () => {
      if (userId && connectedUsers.has(userId)) {
        const user = connectedUsers.get(userId)!;
        // Leave all rooms
        user.rooms.forEach(room => {
          broadcastToRoom(room, {
            type: 'user-left',
            payload: { userId },
            timestamp: new Date().toISOString()
          }, user.socket);
        });
        connectedUsers.delete(userId);
        console.log(`User ${userId} disconnected`);
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  console.log('Collaboration server started on port 8080');
  return wss;
}

/**
 * Handle incoming messages from clients
 */
function handleClientMessage(ws: WebSocket, data: any, userId: string | null) {
  // Handle user joining with their ID
  if (data.type === 'join' && data.payload?.userId) {
    userId = data.payload.userId;

    // Register user
    if (!connectedUsers.has(userId)) {
      connectedUsers.set(userId, {
        userId,
        socket: ws,
        rooms: new Set()
      });
    }
    const user = connectedUsers.get(userId)!;
    user.socket = ws; // Update in case socket changed

    // Subscribe to rooms if provided
    if (data.payload?.rooms) {
      data.payload.rooms.forEach((room: string) => {
        user.rooms.add(room);
        // Notify existing users in room
        broadcastToRoom(room, {
          type: 'user-joined',
          payload: { userId, timestamp: new Date().toISOString() },
          senderId: userId
        });
      });
    }

    ws.send(JSON.stringify({
      type: 'join-ack',
      payload: { userId, connected: true }
    }));
    return;
  }

  if (!userId) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: 'User must join with an ID first' }
    }));
    return;
  }

  // Route message types
  switch (data.type) {
    case 'task-update':
      handleTaskUpdate(ws, data.payload, userId);
      break;

    case 'presence':
      handlePresenceUpdate(ws, data.payload, userId);
      break;

    case 'cursor':
      handleCursorUpdate(ws, data.payload, userId);
      break;

    case 'leave':
      handleLeave(ws, userId);
      break;

    case 'ack':
      handleAck(data.payload, userId);
      break;

    default:
      ws.send(JSON.stringify({
        type: 'error',
        payload: { message: `Unknown message type: ${data.type}` }
      }));
  }
}

/**
 * Handle task update with conflict detection
 */
function handleTaskUpdate(ws: WebSocket, payload: any, userId: string) {
  const { taskId, listId, version, changes } = payload;

  if (!taskId || !listId) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: 'Task update requires taskId and listId' }
    }));
    return;
  }

  // Check for version conflict - if version doesn't match, request retry
  // In a real implementation, this would check the current task version from the DB
  const user = connectedUsers.get(userId)!;

  // Broadcast task update to other users in the same list
  broadcastToRoom(listId, {
    type: 'task-update',
    payload: {
      ...changes,
      taskId,
      updatedBy: userId,
      version: version || 0
    },
    timestamp: new Date().toISOString(),
    senderId: userId
  }, ws);
}

/**
 * Handle presence update
 */
function handlePresenceUpdate(ws: WebSocket, payload: any, userId: string) {
  const { status, taskId } = payload;

  broadcastToRoom(taskId, {
    type: 'presence-update',
    payload: {
      userId,
      status, // 'online', 'away', 'offline'
      lastSeen: new Date().toISOString()
    },
    timestamp: new Date().toISOString(),
    senderId: userId
  });
}

/**
 * Handle cursor position update for collaborative editing
 */
function handleCursorUpdate(ws: WebSocket, payload: any, userId: string) {
  const { taskId, position, selection } = payload;

  broadcastToRoom(taskId, {
    type: 'cursor-update',
    payload: {
      userId,
      position, // { line: number, column: number }
      selection, // { start: number, end: number }
      timestamp: new Date().toISOString()
    },
    timestamp: new Date().toISOString(),
    senderId: userId
  });
}

/**
 * Handle user leaving a task list
 */
function handleLeave(ws: WebSocket, userId: string) {
  const user = connectedUsers.get(userId);
  if (!user) return;

  // Notify rooms user was in
  user.rooms.forEach(room => {
    broadcastToRoom(room, {
      type: 'user-left',
      payload: { userId },
      timestamp: new Date().toISOString()
    });
  });

  // Remove from connected users
  connectedUsers.delete(userId);
}

/**
 * Handle acknowledgment for message delivery
 */
function handleAck(payload: any, userId: string) {
  const { messageId } = payload;
  // In a real system, you'd track delivered messages and update UI
  console.log(`Acknowledged message ${messageId} from user ${userId}`);
}

/**
 * Broadcast message to a specific room (task list)
 * @param room - The room/channel name (task list ID)
 * @param message - The message to broadcast
 * @param excludeSocket - Optional socket to exclude (sender)
 */
function broadcastToRoom(room: string, message: any, excludeSocket?: WebSocket) {
  const messageStr = JSON.stringify(message);
  wss?.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client !== excludeSocket) {
      // Check if client is subscribed to this room
      // In a production system, we'd track room subscriptions per client
      // For now, broadcast to all and let clients filter
      client.send(messageStr);
    }
  });
}

/**
 * Broadcast message to all connected clients
 */
export function broadcastToAll(message: any) {
  const messageStr = JSON.stringify(message);
  wss?.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
}

/**
 * Get number of connected clients
 */
export function getConnectedClientCount(): number {
  return wss?.clients.size || 0;
}

/**
 * Send a message to a specific user
 */
export function sendToUser(userId: string, message: any): boolean {
  const user = connectedUsers.get(userId);
  if (user && user.socket && user.socket.readyState === WebSocket.OPEN) {
    user.socket.send(JSON.stringify(message));
    return true;
  }
  return false;
}

/**
 * Client-side WebSocket hook for React
 */
export function useCollaboration(userId: string, onMessageCallback: (data: any) => void) {
  const [socket, setSocket] = React.useState<WebSocket | null>(null);
  const [connected, setConnected] = React.useState(false);
  const [clientCount, setClientCount] = React.useState(0);
  const [userRooms, setUserRooms] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (!userId) return;

    const ws = new WebSocket(`ws://localhost:8080`);
    setSocket(ws);

    ws.onopen = () => {
      console.log('Connected to collaboration server');
      setConnected(true);

      // Join as user with rooms
      ws.send(JSON.stringify({
        type: 'join',
        payload: { userId, rooms: userRooms }
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessageCallback(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      console.log('Disconnected from collaboration server');
      setConnected(false);
      setSocket(null);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnected(false);
    };

    // Periodically check connection
    const interval = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'ping',
          payload: { timestamp: new Date().toISOString() }
        }));
      }
    }, 30000); // Every 30 seconds

    return () => {
      clearInterval(interval);
      if (ws) {
        ws.close();
      }
    };
  }, [userId, onMessageCallback, userRooms]);

  // Send message to server
  const sendMessage = (data: any) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(data));
    }
  };

  // Update rooms when userRooms changes
  React.useEffect(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'rooms-update',
        payload: Array.from(userRooms)
      }));
    }
  }, [userRooms, socket]);

  return {
    socket,
    connected,
    clientCount,
    sendMessage,
    setUserRooms
  };
}

/**
 * Collaboration event types
 */
export const CollaborationEvents = {
  TASK_UPDATE: 'task-update',
  PRESENCE_UPDATE: 'presence-update',
  CURSOR_UPDATE: 'cursor-update',
  JOIN: 'join',
  LEAVE: 'leave',
  ROOMS_UPDATE: 'rooms-update',
  PING: 'ping',
  ACK: 'ack',
  ERROR: 'error'
} as const;