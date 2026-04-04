import { useEffect, useState, useRef, useCallback } from 'react';
import type { DriftAlert } from '@behaviorchain/drift';
import { DriftAlertCard } from '../components/DriftAlertCard';

type SeverityFilter = 'all' | 'medium' | 'critical';

const FILTER_OPTIONS: { value: SeverityFilter; label: string; icon: string }[] = [
  { value: 'all', label: 'All Flags', icon: '🟢' },
  { value: 'medium', label: 'Medium+', icon: '🟡' },
  { value: 'critical', label: 'Critical Only', icon: '🔴' },
];

function passesFilter(alert: DriftAlert, filter: SeverityFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'medium') return ['medium', 'high', 'critical'].includes(alert.severity);
  return ['high', 'critical'].includes(alert.severity);
}

export function RaceControl() {
  const [alerts, setAlerts] = useState<DriftAlert[]>([]);
  const [filter, setFilter] = useState<SeverityFilter>('all');
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const addAlert = useCallback((alert: DriftAlert) => {
    setAlerts((prev) => [alert, ...prev].slice(0, 200));
  }, []);

  // Load historical alerts
  useEffect(() => {
    fetch('/api/agents/42/drift').then((r) => r.json()).then((d) => d.alerts?.forEach(addAlert)).catch(() => {});
    fetch('/api/agents/43/drift').then((r) => r.json()).then((d) => d.alerts?.forEach(addAlert)).catch(() => {});
    fetch('/api/agents/44/drift').then((r) => r.json()).then((d) => d.alerts?.forEach(addAlert)).catch(() => {});
    fetch('/api/agents/45/drift').then((r) => r.json()).then((d) => d.alerts?.forEach(addAlert)).catch(() => {});
  }, [addAlert]);

  // SSE connection for live alerts
  useEffect(() => {
    const es = new EventSource('/api/events');
    esRef.current = es;

    es.addEventListener('drift', (event) => {
      try {
        const alert = JSON.parse(event.data) as DriftAlert;
        addAlert(alert);
      } catch { /* ignore parse errors */ }
    });

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [addAlert]);

  const filtered = alerts
    .filter((a) => passesFilter(a, filter))
    .sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Behavior Hashes</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Real-time drift feed across all agents
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-mono ${
              connected ? 'text-status-green' : 'text-status-red'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-status-green animate-pulse-slow' : 'bg-status-red'}`} />
            {connected ? 'LIVE' : 'DISCONNECTED'}
          </span>
        </div>
      </div>

      {/* Severity filter */}
      <div className="flex items-center gap-2" data-testid="severity-filter">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === opt.value
                ? 'bg-surface border border-white/10 text-white'
                : 'bg-surface/50 border border-surface-border text-neutral-500 hover:text-white'
            }`}
          >
            <span className="mr-1.5">{opt.icon}</span>
            {opt.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-neutral-600 font-mono">
          {filtered.length} alert{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Alert stream */}
      <div className="space-y-3" data-testid="drift-feed">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-neutral-600 text-lg">No alerts matching filter</p>
          </div>
        ) : (
          filtered.map((alert, i) => (
            <DriftAlertCard
              key={`${alert.agentId}-${alert.snapshotIndex}-${alert.timestamp}-${i}`}
              alert={alert}
              animate={i === 0}
            />
          ))
        )}
      </div>
    </div>
  );
}
