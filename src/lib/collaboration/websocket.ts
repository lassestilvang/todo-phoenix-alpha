import WebSocket from 'ws';

// WebSocket server instance
let wss: WebSocket.Server | null = null;

/**
 * Initialize WebSocket server for real-time collaboration
 */
export function initCollaborationServer() {
  if (wss) return wss; // Already initialized

  wss = new WebSocket.Server({ port: 8080 });

  wss.on('connection', (ws) => {
    console.log('New client connected to collaboration server');

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        handleClientMessage(ws, data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
        ws.send(JSON.stringify({
          type: 'error',
          payload: { message: 'Invalid message format' }
        }));
      }
    });

    ws.on('close', () => {
      console.log('Client disconnected from collaboration server');
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
function handleClientMessage(ws: WebSocket, data: any) {
  switch (data.type) {
    case 'task-update':
      // Broadcast task update to all other clients
      broadcastToOthers(ws, {
        type: 'task-update',
        payload: data.payload,
        timestamp: new Date().toISOString()
      });
      break;

    case 'presence':
      // Broadcast presence update
      broadcastToOthers(ws, {
        type: 'presence-update',
        payload: data.payload,
        timestamp: new Date().toISOString()
      });
      break;

    case 'cursor':
      // Broadcast cursor position for collaborative editing
      broadcastToOthers(ws, {
        type: 'cursor-update',
        payload: data.payload,
        timestamp: new Date().toISOString()
      });
      break;

    default:
      ws.send(JSON.stringify({
        type: 'error',
        payload: { message: `Unknown message type: ${data.type}` }
      }));
  }
}

/**
 * Broadcast message to all clients except sender
 */
function broadcastToOthers(sender: WebSocket, message: any) {
  const messageStr = JSON.stringify(message);
  wss?.clients.forEach((client) => {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
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
 * Client-side WebSocket hook for React
 */
export function useCollaboration(userId: string, onMessageCallback: (data: any) => void) {
  const [socket, setSocket] = React.useState<WebSocket | null>(null);
  const [connected, setConnected] = React.useState(false);
  const [clientCount, setClientCount] = React.useState(0);

  React.useEffect(() => {
    if (!userId) return;

    const ws = new WebSocket(`ws://localhost:8080`);
    setSocket(ws);

    ws.onopen = () => {
      console.log('Connected to collaboration server');
      setConnected(true);

      // Join as user
      ws.send(JSON.stringify({
        type: 'join',
        payload: { userId, timestamp: new Date().toISOString() }
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
  }, [userId, onMessageCallback]);

  // Send message to server
  const sendMessage = (data: any) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(data));
    }
  };

  return {
    socket,
    connected,
    clientCount,
    sendMessage
  };
}

// Collaboration event types
export const CollaborationEvents = {
  TASK_UPDATE: 'task-update',
  PRESENCE_UPDATE: 'presence-update',
  CURSOR_UPDATE: 'cursor-update',
  JOIN: 'join',
  LEAVE: 'leave',
  PING: 'ping',
  ERROR: 'error'
} as const;