/**
 * Backchannel Agent - Real-time agent communication system
 *
 * Core Responsibilities:
 * - WebSocket management for real-time agent communication
 * - Lightweight micro-communications between agents
 * - Connection pooling and efficient multiplexing
 * - Offline support with sync-on-reconnect
 */

import { EventEmitter } from 'events';
import type { AgentWorkRequest, AgentStatusBroadcast, DistrictsCapabilityDelegates } from './agent-protocols';

export interface BackchannelMessage {
  id: string;
  type:
    | 'STATUS_BROADCAST'
    | 'DISCOVERY_REQUEST'
    | 'DISCOVERY_RESPONSE'
    | 'TASK_ASSIGNMENT'
    | 'TASK_UPDATE'
    | 'CONTEXT_SHARE'
    | 'LOCK_REQUEST'
    | 'LOCK_ACQUIRE'
    | 'LOCK_RELEASE'
    | 'HEARTBEAT'
    | 'PEER_ANNOUNCEMENT'
    | 'PEER_DEPARTURE'
    | 'PHASE_TRANSITION';
  from: string;
  to: string | '*';
  timestamp: number;
  payload: any;
  expiresAt?: number;
  priority: number;
}

export interface PeerConnection {
  agentId: string;
  peerId: string;
  socket?: WebSocket;
  lastSeen: number;
  capabilities: Set<string>;
  context: {
    workField: string;
    currentPhase: string;
    focusLevel: number;
  };
  queue_size: number;
}

export interface BackchannelConfig {
  reconnect_interval_ms: number;
  max_reconnect_attempts: number;
  message_ttl_ms: number;
  max_queue_size: number;
  ping_interval_ms: number;
  enable_offline_support: boolean;
}

const defaultConfig: BackchannelConfig = {
  reconnect_interval_ms: 5000,
  max_reconnect_attempts: 10,
  message_ttl_ms: 300000, // 5 minutes
  max_queue_size: 10000,
  ping_interval_ms: 30000, // 30 seconds
  enable_offline_support: true,
};

export interface BackchannelAgentState {
  peers: Map<string, PeerConnection>;
  is_connected: boolean;
  is_reconnecting: boolean;
  reconnect_attempts: number;
  pending_messages: BackchannelMessage[];
  offline_cache: BackchannelMessage[];
  config: BackchannelConfig;
  listeners: EventEmitter;
  socket?: WebSocket;
}

class BackchannelAgentImpl {
  private state: BackchannelAgentState = {
    peers: new Map(),
    is_connected: false,
    is_reconnecting: false,
    reconnect_attempts: 0,
    pending_messages: [],
    offline_cache: [],
    config: defaultConfig,
    listeners: new EventEmitter(),
  };

  private listeners: Map<string, (message: BackchannelMessage) => void> = new Map();

  /**
   * Connect to the agent backchannel server
   */
  connect(endpoint?: string): void {
    const wsEndpoint = endpoint || (typeof window !== 'undefined' ?
      `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/backchannel` :
      'ws://localhost:3000/api/backchannel'
    );

    this.state.socket = new WebSocket(wsEndpoint);

    this.state.socket.addEventListener('open', () => {
      this.state.is_connected = true;
      this.state.is_reconnecting = false;
      this.state.reconnect_attempts = 0;
      this.flushPendingMessages();
      this.startPingInterval();
    });

    this.state.socket.addEventListener('message', (event) => {
      this.handleMessage(JSON.parse(event.data));
    });

    this.state.socket.addEventListener('close', () => {
      this.state.is_connected = false;
      this.attemptReconnect();
    });

    this.state.socket.addEventListener('error', (error) => {
      this.state.listeners.emit('error', error);
    });
  }

  /**
   * Send a message through the backchannel
   */
  send(message: Omit<BackchannelMessage, 'id' | 'timestamp'>): string {
    const fullMessage: BackchannelMessage = {
      ...message,
      id: this.generateMessageId(),
      timestamp: Date.now(),
      expiresAt: Date.now() + this.state.config.message_ttl_ms,
    };

    if (this.state.is_connected && this.state.socket) {
      this.state.socket.send(JSON.stringify(fullMessage));
      this.emit('message_sent', fullMessage);
      return fullMessage.id;
    } else {
      if (this.state.config.enable_offline_support) {
        this.state.offline_cache.push(fullMessage);
        this.emit('message_cached', fullMessage);
        return fullMessage.id;
      } else {
        this.state.pending_messages.push(fullMessage);
        this.emit('message_queued', fullMessage);
        return fullMessage.id;
      }
    }
  }

