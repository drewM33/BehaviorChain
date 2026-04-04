import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MetricCard } from '../components/MetricCard';
import { TrustBar } from '../components/TrustBar';
import { HashChainViz } from '../components/HashChainViz';
import { DriftAlertCard } from '../components/DriftAlertCard';
import type { DriftAlert } from '@behaviorchain/drift';

interface ChainNodeData {
  index: number;
  snapshotHash: string;
  previousHash: string;
  timestamp: number;
  encryptedDataUri: string;
  description: string;
  txHash?: string;
  blockNumber?: number;
}

interface ProfileData {
  agentId: number;
  name: string;
  chain: {
    length: number;
    headHash: string | null;
    intact: boolean;
    firstChange: number;
    lastChange: number;
    lastChangeDescription: string;
    nodes: ChainNodeData[];
  };
  trust: {
    score: number;
    tier: string;
    riskLevel: string;
    route: string;
  };
  drift: {
    flagCount: number;
    highestSeverity: string;
    alerts: DriftAlert[];
  };
  delegation: { humanNullifierHash: string; delegationTimestamp: number } | null;
  cleanLaps: number;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function severityColor(s: string): 'green' | 'yellow' | 'red' | 'neutral' {
  if (s === 'critical' || s === 'high') return 'red';
  if (s === 'medium') return 'yellow';
  if (s === 'low') return 'green';
  return 'neutral';
}

const LIVE_AGENT = 3458;
const AGENT_IDS = [3458, 42, 43, 44, 45, 46, 47];

export function Telemetry() {
  const { agentId } = useParams<{ agentId: string }>();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [flagging, setFlagging] = useState(false);
  const [flagResult, setFlagResult] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/agents/${agentId}/profile`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [agentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-chain border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20">
        <p className="text-neutral-500 text-lg">Agent not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Agent selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-neutral-500 font-mono mr-2">AGENT</span>
        {AGENT_IDS.map((id) => (
          <Link
            key={id}
            to={`/agent/${id}`}
            className={`px-3 py-1 rounded text-sm font-mono transition-colors flex items-center gap-1.5 ${
              Number(agentId) === id
                ? 'bg-chain text-white'
                : 'bg-surface border border-surface-border text-neutral-400 hover:text-white'
            }`}
          >
            #{id}
            {id === LIVE_AGENT && (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            )}
          </Link>
        ))}
      </div>

      {/* Page header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-white">
          Agent #{data.agentId}
        </h1>
        <span className="text-neutral-500 font-mono text-sm">{data.name}</span>
        {data.agentId === LIVE_AGENT && (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-green-500/15 text-green-400 border border-green-500/30 uppercase">
            Live on-chain
          </span>
        )}
        <div className="ml-auto flex items-center gap-3">
          {flagResult && (
            <span className="text-xs font-mono text-status-green">{flagResult}</span>
          )}
          <button
            onClick={async () => {
              setFlagging(true);
              setFlagResult(null);
              try {
                const res = await fetch(`/api/agents/${data.agentId}/flag`, {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ reason: 'Manual review flagged via dashboard' }),
                });
                if (res.ok) {
                  setFlagResult('Drift flagged');
                } else {
                  setFlagResult('Flag failed');
                }
              } catch {
                setFlagResult('Network error');
              }
              setFlagging(false);
            }}
            disabled={flagging}
            className="px-3 py-1.5 text-xs font-mono font-medium rounded border transition-colors
              bg-status-red/10 text-status-red border-status-red/30
              hover:bg-status-red/20 disabled:opacity-50"
          >
            {flagging ? 'Flagging…' : 'Flag Drift'}
          </button>
          <Link
            to={`/badge/${data.agentId}`}
            className="text-xs text-chain hover:underline font-mono"
          >
            View Badge →
          </Link>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="metric-cards">
        <MetricCard
          label="Chain Length"
          value={data.chain.length}
          subtitle="behavioral changes"
          color="blue"
        />
        <MetricCard
          label="Last Change"
          value={timeAgo(data.chain.lastChange)}
          subtitle={data.chain.lastChangeDescription}
          color="neutral"
        />
        <MetricCard
          label="Drift Flags"
          value={data.drift.flagCount}
          subtitle={data.drift.highestSeverity !== 'none' ? `highest: ${data.drift.highestSeverity}` : 'none detected'}
          color={severityColor(data.drift.highestSeverity)}
        />
        <MetricCard
          label="Chain Integrity"
          value={data.chain.intact ? 'VALID' : 'BROKEN'}
          subtitle={data.chain.intact ? 'genesis to head verified' : 'chain continuity broken'}
          color={data.chain.intact ? 'green' : 'red'}
        />
      </div>

      {/* Trust bar */}
      <TrustBar
        score={data.trust.score}
        tier={data.trust.tier}
        riskLevel={data.trust.riskLevel}
        route={data.trust.route}
        delegated={data.delegation !== null}
      />

      {/* Delegation info */}
      {data.delegation && (
        <div className="bg-surface border border-chain/20 rounded-lg p-5" data-testid="delegation-info">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-chain text-lg">✓</span>
            <p className="text-sm font-semibold text-white">
              Human Delegator (World ID)
            </p>
            <span className="text-xs text-neutral-500 ml-auto">
              Delegated {timeAgo(data.delegation.delegationTimestamp)}
            </span>
          </div>
          <div className="bg-bg rounded border border-surface-border p-3">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">
              Nullifier Hash
            </p>
            <p className="text-xs text-chain font-mono break-all select-all leading-relaxed">
              {data.delegation.humanNullifierHash}
            </p>
          </div>
        </div>
      )}

      {/* Hash chain visualization */}
      <HashChainViz chain={data.chain.nodes} driftAlerts={data.drift.alerts} />

      {/* Drift feed */}
      {data.drift.alerts.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-3">
            Drift History
          </h3>
          <div className="space-y-3">
            {data.drift.alerts.map((alert, i) => (
              <DriftAlertCard key={i} alert={alert} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
