import { TierBadge } from './TierBadge';
import { RiskBadge } from './RiskBadge';

interface TrustBarProps {
  score: number;
  tier: string;
  riskLevel: string;
  route: string;
  delegated: boolean;
}

function gaugeColor(score: number): string {
  if (score >= 80) return 'bg-status-green';
  if (score >= 50) return 'bg-status-yellow';
  return 'bg-status-red';
}

export function TrustBar({ score, tier, riskLevel, route, delegated }: TrustBarProps) {
  const pct = Math.min(100, (score / 110) * 100);

  return (
    <div className="bg-surface border border-surface-border rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">
          Valiron Trust Profile
        </h3>
        <div className="flex items-center gap-2">
          {delegated && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold rounded border bg-chain/15 text-chain border-chain/30">
              ✓ WORLD ID VERIFIED
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-6 flex-wrap">
        {/* Score gauge */}
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-neutral-500 font-mono">SCORE</span>
            <span className="text-lg font-bold font-mono text-white">{score}<span className="text-neutral-600">/110</span></span>
          </div>
          <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${gaugeColor(score)}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-3">
          <div className="text-center">
            <p className="text-[10px] text-neutral-600 uppercase mb-1">Tier</p>
            <TierBadge tier={tier} size="md" />
          </div>
          <div className="text-center">
            <p className="text-[10px] text-neutral-600 uppercase mb-1">Risk</p>
            <RiskBadge level={riskLevel} size="md" />
          </div>
          <div className="text-center">
            <p className="text-[10px] text-neutral-600 uppercase mb-1">Route</p>
            <span className="inline-flex items-center px-3 py-1 text-sm font-mono font-medium rounded border bg-neutral-800/50 text-neutral-300 border-neutral-700">
              {route}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
