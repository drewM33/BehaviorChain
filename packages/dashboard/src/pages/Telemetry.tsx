import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MetricCard } from '../components/MetricCard';
import { TrustBar } from '../components/TrustBar';
import { HashChainViz } from '../components/HashChainViz';
import { DriftAlertCard } from '../components/DriftAlertCard';
import type { DriftAlert } from '@behaviorchain/drift';

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
    nodes: Array<{
      index: number;
      snapshotHash: string;
      previousHash: string;
      timestamp: number;
      encryptedDataUri: string;
      description: string;
    }>;
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

const AGENT_IDS = [42, 43, 44, 45, 46, 47];

export function Telemetry() {
  const { agentId } = useParams<{ agentId: string }>();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

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
            className={`px-3 py-1 rounded text-sm font-mono transition-colors ${
              Number(agentId) === id
                ? 'bg-chain text-white'
                : 'bg-surface border border-surface-border text-neutral-400 hover:text-white'
            }`}
          >
            #{id}
          </Link>
        ))}
      </div>

      {/* Page header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-white">
          Agent #{data.agentId}
        </h1>
        <span className="text-neutral-500 font-mono text-sm">{data.name}</span>
        <Link
          to={`/badge/${data.agentId}`}
          className="ml-auto text-xs text-chain hover:underline font-mono"
        >
          View Badge →
        </Link>
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
        <div className="bg-surface border border-chain/20 rounded-lg p-4" data-testid="delegation-info">
          <div className="flex items-center gap-3">
            <span className="text-chain text-lg">✓</span>
            <div>
              <p className="text-sm font-semibold text-white">
                Human Delegator (World ID)
              </p>
              <p className="text-xs text-neutral-400 font-mono mt-0.5">
                Nullifier: {data.delegation.humanNullifierHash.slice(0, 8)}…{data.delegation.humanNullifierHash.slice(-4)}
              </p>
              <p className="text-xs text-neutral-500 mt-0.5">
                Delegated {timeAgo(data.delegation.delegationTimestamp)}
              </p>
            </div>
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
