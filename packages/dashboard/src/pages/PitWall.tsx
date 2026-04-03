import { useEffect, useState } from 'react';
import { MetricCard } from '../components/MetricCard';

interface StatsData {
  totalAgents: number;
  totalBehavioralChanges: number;
  totalDriftAlerts: number;
  driftDetectionRate: string;
  averageCleanLaps: number;
  chainIntegrityRate: string;
  industryAvgDetectionDays: number;
  behaviorChainDetectionSeconds: number;
}

export function PitWall() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stats')
      .then((r) => r.json())
      .then((d) => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-chain border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Pit Wall</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Aggregate system metrics
        </p>
      </div>

      {/* Primary metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4" data-testid="stats-grid">
        <MetricCard
          label="Total Agents"
          value={stats.totalAgents}
          subtitle="monitored agents"
          color="blue"
        />
        <MetricCard
          label="Total Behavioral Changes"
          value={stats.totalBehavioralChanges}
          subtitle="on-chain commits"
          color="neutral"
        />
        <MetricCard
          label="Drift Detection Rate"
          value={stats.driftDetectionRate}
          subtitle="alerts / changes ratio"
          color="green"
        />
        <MetricCard
          label="Average Clean Laps"
          value={stats.averageCleanLaps}
          subtitle="evaluations without change"
          color="green"
        />
        <MetricCard
          label="Chain Integrity Rate"
          value={stats.chainIntegrityRate}
          subtitle="agents with intact chains"
          color="green"
        />
        <MetricCard
          label="Total Drift Alerts"
          value={stats.totalDriftAlerts}
          subtitle="across all agents"
          color="yellow"
        />
      </div>

      {/* Comparison card */}
      <div
        className="bg-surface border border-surface-border rounded-lg p-6"
        data-testid="comparison-card"
      >
        <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-6">
          Detection Speed Comparison
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Industry average */}
          <div className="bg-bg rounded-lg p-5 border border-status-red/20">
            <p className="text-xs text-neutral-500 uppercase mb-2">
              Industry Average Detection
            </p>
            <p className="text-4xl font-bold font-mono text-status-red">
              {stats.industryAvgDetectionDays}
            </p>
            <p className="text-sm text-neutral-500 mt-1">days to detect compromised agent</p>
            <div className="mt-4 h-2 bg-neutral-800 rounded-full overflow-hidden">
              <div className="h-full bg-status-red rounded-full w-full" />
            </div>
          </div>

          {/* BehaviorChain */}
          <div className="bg-bg rounded-lg p-5 border border-status-green/20">
            <p className="text-xs text-neutral-500 uppercase mb-2">
              BehaviorChain Detection
            </p>
            <p className="text-4xl font-bold font-mono text-status-green">
              &lt; {stats.behaviorChainDetectionSeconds}
            </p>
            <p className="text-sm text-neutral-500 mt-1">seconds to detect behavioral change</p>
            <div className="mt-4 h-2 bg-neutral-800 rounded-full overflow-hidden">
              <div className="h-full bg-status-green rounded-full" style={{ width: '0.5%' }} />
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-neutral-600 mt-4 font-mono">
          Industry avg detection: {stats.industryAvgDetectionDays} days / BehaviorChain: &lt; {stats.behaviorChainDetectionSeconds} seconds
        </p>
      </div>
    </div>
  );
}
