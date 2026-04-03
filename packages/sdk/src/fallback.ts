import { createHash } from 'node:crypto';
import type { IValironSDK } from './types.js';

/**
 * Produces a deterministic snapshot hash from an agent's public profile fields.
 * Used when `getAgentSnapshot()` is unavailable (404 / error).
 */
export async function fallbackSnapshot(
  valiron: IValironSDK,
  agentId: string,
): Promise<{ snapshotHash: string }> {
  const profile = await valiron.getAgentProfile(agentId);
  const publicFields = {
    score: profile.localReputation?.score,
    tier: profile.localReputation?.tier,
    riskLevel: profile.localReputation?.riskLevel,
    route: profile.routing.finalRoute,
    feedbackCount: profile.onchainReputation.count,
    averageScore: profile.onchainReputation.averageScore,
  };
  const canonical = JSON.stringify(
    publicFields,
    Object.keys(publicFields).sort(),
  );
  return {
    snapshotHash:
      '0x' + createHash('sha256').update(canonical).digest('hex'),
  };
}
