import { NextResponse } from 'next/server';
import { useAgentOS } from '@/lib/agent-os';
import { useAgentRegistry } from '@/lib/agent-registry';
import { useBackchannelAgent } from '@/lib/backchannel-agent';
import { usePriorityAgent } from '@/lib/priority-agent';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  const agentOS = useAgentOS.getState();

  switch (action) {
    case 'register':
      try {
        const body = await request.json();
        const agentId = useAgentOS.registerAgent(body);

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
        const agent = useAgentOS.getAgent(agentId);
        const context = useAgentOS.getContext(agentId);

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
        const available = useAgentOS.getAvailableAgents(capArray);

        return NextResponse.json({
          success: true,
          available_agents: available.length,
          agents: available.map(a => ({
            id: a.id,
            name: a.name,
            capabilities: a.capabilities,
            availability_score: a.availability_score,
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

        const result = useAgentOS.assignTask(task, agentId);

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

        useAgentOS.completeTask(taskId, agentId);

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
        const bc = useBackchannelAgent();
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
      try {
        const agentId = searchParams.get('agentId');
        const ranked = usePriorityAgent.getRankedTasks(agentId);

        return NextResponse.json({
          success: true,
          ranked_tasks: ranked.map(r => ({
            taskId: r.taskId,
            score: r.score,
            eisenhower_quadrant: r.eisenhower_quadrant,
          })),
        });
      } catch (error) {
        return NextResponse.json(
          { success: false, error: 'Failed to get priority scores' },
          { status: 500 }
        );
      }

    case 'environment':
      try {
        const envAgent = useEnvironmentAgent();
        const context = envAgent.getCurrentContext();

        return NextResponse.json({
          success: true,
          current_context: context.context,
          confidence: context.confidence,
          system_state: context.system_state,
        });
      } catch (error) {
        return NextResponse.json(
          { success: false, error: 'Failed to get environment context' },
          { status: 500 }
        );
      }

    default:
      // Get overview
      const agents = Array.from(useAgentOS.agents.values());
      const workloads = Array.from(useAgentOS.workloads.values());

      return NextResponse.json({
        success: true,
        overview: {
          total_agents: agents.length,
          total_tasks_in_queue: useAgentOS.global_queue.queue.size,
          active_locks: useAgentOS.active_locks.size,
          agent_summary: agents.map(a => ({
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
        const agentId = useAgentOS.registerAgent(params as any);
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
        useAgentOS.updateAgentHeartbeat(params.agentId);
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
        const result = useAgentOS.assignTask(task as any, agentId);
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
        useAgentOS.completeTask(taskId, agentId);
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
        const bc = useBackchannelAgent();
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
        const command = useAgentOS.getAgent(params.agentId) || {};
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
        useAgentOS.assignTask(
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
        useAgentOS.registerPhase(phase, agentSet, priority);
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