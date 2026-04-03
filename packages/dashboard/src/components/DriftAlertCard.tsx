import type { DriftAlert } from '@behaviorchain/drift';
import { SeverityFlag } from './SeverityIcon';
import { severityBorderColor, severityBgColor } from './SeverityIcon';

interface DriftAlertCardProps {
  alert: DriftAlert;
  animate?: boolean;
}

function formatHash(h: string): string {
  if (!h || h.length <= 14) return h || '—';
  return `${h.slice(0, 8)}…${h.slice(-4)}`;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function DriftAlertCard({ alert, animate = false }: DriftAlertCardProps) {
  return (
    <div
      className={`
        border-l-4 ${severityBorderColor(alert.severity)} ${severityBgColor(alert.severity)}
        bg-surface border border-surface-border rounded-r-lg p-4
        ${animate ? 'animate-slide-in' : ''}
      `}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <SeverityFlag severity={alert.severity} />
          <span className="text-sm font-mono text-white">
            Agent #{alert.agentId}
          </span>
          <span className="text-xs text-neutral-500 font-mono">
            snapshot #{alert.snapshotIndex}
          </span>
        </div>
        <span className="text-xs text-neutral-500 font-mono">
          {timeAgo(alert.timestamp)}
        </span>
      </div>

      <div className="space-y-1.5 mb-2">
        {alert.driftSignals.map((signal, i) => (
          <p key={i} className="text-sm text-neutral-300">
            {signal.description}
          </p>
        ))}
      </div>

      <div className="flex items-center gap-4 text-xs font-mono text-neutral-500">
        <span>
          {formatHash(alert.previousSnapshotHash)} → {formatHash(alert.currentSnapshotHash)}
        </span>
        {alert.humanNullifierHash && (
          <span className="text-chain" data-testid="human-delegator">
            ✓ Human delegator: {formatHash(alert.humanNullifierHash)}
          </span>
        )}
      </div>
    </div>
  );
}
