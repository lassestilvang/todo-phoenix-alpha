import { NextResponse } from 'next/server';
import { useAgentOS } from '@/lib/agent-os';
import { getBackchannelAgent } from '@/lib/backchannel-agent';

function createAgentDiscoveryCommand(capabilities: string[]): string {
  // Create a simple discovery command string based on capabilities
  return `DISCOVER:${capabilities.join(',')}:${Date.now()}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  // Use type assertion since AgentOSState methods are not fully typed in the type system
  const agentOS = useAgentOS.getState();

  switch (action) {
    case 'register':
      try {
        const body = await request.json();
        const agentId = (useAgentOS as any).registerAgent(body);

        return NextResponse.json({
          success: true,
          agentId,
          status: 'registered',
          timestamp: Date.now(),
        });
      } catch (error) {
        return NextResponse.json(
          { success: false, error: 'Invalid request body' },
          { status: 400 }
        );
      }

    case 'status':
      try {
        const agentId = searchParams.get('agentId');
        const agent = (useAgentOS as any).getAgent(agentId);
        const context = (useAgentOS as any).getContext(agentId);

        return NextResponse.json({
          success: true,
          agent: agent || null,
          context,
        });
      } catch (error) {
        return NextResponse.json(
          { success: false, error: 'Failed to get agent status' },
          { status: 500 }
        );
      }

    case 'available':
      try {
        const capabilities = searchParams.get('capabilities');
        const capArray = capabilities ? capabilities.split(',') : [];
        const available = (useAgentOS as any).getAvailableAgents(capArray);

        return NextResponse.json({
          success: true,
          available_agents: available.length,
          agents: available.map((a: any) => ({
            id: (a as any).id,
            name: (a as any).name,
            capabilities: (a as any).capabilities,
            availability_score: (a as any).availability_score,
          })),
        });
      } catch (error) {
        return NextResponse.json(
          { success: false, error: 'Failed to get available agents' },
          { status: 500 }
        );
      }

    case 'task_assign':
      try {
        const body = await request.json();
        const { task, agentId } = body;

        const result = (useAgentOS as any).assignTask(task, agentId);

        return NextResponse.json({
          success: result.success,
          assigned_agent_id: result.assignedAgentId,
          message: result.success ? 'Task assigned successfully' : 'Could not assign task',
        });
      } catch (error) {
        return NextResponse.json(
          { success: false, error: 'Failed to assign task' },
          { status: 500 }
        );
      }

    case 'task_complete':
      try {
        const body = await request.json();
        const { taskId, agentId } = body;

        (useAgentOS as any).completeTask(taskId, agentId);

        return NextResponse.json({
          success: true,
          message: 'Task completed successfully',
        });
      } catch (error) {
        return NextResponse.json(
          { success: false, error: 'Failed to complete task' },
          { status: 500 }
        );
      }

    case 'backchannel_status':
      try {
        const bc = getBackchannelAgent();
        const status = bc.getStatus();

        return NextResponse.json({
          success: true,
          status,
        });
      } catch (error) {
        return NextResponse.json(
          { success: false, error: 'Failed to get backchannel status' },
          { status: 500 }
        );
      }

    case 'priority_scores':
    case 'environment':
      return NextResponse.json(
        { success: false, error: 'Not yet implemented' },
        { status: 501 }
      );

    default:
      // Get overview
      const agents = Array.from((useAgentOS as any).agents.values());
      const workloads = Array.from((useAgentOS as any).workloads.values());

      return NextResponse.json({
        success: true,
        overview: {
          total_agents: agents.length,
          total_tasks_in_queue: (useAgentOS as any).global_queue.queue.size,
          active_locks: (useAgentOS as any).active_locks.size,
          agent_summary: agents.map((a: any) => ({
            id: a.id,
            name: a.name,
            availability: a.availability_score,
            current_task: a.currentTaskId,
          })),
        },
      });
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const { action, ...params } = body;

  const agentOS = useAgentOS.getState();

  switch (action) {
    case 'register':
      try {
        const agentId = (useAgentOS as any).registerAgent(params as any);
        return NextResponse.json({
          success: true,
          agentId,
          message: 'Agent registered successfully',
        });
      } catch (error) {
        return NextResponse.json(
          { success: false, error: error instanceof Error ? error.message : 'Registration failed' },
          { status: 500 }
        );
      }

    case 'update_heartbeat':
      try {
        (useAgentOS as any).updateAgentHeartbeat(params.agentId);
        return NextResponse.json({
          success: true,
          message: 'Heartbeat updated',
        });
      } catch (error) {
        return NextResponse.json(
          { success: false, error: 'Failed to update heartbeat' },
          { status: 500 }
        );
      }

    case 'assign_task':
      try {
        const { task, agentId } = params;
        const result = (useAgentOS as any).assignTask(task as any, agentId);
        return NextResponse.json({
          success: result.success,
          assigned_agent_id: result.assignedAgentId,
        });
      } catch (error) {
        return NextResponse.json(
          { success: false, error: 'Failed to assign task' },
          { status: 500 }
        );
      }

    case 'complete_task':
      try {
        const { taskId, agentId } = params;
        (useAgentOS as any).completeTask(taskId, agentId);
        return NextResponse.json({
          success: true,
          message: 'Task completed',
        });
      } catch (error) {
        return NextResponse.json(
          { success: false, error: 'Failed to complete task' },
          { status: 500 }
        );
      }

    case 'broadcast_status':
      try {
        const bc = getBackchannelAgent();
        const status = bc.broadcastStatus({
          payload_type: 'AGENT_HEARTBEAT',
          sourcing: {
            agent_id: params.agentId,
            peer_commit_hash: Math.random().toString(36).substring(2, 15),
            version_manifest: '1.0.0-beta.1',
          },
          context: {
            focus_status: {
              current_rolemodel: ['default'],
              success_metrics: [],
              adaptation_patterns: [],
            },
            operational_metrics: {
              response_latency: 0,
              throughput: 0,
              error_rate: 0,
              resource_profile: {
                dataMemory: 0,
                modelWeight: 0,
                networkUsage: 0,
              },
            },
            system_epoch: Date.now(),
          },
        });
        return NextResponse.json({
          success: true,
          broadcast_id: status,
        });
      } catch (error) {
        return NextResponse.json(
          { success: false, error: 'Failed to broadcast status' },
          { status: 500 }
        );
      }

    case 'discovery':
      try {
        const { capabilities, agentName } = params;
        const command = (useAgentOS as any).getAgent(params.agentId) || {};
        const discoveryCmd = createAgentDiscoveryCommand(capabilities || []);
        return NextResponse.json({
          success: true,
          discovery_command: discoveryCmd,
          requesting_agent: agentName,
        });
      } catch (error) {
        return NextResponse.json(
          { success: false, error: 'Failed to create discovery command' },
          { status: 500 }
        );
      }

    case 'start_work':
      try {
        const { taskId, agentId } = params;
        (useAgentOS as any).assignTask(
          { id: taskId, description: 'Auto-assigned task', required_capabilities: [], priority: 5, created_at: Date.now() },
          agentId
        );
        return NextResponse.json({
          success: true,
          message: 'Work started',
        });
      } catch (error) {
        return NextResponse.json(
          { success: false, error: 'Failed to start work' },
          { status: 500 }
        );
      }

    case 'phase_register':
      try {
        const { phase, agentIds, priority } = params;
        const agentSet = new Set(agentIds);
        (useAgentOS as any).registerPhase(phase, agentSet, priority);
        return NextResponse.json({
          success: true,
          message: 'Phase registered',
        });
      } catch (error) {
        return NextResponse.json(
          { success: false, error: 'Failed to register phase' },
          { status: 500 }
        );
      }

    default:
      return NextResponse.json(
        { success: false, error: 'Unknown action' },
        { status: 400 }
      );
  }
}