import type { IValironSDK } from '@behaviorchain/sdk';

// ---------------------------------------------------------------------------
// Severity levels
// ---------------------------------------------------------------------------

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export const SEVERITY_ORDER: Record<Severity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

// ---------------------------------------------------------------------------
// Drift signal — a single dimension of detected change
// ---------------------------------------------------------------------------

export interface DriftSignal {
  dimension: string;
  previous: string | number;
  current: string | number;
  description: string;
}

// ---------------------------------------------------------------------------
// Drift alert — the full alert emitted per event
// ---------------------------------------------------------------------------

export interface DriftAlert {
  agentId: string;
  chainId: number;
  snapshotIndex: number;
  previousSnapshotHash: string;
  currentSnapshotHash: string;
  driftSignals: DriftSignal[];
  severity: Severity;
  timestamp: number;
  /** World ID nullifier hash — present only when AgentKit delegation exists. */
  humanNullifierHash?: string;
  /** Unix ms when the human delegated to this agent. */
  delegationTimestamp?: number;
}

// ---------------------------------------------------------------------------
// Agent signals — the public profile fields we track over time
// ---------------------------------------------------------------------------

export interface AgentSignals {
  score: number;
  tier: string;
  riskLevel: string;
  route: string;
  onchainReputationCount: number;
  onchainReputationAvg: number;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// AgentKit provider — optional, for human accountability enrichment
// ---------------------------------------------------------------------------

export interface AgentKitDelegation {
  humanNullifierHash: string;
  delegationTimestamp: number;
}

export interface IAgentKitProvider {
  getDelegation(agentId: string): Promise<AgentKitDelegation | null>;
}

// ---------------------------------------------------------------------------
// Snapshot event from the contract (matches SDK SnapshotEvent shape)
// ---------------------------------------------------------------------------

export interface SnapshotCommittedEvent {
  agentId: bigint;
  snapshotIndex: bigint;
  snapshotHash: string;
  previousHash: string;
  timestamp: bigint;
  encryptedDataUri: string;
  blockNumber: number;
  transactionHash: string;
}

// ---------------------------------------------------------------------------
// Sensitivity configuration
// ---------------------------------------------------------------------------

export interface SensitivityConfig {
  /** Minimum score drop to trigger a drift signal (default: 15). */
  scoreDropThreshold: number;
  /** Hours without a commit before flagging a stale chain (default: 24). */
  staleChainHours: number;
  /** Number of historical signal snapshots to track per agent (default: 10). */
  trackHistory: number;
}

export const DEFAULT_SENSITIVITY: SensitivityConfig = {
  scoreDropThreshold: 15,
  staleChainHours: 24,
  trackHistory: 10,
};

// ---------------------------------------------------------------------------
// Alert configuration
// ---------------------------------------------------------------------------

export interface AlertConfig {
  /** URL to POST DriftAlert JSON to. */
  webhookUrl?: string;
  /** WebSocket port for broadcasting alerts to connected clients. */
  websocketPort?: number;
  /** Minimum severity to deliver. Alerts below this are suppressed. */
  severityThreshold?: Severity;
}

// ---------------------------------------------------------------------------
// Engine configuration
// ---------------------------------------------------------------------------

export interface DriftEngineConfig {
  contractAddress: string;
  rpcUrl: string;
  valironSdk: IValironSDK;
  chainId?: number;
  sensitivity?: Partial<SensitivityConfig>;
  alerts?: AlertConfig;
  agentKit?: IAgentKitProvider;
  /** Called for every alert that passes the severity threshold. */
  onDrift?: (alert: DriftAlert) => void;
  /** Block number to start scanning from (default: 0). */
  fromBlock?: number;
}
