import type { DriftAlert, IAgentKitProvider } from './types.js';

/**
 * Attempts to enrich a DriftAlert with World ID delegation data.
 * Gracefully degrades — if AgentKit is unavailable or the agent has no
 * delegation, the alert is returned unmodified.
 */
export async function enrichWithAgentKit(
  alert: DriftAlert,
  provider: IAgentKitProvider | undefined,
): Promise<DriftAlert> {
  if (!provider) return alert;

  try {
    const delegation = await provider.getDelegation(alert.agentId);
    if (!delegation) return alert;

    return {
      ...alert,
      humanNullifierHash: delegation.humanNullifierHash,
      delegationTimestamp: delegation.delegationTimestamp,
    };
  } catch {
    return alert;
  }
}
