import type { AgentSignals, DriftSignal, SensitivityConfig } from './types.js';
import type { AgentHistoryTracker } from './history.js';

const RISK_LEVELS = ['GREEN', 'YELLOW', 'RED'] as const;

function riskOrdinal(level: string): number {
  const idx = RISK_LEVELS.indexOf(level.toUpperCase() as (typeof RISK_LEVELS)[number]);
  return idx === -1 ? -1 : idx;
}

/**
 * Detects all drift signals by comparing current agent signals against the
 * most recent historical entry.
 *
 * Every SnapshotCommitted event is already a confirmed hash change, so
 * "hash_change" is always included.
 */
export function detectDriftSignals(
  agentId: string,
  current: AgentSignals,
  history: AgentHistoryTracker,
  config: SensitivityConfig,
): DriftSignal[] {
  const signals: DriftSignal[] = [];

  // 1. Hash change — guaranteed by commit-on-change design
  signals.push({
    dimension: 'hash_change',
    previous: 'n/a',
    current: 'n/a',
    description: 'Behavioral snapshot hash changed (confirmed by on-chain commit)',
  });

  const previous = history.getLatest(agentId);
  if (!previous) {
    return signals;
  }

  // 2. Score drop
  const scoreDelta = previous.score - current.score;
  if (scoreDelta >= config.scoreDropThreshold) {
    signals.push({
      dimension: 'score_drop',
      previous: previous.score,
      current: current.score,
      description: `Score dropped by ${scoreDelta} points (threshold: ${config.scoreDropThreshold})`,
    });
  }

  // 3. Score cliff — GREEN → YELLOW/RED in one evaluation
  if (
    previous.riskLevel.toUpperCase() === 'GREEN' &&
    (current.riskLevel.toUpperCase() === 'YELLOW' || current.riskLevel.toUpperCase() === 'RED')
  ) {
    signals.push({
      dimension: 'score_cliff',
      previous: previous.riskLevel,
      current: current.riskLevel,
      description: `Risk level jumped from ${previous.riskLevel} to ${current.riskLevel} in one evaluation`,
    });
  }

  // 4. Tier downgrade
  if (previous.tier !== current.tier && isTierDowngrade(previous.tier, current.tier)) {
    signals.push({
      dimension: 'tier_downgrade',
      previous: previous.tier,
      current: current.tier,
      description: `Tier downgraded from ${previous.tier} to ${current.tier}`,
    });
  }

  // 5. Route change
  if (previous.route !== current.route) {
    signals.push({
      dimension: 'route_change',
      previous: previous.route,
      current: current.route,
      description: `Route changed from ${previous.route} to ${current.route}`,
    });
  }

  // 6. Risk level escalation
  const prevRisk = riskOrdinal(previous.riskLevel);
  const currRisk = riskOrdinal(current.riskLevel);
  if (currRisk > prevRisk && prevRisk >= 0) {
    signals.push({
      dimension: 'risk_escalation',
      previous: previous.riskLevel,
      current: current.riskLevel,
      description: `Risk level escalated from ${previous.riskLevel} to ${current.riskLevel}`,
    });
  }

  // 7. Negative feedback spike — ≥3 low-score entries in last 5 evaluations
  const recentLow = history.countRecentLowScores(agentId, 40, 5);
  if (recentLow >= 3) {
    signals.push({
      dimension: 'negative_feedback_spike',
      previous: 0,
      current: recentLow,
      description: `${recentLow} low-score evaluations in the last 5 entries`,
    });
  }

  return signals;
}

// ---------------------------------------------------------------------------
// Tier ranking — higher index = worse tier
// ---------------------------------------------------------------------------

const TIER_ORDER = ['AAA', 'AA', 'A', 'BAA', 'BA', 'B', 'CAA', 'CA', 'C'];

function tierOrdinal(tier: string): number {
  const idx = TIER_ORDER.indexOf(tier.toUpperCase());
  return idx === -1 ? -1 : idx;
}

export function isTierDowngrade(previous: string, current: string): boolean {
  const prevIdx = tierOrdinal(previous);
  const currIdx = tierOrdinal(current);
  if (prevIdx === -1 || currIdx === -1) return false;
  return currIdx > prevIdx;
}

export function tierDowngradeLevels(previous: string, current: string): number {
  const prevIdx = tierOrdinal(previous);
  const currIdx = tierOrdinal(current);
  if (prevIdx === -1 || currIdx === -1) return 0;
  return Math.max(0, currIdx - prevIdx);
}

export { TIER_ORDER };
