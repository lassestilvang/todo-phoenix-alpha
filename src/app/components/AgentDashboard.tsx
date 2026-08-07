/**
 * Agent Dashboard - Real-time overview of all registered agents and their state
 *
 * Features:
 * - Agent registration & status updates
 * - Current task assignments per agent
 * - Load indicators (energy, focus levels)
 * - Real-time heartbeat monitoring
 * - Quick actions: send tasks, change phase
 */

import { useEffect, useState } from 'react';
import { useAgentRegistry } from '@/lib/agent-registry';
import { useAgentOS } from '@/lib/agent-os';
import { useEnvironmentAgent } from '@/lib/environment-agent';
import { BackchannelMessage } from '@/lib/backchannel-agent';

export interface AgentStatus {
  id: string;
  name: string;
  capabilities: string[];
  workField: string;
  currentPhase: string;
  focusLevel: number;
  energyLevel: number;
  currentTaskId?: string;
  status: 'online' | 'offline' | 'away' | 'busy';
  totalTasksCompleted: number;
  availableSince: number;
  lastHeartbeat: number;
}

export interface TaskAssignment {
  id: string;
  description: string;
  priority: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export interface AgentDashboardProps {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export const AgentDashboard: React.FC<AgentDashboardProps> = ({
  autoRefresh = true,
  refreshInterval = 5000,
}) => {
  const { agents, contexts, registerAgent, updateContext, unregisterAgent } = useAgentRegistry();
  const agentOS = useAgentOS();
  const environment = useEnvironmentAgent();

  const [agentStatuses, setAgentStatuses] = useState<AgentStatus[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Fetch agent data on mount and periodically
  useEffect(() => {
    fetch('/api/agents?action=overview')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          // Combine registry and agentOS data
          const combined = Array.from(agents.values()).map((agent) => {
            const context = contexts.get(agent.id);
            const osAgent = agentOS.getAgent(agent.id);

            return {
              id: agent.id,
              name: agent.name,
              capabilities: agent.capabilities,
              workField: agent.workField,
              currentPhase: context?.currentPhase || 'idle',
              focusLevel: context?.focusLevel || 100,
              energyLevel: context?.energyLevel || 100,
              currentTaskId: context?.currentTaskId,
              status: getAgentStatus(context?.lastHeartbeat || Date.now()),
              totalTasksCompleted: agent.totalTasksCompleted || 0,
              availableSince: agent.availableSince || Date.now(),
              lastHeartbeat: context?.lastHeartbeat || Date.now(),
            };
          });

          setAgentStatuses(combined);
        }
      })
      .catch((err) => {
        console.error('Failed to load agent overview:', err);
      });
  }, [agents, contexts, agentOS]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    // Setup WebSocket connection for real-time agent status updates
    const ws = new WebSocket(`${process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000'}/agents/status`);

    ws.onopen = () => {
      setIsConnected(true);
      // Subscribe to agent status updates
      ws.send(JSON.stringify({ type: 'SUBSCRIBE', channel: 'agent-status' }));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data) as BackchannelMessage;

      if (message.type === 'STATUS_UPDATE') {
        // Update agent status based on real-time update
        setAgentStatuses((prev) => prev.map((agent) => {
          if (agent.id === message.payload.agentId) {
            return {
              ...agent,
              currentPhase: message.payload.currentPhase,
              focusLevel: message.payload.focusLevel,
              energyLevel: message.payload.energyLevel,
              status: getAgentStatus(Date.now()),
            };
          }
          return agent;
        }));
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      setIsConnected(false);
      // Attempt to reconnect after a delay
      setTimeout(() => {
        // Reconnect logic
      }, 5000);
    };

    return () => {
      ws.close();
    };
  }, []);

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetch('/api/agents?action=overview')
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            // Update existing agents with new data
            const updatedAgents = Array.from(agents.values()).map((agent) => {
              const updated = data.agent_summary.find((a: any) => a.id === agent.id);
              if (updated) {
                return {
                  ...updated,
                  lastHeartbeat: Date.now(),
                };
              }
              return updated;
            });

            setAgentStatuses(updatedAgents);
          }
        })
        .catch((err) => {
          console.error('Failed to refresh agent data:', err);
        });
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, agents]);

  // Helper function to determine agent status based on heartbeat
  function getAgentStatus(lastHeartbeat: number): 'online' | 'offline' | 'away' | 'busy' {
    const now = Date.now();
    const timeSinceHeartbeat = now - lastHeartbeat;

    if (timeSinceHeartbeat < 30000) { // < 30 seconds
      return 'online';
    } else if (timeSinceHeartbeat < 180000) { // < 3 minutes
      return 'away';
    } else {
      return 'offline';
    }
  }

  // Send task assignment to an agent
  const assignTask = async (agentId: string, taskId: string) => {
    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign_task',
          agentId,
          taskId,
        }),
      });

      if (response.ok) {
        // Update local state
        setAgentStatuses((prev) => prev.map((agent) => {
          if (agent.id === agentId) {
            return { ...agent, currentTaskId: taskId };
          }
          return agent;
        }));
      }
    } catch (error) {
      console.error('Failed to assign task:', error);
    }
  };

  // Change agent's current phase
  const changePhase = async (agentId: string, phase: string) => {
    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_phase',
          agentId,
          phase,
        }),
      });

      if (response.ok) {
        // Update local state
        setAgentStatuses((prev) => prev.map((agent) => {
          if (agent.id === agentId) {
            return { ...agent, currentPhase: phase };
          }
          return agent;
        }));
      }
    } catch (error) {
      console.error('Failed to change phase:', error);
    }
  };

  return (
    <div className="agent-dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <h1>Agent Dashboard</h1>
        <div className="status-indicator">
          <span className={`connection-dot ${isConnected ? 'connected' : 'disconnected'}`} />
          <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </header>

      {/* Environment Context */}
      <section className="environment-context">
        <h2>Environment</h2>
        <div className="context-info">
          <span>
            Current Phase: <strong>{environment.getCurrentContext().context}</strong>
          </span>
          <span>
            Confidence: <strong>{environment.getCurrentContext().confidence}</strong>
          </span>
        </div>
      </section>

      {/* Agent Grid */}
      <section className="agents-grid">
        {agentStatuses.map((agent) => (
          <div
            key={agent.id}
            className={`agent-card ${agent.status}`}
            onClick={() => setSelectedAgent(agent.id)}
          >
            <div className="agent-header">
              <h3>{agent.name}</h3>
              <span className={`status-badge ${agent.status}`}>{agent.status}</span>
            </div>

            <div className="agent-body">
              <div className="agent-info">
                <p>
                  <strong>Work Field:</strong> {agent.workField}
                </p>
                <p>
                  <strong>Phase:</strong> {agent.currentPhase}
                </p>
                <p>
                  <strong>Current Task:</strong> {agent.currentTaskId || 'None'}
                </p>
              </div>

              <div className="agent-metrics">
                <div className="metric">
                  <div className="metric-label">Focus</div>
                  <div className="metric-bar">
                    <div
                      className="metric-fill focus"
                      style={{ width: `${agent.focusLevel}%` }}
                    />
                  </div>
                  <div className="metric-value">{agent.focusLevel}%</div>
                </div>

                <div className="metric">
                  <div className="metric-label">Energy</div>
                  <div className="metric-bar">
                    <div
                      className="metric-fill energy"
                      style={{ width: `${agent.energyLevel}%` }}
                    />
                  </div>
                  <div className="metric-value">{agent.energyLevel}%</div>
                </div>

                <div className="metric">
                  <div className="metric-label">Tasks Completed</div>
                  <div className="metric-value">{agent.totalTasksCompleted}</div>
                </div>
              </div>
            </div>

            <div className="agent-actions">
              <button
                className="action-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  assignTask(agent.id, `task-${Date.now()}`);
                }}
              >
                Assign Task
              </button>
              <button
                className="action-btn secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  changePhase(agent.id, 'deep_work');
                }}
              >
                Set to Deep Work
              </button>
            </div>
          </div>
        ))}
      </section>

      {/* Selected Agent Details */}
      {selectedAgent && (
        <section className="agent-details">
          <button
            className="close-btn"
            onClick={() => setSelectedAgent(null)}
          >
            ✕
          </button>
          <h2>Agent Details: {agentStatuses.find(a => a.id === selectedAgent)?.name}</h2>
          <pre className="agent-json">
            {JSON.stringify(agentStatuses.find(a => a.id === selectedAgent), null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
};