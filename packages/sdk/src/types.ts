import type { TransactionReceipt } from 'ethers';

// ---------------------------------------------------------------------------
// Valiron SDK interface — matches @valiron/sdk@0.10.0 type surface
// ---------------------------------------------------------------------------

export interface AgentSnapshotSummary {
  agentId: string;
  snapshotHash: string;
  previousHash: string;
  encryptedDataUri: string | null;
  timestamp: string | null;
  interactionCount: number;
}

export interface AgentProfile {
  localReputation?: {
    score: number;
    tier: string;
    riskLevel: string;
  };
  routing: {
    finalRoute: string;
  };
  onchainReputation: {
    count: number;
    averageScore: number;
  };
}

export interface IValironSDK {
  getAgentSnapshot(agentId: string, opts?: unknown): Promise<AgentSnapshotSummary>;
  getAgentProfile(agentId: string, opts?: unknown): Promise<AgentProfile>;
}

// ---------------------------------------------------------------------------
// BehaviorChain SDK types
// ---------------------------------------------------------------------------

export interface CommitResult {
  committed: boolean;
  snapshotHash: string;
  tx?: TransactionReceipt;
  previousHash?: string;
}

export interface SnapshotEvent {
  agentId: bigint;
  snapshotIndex: bigint;
  snapshotHash: string;
  previousHash: string;
  timestamp: bigint;
  encryptedDataUri: string;
  blockNumber: number;
  transactionHash: string;
}

export interface ChainVerificationResult {
  valid: boolean;
  chainLength: number;
  events: SnapshotEvent[];
  brokenAt?: number;
}

export interface AutoCommitOptions {
  webhookPort: number;
  onCommit?: (result: CommitResult) => void;
  onSkip?: (result: { snapshotHash: string }) => void;
}

export interface BehaviorChainSDKConfig {
  rpcUrl: string;
  privateKey: string;
  contractAddress: string;
  valiron: IValironSDK;
  /** Block number from which to start querying events (defaults to 0). */
  fromBlock?: number;
  /** @internal Override the contract instance (for unit testing). */
  _contractOverride?: unknown;
}

export const ZERO_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000';

/** Base Sepolia (testnet) deployment. */
export const BASE_SEPOLIA_CONTRACT = '0xDe27DF9DA6BaD0b172F3F1b48CEe818dFE4487CD';

/** Base mainnet deployment. */
export const BASE_MAINNET_CONTRACT = '0x2Dd0946Be048e7B61E2995bdDE97860427e74562';

/**
 * Default contract address used when `contractAddress` is omitted from config.
 * Defaults to testnet until a mainnet deployment is available.
 */
export const DEFAULT_CONTRACT_ADDRESS =
  BASE_MAINNET_CONTRACT || BASE_SEPOLIA_CONTRACT;
