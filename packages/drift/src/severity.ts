import type { DriftSignal, Severity, SensitivityConfig } from './types.js';
import { SEVERITY_ORDER } from './types.js';
import { tierDowngradeLevels } from './signals.js';

const CRITICAL_TIERS = new Set(['CAA', 'CA', 'C']);

/**
 * Classifies the overall severity of a drift alert from its constituent signals.
 *
 * Classification rules (from spec):
 *   Critical: route → sandbox_only, risk → RED, tier → CAA/CA/C
 *   High:     score drop ≥25, route → prod_throttled
 *   Medium:   score drop ≥15, tier downgrade 1 level
 *   Low:      all other changes
 */
export function classifySeverity(
  signals: DriftSignal[],
  config: SensitivityConfig,
): Severity {
  let maxSeverity: Severity = 'low';

  for (const signal of signals) {
    const severity = classifySignal(signal, config);
    if (SEVERITY_ORDER[severity] > SEVERITY_ORDER[maxSeverity]) {
      maxSeverity = severity;
    }
  }

  return maxSeverity;
}

function classifySignal(signal: DriftSignal, config: SensitivityConfig): Severity {
  switch (signal.dimension) {
    case 'route_change':
      if (signal.current === 'sandbox_only') return 'critical';
      if (signal.current === 'prod_throttled') return 'high';
      return 'low';

    case 'risk_escalation':
    case 'score_cliff':
      if (String(signal.current).toUpperCase() === 'RED') return 'critical';
      if (String(signal.current).toUpperCase() === 'YELLOW') return 'medium';
      return 'low';

    case 'tier_downgrade': {
      const currentTier = String(signal.current).toUpperCase();
      if (CRITICAL_TIERS.has(currentTier)) return 'critical';
      const levels = tierDowngradeLevels(
        String(signal.previous),
        String(signal.current),
      );
      if (levels >= 2) return 'high';
      if (levels >= 1) return 'medium';
      return 'low';
    }

    case 'score_drop': {
      const drop = Number(signal.previous) - Number(signal.current);
      if (drop >= 25) return 'high';
      if (drop >= config.scoreDropThreshold) return 'medium';
      return 'low';
    }

    case 'negative_feedback_spike':
      return 'medium';

    case 'hash_change':
      return 'low';

    default:
      return 'low';
  }
}