  /**
   * Subscribe to message types
   */
  subscribe(messageType: string, callback: (message: BackchannelMessage) => void): () => void {
    this.listeners.set(messageType, callback);
    return () => this.listeners.delete(messageType);
  }

  /**
   * Broadcast a status update to all peers
   */
  broadcastStatus(status: AgentStatusBroadcast): void {
    this.send({
      type: 'STATUS_BROADCAST',
      from: status.sourcing.agent_id,
      to: '*',
      payload: status,
      priority: 3,
    });
  }

  /**
   * Send a discovery request to find agents with specific capabilities
   */
  discoveryRequest(capabilities: string[], requestorId: string): string {
    return this.send({
      type: 'DISCOVERY_REQUEST',
      from: requestorId,
      to: '*',
      payload: { capabilities, timestamp: Date.now() },
      priority: 5,
    });
  }

  /**
   * Assign a task to a specific agent
   */
  assignTask(task: AgentWorkRequest, targetAgentId: string): void {
    this.send({
      type: 'TASK_ASSIGNMENT',
      from: 'agentos',
      to: targetAgentId,
      payload: task,
      priority: 7,
      expiresAt: Date.now() + (task.context.challenge.deadline?.getTime() || Date.now() + 300000),
    });
  }

  /**
   * Share context between agents
   */
  shareContext(fromAgentId: string, toAgentId: string, context: any): void {
    this.send({
      type: 'CONTEXT_SHARE',
      from: fromAgentId,
      to: toAgentId,
      payload: context,
      priority: 4,
    });
  }

  /**
   * Request a distributed lock
   */
  requestLock(taskId: string, requestingAgentId: string): void {
    this.send({
      type: 'LOCK_REQUEST',
      from: requestingAgentId,
      to: '*',
      payload: { taskId, requestingAgentId },
      priority: 8,
    });
  }

  /**
   * Announce peer presence
   */
  announcePeer(agentId: string, capabilities: Set<string>): void {
    this.send({
      type: 'PEER_ANNOUNCEMENT',
      from: agentId,
      to: '*',
      payload: { agentId, capabilities: Array.from(capabilities) },
      priority: 6,
    });
  }

  /**
   * Handle incoming message
   */
  private handleMessage(message: BackchannelMessage): void {
    // Remove expired messages
    if (message.expiresAt && Date.now() > message.expiresAt) {
      return;
    }

    // Update peer last seen
    if (message.from !== 'agentos') {
      const peer = this.state.peers.get(message.from);
      if (peer) {
        peer.lastSeen = Date.now();
      }
    }

    // Emit to listeners
    this.emit('message_received', message);

    // Handle by type
    switch (message.type) {
      case 'STATUS_BROADCAST':
        this.handleStatusBroadcast(message);
        break;
      case 'DISCOVERY_RESPONSE':
        this.handleDiscoveryResponse(message);
        break;
      case 'PEER_ANNOUNCEMENT':
        this.handlePeerAnnouncement(message);
        break;
      case 'PEER_DEPARTURE':
        this.handlePeerDeparture(message);
        break;
      case 'LOCK_ACQUIRE':
        this.handleLockAcquire(message);
        break;
      case 'LOCK_RELEASE':
        this.handleLockRelease(message);
        break;
      case 'PHASE_TRANSITION':
        this.handlePhaseTransition(message);
        break;
    }
  }

  /**
   * Handle status broadcast from peers
   */
  private handleStatusBroadcast(message: BackchannelMessage): void {
    const status = message.payload as AgentStatusBroadcast;
    const peer = this.state.peers.get(status.sourcing.agent_id);
    if (peer) {
      peer.lastSeen = message.timestamp;
      peer.context = {
        workField: status.context.focus_status.adaptation_patterns[0] || 'unknown',
        currentPhase: status.context.focus_status.adaptation_patterns[1] || 'idle',
        focusLevel: status.context.operational_metrics.throughput,
      };
    }
    this.emit('agent_status_update', status);
  }

  /**
   * Handle discovery responses
   */
  private handleDiscoveryResponse(message: BackchannelMessage): void {
    const { agentId, capabilities } = message.payload;
    const peer = this.state.peers.get(agentId);
    if (peer) {
      peer.capabilities = new Set(capabilities);
    }
    this.emit('discovery_response', message.payload);
  }

  /**
   * Handle peer announcement
   */
  private handlePeerAnnouncement(message: BackchannelMessage): void {
    const { agentId, capabilities } = message.payload;
    if (!this.state.peers.has(agentId)) {
      this.state.peers.set(agentId, {
        agentId,
        peerId: message.id,
        lastSeen: message.timestamp,
        capabilities: new Set(capabilities),
        context: {
          workField: 'unknown',
          currentPhase: 'idle',
          focusLevel: 100,
        },
        queue_size: 0,
      });
      this.emit('peer_joined', agentId);
    }
  }

