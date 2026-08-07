import { NextResponse } from 'next/server';
import { useConflictArbiter } from '@/lib/conflict-arbiter';
import { useAgentOS } from '@/lib/agent-os';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  const conflictArbiter = useConflictArbiter();

  switch (action) {
    case 'active':
      const activeConflicts = conflictArbiter.getActiveConflicts();
      return NextResponse.json({
        success: true,
        conflicts: activeConflicts,
        count: activeConflicts.length,
        timestamp: Date.now(),
      });

    case 'history':
      const limit = parseInt(searchParams.get('limit') || '50', 10);
      const history = conflictArbiter.getResolutionHistory(limit);
      return NextResponse.json({
        success: true,
        history,
        count: history.length,
        timestamp: Date.now(),
      });

    case 'statistics':
      const stats = conflictArbiter.getStatistics();
      return NextResponse.json({
        success: true,
        statistics: stats,
        timestamp: Date.now(),
      });

    case 'get':
      const conflictId = searchParams.get('id');
      if (!conflictId) {
        return NextResponse.json(
          { success: false, error: 'Missing conflict ID' },
          { status: 400 }
        );
      }
      const conflict = conflictArbiter.getConflict(conflictId);
      return NextResponse.json({
        success: true,
        conflict: conflict || null,
        timestamp: Date.now(),
      });

    default:
      // Return overview of active conflicts and stats
      const conflicts = conflictArbiter.getActiveConflicts();
      const statistics = conflictArbiter.getStatistics();
      return NextResponse.json({
        success: true,
        activeConflicts: conflicts,
        statistics,
        timestamp: Date.now(),
      });
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const { action, ...params } = body;

  const conflictArbiter = useConflictArbiter();
  const agentOS = useAgentOS.getState();

  switch (action) {
    case 'report':
      // Report a new conflict
      const conflictId = conflictArbiter.reportConflict(params as any);
      return NextResponse.json({
        success: true,
        conflictId,
        message: 'Conflict reported',
      });

    case 'resolve':
      // Resolve an existing conflict
      const { conflictId: resolveId, strategy } = params;
      if (!resolveId) {
        return NextResponse.json(
          { success: false, error: 'Missing conflict ID' },
          { status: 400 }
        );
      }
      const resolved = conflictArbiter.resolveConflict(resolveId, strategy as any);
      return NextResponse.json({
        success: resolved,
        message: resolved ? 'Conflict resolved' : 'Resolution failed',
      });

    case 'escalate':
      // Escalate a conflict to external intervention
      const { conflictId: escalateId } = params;
      if (!escalateId) {
        return NextResponse.json(
          { success: false, error: 'Missing conflict ID' },
          { status: 400 }
        );
      }
      // This would typically trigger a manual review process
      const escalated = conflictArbiter.resolveConflict(escalateId, 'EXTERNAL_INTERVENTION');
      return NextResponse.json({
        success: escalated,
        message: escalated ? 'Conflict escalated' : 'Escalation failed',
      });

    default:
      return NextResponse.json(
        { success: false, error: 'Unknown action' },
        { status: 400 }
      );
  }
}