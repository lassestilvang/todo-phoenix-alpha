import { NextResponse } from 'next/server';
import { useAgentOS } from '@/lib/agent-os';
import { metricsCollector } from '@/lib/metrics';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const metricType = searchParams.get('metric') || 'all';

  switch (metricType) {
    case 'system':
      return NextResponse.json({
        success: true,
        metrics: metricsCollector.getSystemStats(),
        timestamp: Date.now(),
      });

    case 'agents':
      return NextResponse.json({
        success: true,
        agents: metricsCollector.getAgentMetrics(),
        count: metricsCollector.getAgentMetrics().length,
        timestamp: Date.now(),
      });

    case 'tasks': {
      const agentId = searchParams.get('agentId');
      const taskMetrics = metricsCollector.getTaskMetrics(agentId || undefined);
      return NextResponse.json({
        success: true,
        tasks: taskMetrics,
        count: taskMetrics.length,
        timestamp: Date.now(),
      });
    }

    case 'orchestrator': {
      const os = useAgentOS.getState();
      return NextResponse.json({
        success: true,
        overview: {
          agents: Array.from(os.agents.values()).map(a => ({
            id: a.id,
            name: a.name,
            availability: a.availability_score,
            current_task: a.currentTaskId,
          })),
          queue_size: os.global_queue.queue.size,
          active_locks: os.active_locks.size,
        },
        timestamp: Date.now(),
      });
    }

    default:
      // Return everything
      return NextResponse.json({
        success: true,
        system: metricsCollector.getSystemStats(),
        agents: metricsCollector.getAgentMetrics(),
        orchestrator: {
          queue_size: useAgentOS.getState().global_queue.queue.size,
          active_locks: useAgentOS.getState().active_locks.size,
        },
        timestamp: Date.now(),
      });
  }
}