  /**
   * Handle peer departure
   */
  private handlePeerDeparture(message: BackchannelMessage): void {
    const { agentId } = message.payload;
    if (this.state.peers.has(agentId)) {
      this.state.peers.delete(agentId);
      this.emit('peer_left', agentId);
    }
  }

  /**
   * Handle lock acquisition
   */
  private handleLockAcquire(message: BackchannelMessage): void {
    const { taskId, agentId } = message.payload;
    this.emit('lock_acquired', { taskId, agentId });
  }

  /**
   * Handle lock release
   */
  private handleLockRelease(message: BackchannelMessage): void {
    const { taskId } = message.payload;
    this.emit('lock_released', { taskId });
  }

  /**
   * Handle phase transition
   */
  private handlePhaseTransition(message: BackchannelMessage): void {
    const { agentId, phase } = message.payload;
    const peer = this.state.peers.get(agentId);
    if (peer) {
      peer.context.currentPhase = phase;
    }
    this.emit('phase_transition', message.payload);
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect(): void {
    if (this.state.is_reconnecting) return;
    if (this.state.reconnect_attempts >= this.state.config.max_reconnect_attempts) {
      this.emit('max_reconnect_attempts_exceeded');
      return;
    }

    this.state.is_reconnecting = true;
    this.state.reconnect_attempts++;
    this.emit('reconnect_attempt', this.state.reconnect_attempts);

    setTimeout(() => {
      this.connect();
      this.state.is_reconnecting = false;
    }, this.state.config.reconnect_interval_ms * this.state.reconnect_attempts);
  }

  /**
   * Flush pending messages when reconnecting
   */
  private flushPendingMessages(): void {
    // Send cached offline messages
    const offlineMessages = [...this.state.offline_cache];
    this.state.offline_cache = [];

    offlineMessages.forEach(message => {
      if (!message.expiresAt || Date.now() < message.expiresAt) {
        this.send({
          type: message.type,
          from: message.from,
          to: message.to,
          payload: message.payload,
          priority: message.priority,
        });
      }
    });

    // Send queued messages
    const pendingMessages = [...this.state.pending_messages];
    this.state.pending_messages = [];

    pendingMessages.forEach(message => {
      if (this.state.socket && this.state.socket.readyState === WebSocket.OPEN) {
        this.state.socket.send(JSON.stringify(message));
      }
    });
  }

  /**
   * Start ping interval for connection health
   */
  private ping_interval?: NodeJS.Timeout;

  private startPingInterval(): void {
    this.ping_interval = setInterval(() => {
      if (this.state.is_connected) {
        this.send({
          type: 'HEARTBEAT',
          from: 'local',
          to: '*',
          payload: { timestamp: Date.now() },
          priority: 1,
        });
        this.emit('ping');
      }
    }, this.state.config.ping_interval_ms);
  }

  /**
   * Stop ping interval
   */
  private stopPingInterval(): void {
    if (this.ping_interval) {
      clearInterval(this.ping_interval);
      this.ping_interval = undefined;
    }
  }

  /**
   * Emit event
   */
  emit(event: string, data?: any): void {
    this.listeners.emit(event, data);
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    this.state.is_connected = false;
    this.stopPingInterval();
    if (this.state.socket) {
      this.state.socket.close();
    }
    this.state.peers.clear();
    this.state.offline_cache = [];
    this.state.pending_messages = [];
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      is_connected: this.state.is_connected,
      is_reconnecting: this.state.is_reconnecting,
      reconnect_attempts: this.state.reconnect_attempts,
      peers_count: this.state.peers.size,
      pending_messages: this.state.pending_messages.length,
      offline_cache_size: this.state.offline_cache.length,
    };
  }

  /**
   * Get all peers
   */
  getPeers(): PeerConnection[] {
    return Array.from(this.state.peers.values());
  }

  /**
   * Get a specific peer
   */
  getPeer(agentId: string): PeerConnection | undefined {
    return this.state.peers.get(agentId);
  }
}

// Export singleton instance
let backchannelAgent: BackchannelAgentImpl | null = null;

export function getBackchannelAgent(): BackchannelAgentImpl {
  if (!backchannelAgent) {
    backchannelAgent = new BackchannelAgentImpl();
  }
  return backchannelAgent;
}

export function createBackchannelAgent(): BackchannelAgentImpl {
  return new BackchannelAgentImpl();
}

export { BackchannelAgentImpl };
export type { BackchannelMessage, PeerConnection, BackchannelConfig };