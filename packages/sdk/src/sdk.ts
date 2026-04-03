import { ethers, type TransactionReceipt } from 'ethers';
import { BEHAVIOR_SNAPSHOT_REGISTRY_ABI } from './abi.js';
import { fallbackSnapshot } from './fallback.js';
import { createAutoCommitServer } from './auto-commit.js';
import {
  type BehaviorChainSDKConfig,
  type CommitResult,
  type SnapshotEvent,
  type ChainVerificationResult,
  type AutoCommitOptions,
  type IValironSDK,
  ZERO_BYTES32,
} from './types.js';

interface ContractLike {
  getChainHead(agentId: bigint): Promise<string>;
  getSnapshotCount(agentId: bigint): Promise<bigint>;
  commitSnapshot(
    agentId: bigint,
    snapshotHash: string,
    previousHash: string,
    encryptedDataUri: string,
  ): Promise<{ wait(): Promise<TransactionReceipt> }>;
  queryFilter(filter: unknown, fromBlock?: number, toBlock?: number): Promise<unknown[]>;
  filters: {
    SnapshotCommitted(agentId?: bigint | null): unknown;
  };
  runner?: { provider?: { getBlockNumber(): Promise<number> } };
}

export class BehaviorChainSDK {
  private contract: ContractLike;
  private valiron: IValironSDK;
  private fromBlock: number;

  constructor(config: BehaviorChainSDKConfig) {
    this.fromBlock = config.fromBlock ?? 0;
    if (config._contractOverride) {
      this.contract = config._contractOverride as ContractLike;
    } else {
      const provider = new ethers.JsonRpcProvider(config.rpcUrl);
      const signer = new ethers.Wallet(config.privateKey, provider);
      this.contract = new ethers.Contract(
        config.contractAddress,
        BEHAVIOR_SNAPSHOT_REGISTRY_ABI,
        signer,
      ) as unknown as ContractLike;
    }
    this.valiron = config.valiron;
  }

  /**
   * Core commit-on-change logic. Fetches the latest snapshot hash from Valiron,
   * compares against the on-chain head, and only commits if they differ.
   */
  async commitIfChanged(agentId: string): Promise<CommitResult> {
    let snapshotHash: string;
    let encryptedDataUri: string | null;

    try {
      const snapshot = await this.valiron.getAgentSnapshot(agentId);
      snapshotHash = snapshot.snapshotHash;
      encryptedDataUri = snapshot.encryptedDataUri;
    } catch {
      const fb = await fallbackSnapshot(this.valiron, agentId);
      snapshotHash = fb.snapshotHash;
      encryptedDataUri = null;
    }

    const chainHead = await this.getChainHead(agentId);

    if (snapshotHash.toLowerCase() === chainHead.toLowerCase()) {
      return { committed: false, snapshotHash };
    }

    const tx = await this.contract.commitSnapshot(
      BigInt(agentId),
      snapshotHash,
      chainHead,
      encryptedDataUri ?? '',
    );

    const receipt = await tx.wait();

    return {
      committed: true,
      tx: receipt,
      snapshotHash,
      previousHash: chainHead,
    };
  }

  async getChainHead(agentId: string): Promise<string> {
    return this.contract.getChainHead(BigInt(agentId));
  }

  async getSnapshotCount(agentId: string): Promise<number> {
    const count = await this.contract.getSnapshotCount(BigInt(agentId));
    return Number(count);
  }

  /**
   * Reads all SnapshotCommitted events for an agent and verifies that the
   * previousHash linkage is intact from genesis to head.
   */
  async verifyChain(agentId: string): Promise<ChainVerificationResult> {
    const events = await this.getSnapshotEvents(agentId);

    if (events.length === 0) {
      return { valid: true, chainLength: 0, events };
    }

    const sorted = [...events].sort((a, b) =>
      a.snapshotIndex < b.snapshotIndex ? -1 : a.snapshotIndex > b.snapshotIndex ? 1 : 0,
    );

    if (sorted[0].previousHash.toLowerCase() !== ZERO_BYTES32) {
      return { valid: false, chainLength: sorted.length, events: sorted, brokenAt: 0 };
    }

    for (let i = 1; i < sorted.length; i++) {
      if (
        sorted[i].previousHash.toLowerCase() !==
        sorted[i - 1].snapshotHash.toLowerCase()
      ) {
        return {
          valid: false,
          chainLength: sorted.length,
          events: sorted,
          brokenAt: i,
        };
      }
    }

    return { valid: true, chainLength: sorted.length, events: sorted };
  }

  async getSnapshotEvents(agentId: string): Promise<SnapshotEvent[]> {
    const filter = this.contract.filters.SnapshotCommitted(BigInt(agentId));
    const logs = await this.queryFilterPaginated(filter, this.fromBlock);

    return (logs as Array<Record<string, any>>).map((log) => ({
      agentId: log.args.agentId as bigint,
      snapshotIndex: log.args.snapshotIndex as bigint,
      snapshotHash: log.args.snapshotHash as string,
      previousHash: log.args.previousHash as string,
      timestamp: log.args.timestamp as bigint,
      encryptedDataUri: log.args.encryptedDataUri as string,
      blockNumber: log.blockNumber as number,
      transactionHash: log.transactionHash as string,
    }));
  }

  /**
   * Queries contract events with automatic pagination to handle RPC block
   * range limits (commonly 10,000 blocks on public endpoints).
   */
  /**
   * Queries contract events with automatic pagination to handle RPC block
   * range limits (commonly 10,000 blocks on public endpoints).
   */
  private async queryFilterPaginated(
    filter: unknown,
    startBlock = 0,
    chunkSize = 9_999,
  ): Promise<unknown[]> {
    try {
      return await this.contract.queryFilter(filter, startBlock);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('10,000') && !msg.includes('range')) throw err;
    }

    const provider = this.contract.runner?.provider;
    if (!provider) throw new Error('Cannot paginate: no provider on contract');

    const latest = await provider.getBlockNumber();
    const allLogs: unknown[] = [];

    for (let from = startBlock; from <= latest; from += chunkSize + 1) {
      const to = Math.min(from + chunkSize, latest);
      const chunk = await this.contract.queryFilter(filter, from, to);
      allLogs.push(...chunk);
    }

    return allLogs;
  }

  /**
   * Starts an HTTP server that listens for Valiron `evaluation_complete`
   * webhook POSTs. On each event, calls `commitIfChanged(agentId)`.
   */
  startAutoCommit(agentId: string, options: AutoCommitOptions) {
    return createAutoCommitServer(this, agentId, options);
  }
}
