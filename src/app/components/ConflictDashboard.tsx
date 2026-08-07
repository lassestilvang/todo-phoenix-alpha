/**
 * Conflict Dashboard - Visual overview of active agent conflicts
 *
 * Displays:
 * - Active conflicts with severity indicators
 * - Resolution strategies in progress
 * - Timeline of conflict detection → resolution
 * - Per-agent participant details
 */

import { useEffect, useState } from 'react';
import { useConflictArbiter } from '@/lib/conflict-arbiter';
import { ConflictEvent } from '@/lib/conflict-arbiter';

export interface ConflictSummary {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'resolved' | 'escalated';
  detectedAt: number;
  resolvedAt?: number;
  participants: string[];
  resolution?: {
    strategy: string;
    outcome: string;
    winner?: string;
    mergedData?: any;
  };
}

export interface ConflictDashboardProps {
  showResolved?: boolean;
  onResolveClick?: (conflictId: string) => void;
}

export const ConflictDashboard: React.FC<ConflictDashboardProps> = ({
  showResolved = false,
  onResolveClick,
}) => {
  const [conflicts, setConflicts] = useState<ConflictSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/conflicts')
      .then((res) => res.json())
      .then((data) => {
        const active = data.filter((c: any) => c.status === 'active');
        const resolved = data.filter((c: any) => c.status === 'resolved');

        // Only show resolved if explicitly requested
        const toShow = showResolved ? [...active, ...resolved] : active;

        setConflicts(toShow.map((c: any) => ({
          id: c.id,
          type: c.type,
          severity: c.severity,
          status: c.status,
          detectedAt: c.detected_at,
          resolvedAt: c.resolved_at,
          participants: c.participants,
          resolution: c.resolution,
        })));

        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load conflicts:', err);
        setLoading(false);
      });
  }, [showResolved]);

  if (loading) {
    return <div>Loading conflicts…</div>;
  }

  return (
    <section className="conflict-dashboard">
      <h2>Agent Conflicts</h2>

      <p className="subtitle">
        {conflicts.length === 0 ? 'No active conflicts' : (
          `${conflicts.length} conflict${conflicts.length !== 1 ? 's' : ''}`
        )}
      </p>

      <div className="conflict-list">
        {conflicts.map((conflict) => (
          <div
            key={conflict.id}
            className={`conflict-card ${conflict.severity}`}
          >
            <div className="conflict-header">
              <span className="conflict-id">#{conflict.id}</span>
              <span
                className={`severity-badge ${conflict.severity}`}
              >
                {conflict.severity}
              </span>
            </div>

            <div className="conflict-details">
              <p>
                <strong>Type:</strong> {conflict.type.replace('_', ' ')}
              </p>
              <p>
                <strong>Participants:</strong> {conflict.participants.join(', ')}
              </p>
              <p>
                <strong>Detected:</strong>{' '}
                {new Date(conflict.detectedAt).toLocaleTimeString()}
              </p>
              {conflict.resolvedAt && (
                <p>
                  <strong>Resolved:</strong>{' '}
                  {new Date(conflict.resolvedAt).toLocaleTimeString()}
                </p>
              )}
            </div>

            {conflict.resolution && (
              <div className="conflict-resolution">
                <p>
                  <strong>Strategy:</strong> {conflict.resolution.strategy}
                </p>
                <p>
                  <strong>Outcome:</strong> {conflict.resolution.outcome}
                </p>
                {conflict.resolution.winner && (
                  <p>
                    <strong>Winner:</strong> {conflict.resolution.winner}
                  </p>
                )}
                {conflict.resolution.mergedData && (
                  <pre className="merged-data">
                    {JSON.stringify(conflict.resolution.mergedData, null, 2)}
                  </pre>
                )}
              </div>
            )}

            {!conflict.resolvedAt && (
              <button
                className="resolve-btn"
                onClick={() => onResolveClick?.(conflict.id)}
              >
                Resolve
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};