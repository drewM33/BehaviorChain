import type {
  CommitResult,
  ChainVerificationResult,
  SnapshotEvent,
} from '@behaviorchain/sdk';
import type {
  DriftAlert,
  SnapshotCommittedEvent,
  IAgentKitProvider,
} from '@behaviorchain/drift';

// ---------------------------------------------------------------------------
// Abstractions over the SDK and drift engine so the pipeline can be tested
// with in-memory mocks.
// ---------------------------------------------------------------------------

export interface IBehaviorChainSDK {
  commitIfChanged(agentId: string): Promise<CommitResult>;
  getChainHead(agentId: string): Promise<string>;
  getSnapshotCount(agentId: string): Promise<number>;
  verifyChain(agentId: string): Promise<ChainVerificationResult>;
  getSnapshotEvents(agentId: string): Promise<SnapshotEvent[]>;
}

export interface IDriftEngine {
  processEvent(event: SnapshotCommittedEvent): Promise<DriftAlert | null>;
  readonly alerts: DriftAlert[];
}

export interface IValironSDK {
  getAgentSnapshot(agentId: string): Promise<{ snapshotHash: string; encryptedDataUri: string | null }>;
  getAgentProfile(agentId: string): Promise<{
    localReputation?: { score: number; tier: string; riskLevel: string };
    routing: { finalRoute: string };
    onchainReputation: { count: number; averageScore: number };
  }>;
}

// ---------------------------------------------------------------------------
// Pipeline config
// ---------------------------------------------------------------------------

export interface BehaviorChainPipelineConfig {
  valiron: IValironSDK;
  behaviorchain: IBehaviorChainSDK;
  driftEngine?: IDriftEngine;
  agentKit?: IAgentKitProvider;
  /** Port for the webhook + trust-signal HTTP server (default: 3002). */
  webhookPort?: number;
  /** Shared secret to validate incoming Valiron webhooks. */
  webhookSecret?: string;
  /** Agent IDs to monitor. Used for recovery on startup. */
  agentIds?: string[];
  /** Retry interval in ms (default: 10_000). */
  retryIntervalMs?: number;
  /** Maximum retry attempts per failed commit (default: 5). */
  maxRetries?: number;
  onCommit?: (agentId: string, result: CommitResult) => void;
  onSkip?: (agentId: string) => void;
  onError?: (agentId: string, error: Error) => void;
}

// ---------------------------------------------------------------------------
// Trust signal — the output Valiron (or any consumer) queries
// ---------------------------------------------------------------------------

export interface BehaviorChainTrustSignal {
  agentId: string;
  chainLength: number;
  lastCommitAge: number;
  driftFlags: number;
  recentCriticalDrift: boolean;
  chainIntact: boolean;
  integrityScore: number;
  humanDelegated: boolean;
}

// ---------------------------------------------------------------------------
// Pipeline stats — exposed for testing and observability
// ---------------------------------------------------------------------------

export interface PipelineStats {
  webhooksReceived: number;
  commitsAttempted: number;
  commitsMade: number;
  commitsSkipped: number;
  commitsFailed: number;
  retriesProcessed: number;
  recoveredGaps: number;
}

// ---------------------------------------------------------------------------
// Retry queue entry
// ---------------------------------------------------------------------------

export interface RetryEntry {
  agentId: string;
  attempts: number;
  lastAttempt: number;
  nextAttempt: number;
}
