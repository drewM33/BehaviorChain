import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TierBadge } from '../components/TierBadge';
import { RiskBadge } from '../components/RiskBadge';

interface LeaderboardEntry {
  position: number;
  agentId: number;
  name: string;
  cleanLaps: number;
  chainLength: number;
  changesPerMonth: number;
  tier: string;
  riskLevel: string;
  driftFlags: number;
  score: number;
}

function podiumColor(pos: number): string {
  if (pos === 1) return 'border-status-yellow bg-status-yellow/5';
  if (pos === 2) return 'border-neutral-400 bg-neutral-400/5';
  if (pos === 3) return 'border-amber-700 bg-amber-700/5';
  return 'border-surface-border bg-surface';
}

function podiumLabel(pos: number): string {
  if (pos === 1) return '🥇';
  if (pos === 2) return '🥈';
  if (pos === 3) return '🥉';
  return `${pos}`;
}

export function Standings() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/leaderboard')
      .then((r) => r.json())
      .then((d) => { setEntries(d.leaderboard); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-chain border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Standings</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Agents ranked by stability — fewest changes over longest period
        </p>
      </div>

      {/* Podium */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="podium">
        {podium.map((entry) => (
          <Link
            key={entry.agentId}
            to={`/agent/${entry.agentId}`}
            className={`border-2 ${podiumColor(entry.position)} rounded-lg p-5 transition-colors hover:bg-surface-hover`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">{podiumLabel(entry.position)}</span>
              <TierBadge tier={entry.tier} size="md" />
            </div>
            <p className="text-lg font-bold font-mono text-white mb-1">
              Agent #{entry.agentId}
            </p>
            <p className="text-xs text-neutral-500 mb-3">{entry.name}</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-neutral-600">Clean Laps</span>
                <p className="font-mono text-status-green font-bold">{entry.cleanLaps}</p>
              </div>
              <div>
                <span className="text-neutral-600">Changes/mo</span>
                <p className="font-mono text-white font-bold">{entry.changesPerMonth}</p>
              </div>
              <div>
                <span className="text-neutral-600">Chain</span>
                <p className="font-mono text-chain font-bold">{entry.chainLength}</p>
              </div>
              <div>
                <span className="text-neutral-600">Drift Flags</span>
                <p className={`font-mono font-bold ${entry.driftFlags === 0 ? 'text-status-green' : 'text-status-yellow'}`}>
                  {entry.driftFlags}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Table for remaining entries */}
      {rest.length > 0 && (
        <div className="bg-surface border border-surface-border rounded-lg overflow-hidden">
          <table className="w-full text-sm" data-testid="leaderboard-table">
            <thead>
              <tr className="border-b border-surface-border text-left">
                <th className="px-4 py-3 text-xs text-neutral-500 font-mono uppercase">Pos</th>
                <th className="px-4 py-3 text-xs text-neutral-500 font-mono uppercase">Agent</th>
                <th className="px-4 py-3 text-xs text-neutral-500 font-mono uppercase text-right">Clean Laps</th>
                <th className="px-4 py-3 text-xs text-neutral-500 font-mono uppercase text-right">Chain</th>
                <th className="px-4 py-3 text-xs text-neutral-500 font-mono uppercase text-right">Chg/mo</th>
                <th className="px-4 py-3 text-xs text-neutral-500 font-mono uppercase text-center">Tier</th>
                <th className="px-4 py-3 text-xs text-neutral-500 font-mono uppercase text-right">Drift</th>
              </tr>
            </thead>
            <tbody>
              {rest.map((entry) => (
                <tr key={entry.agentId} className="border-b border-surface-border/50 hover:bg-surface-hover transition-colors">
                  <td className="px-4 py-3 font-mono text-neutral-400">{entry.position}</td>
                  <td className="px-4 py-3">
                    <Link to={`/agent/${entry.agentId}`} className="text-chain hover:underline font-mono">
                      #{entry.agentId}
                    </Link>
                    <span className="ml-2 text-neutral-500 text-xs">{entry.name}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-right text-status-green">{entry.cleanLaps}</td>
                  <td className="px-4 py-3 font-mono text-right text-chain">{entry.chainLength}</td>
                  <td className="px-4 py-3 font-mono text-right text-white">{entry.changesPerMonth}</td>
                  <td className="px-4 py-3 text-center"><TierBadge tier={entry.tier} /></td>
                  <td className="px-4 py-3 font-mono text-right">
                    <span className={entry.driftFlags === 0 ? 'text-status-green' : 'text-status-yellow'}>
                      {entry.driftFlags}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
