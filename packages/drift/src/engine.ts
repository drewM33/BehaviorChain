import { ethers } from 'ethers';
import { BEHAVIOR_SNAPSHOT_REGISTRY_ABI } from '@behaviorchain/sdk';
import type { IValironSDK } from '@behaviorchain/sdk';
import type {
  DriftEngineConfig,
  DriftAlert,
  AgentSignals,
  SensitivityConfig,
  SnapshotCommittedEvent,
  IAgentKitProvider,
} from './types.js';
import { DEFAULT_SENSITIVITY } from './types.js';
import { AgentHistoryTracker } from './history.js';
import { detectDriftSignals } from './signals.js';
import { classifySeverity } from './severity.js';
import { enrichWithAgentKit } from './agentkit.js';
import { AlertDispatcher } from './alerts.js';

interface RegistryContract {
  on(event: string, listener: (...args: unknown[]) => void): void;
  off(event: string, listener: (...args: unknown[]) => void): void;
  queryFilter(filter: unknown, fromBlock?: number): Promise<unknown[]>;
  filters: {
    SnapshotCommitted(): unknown;
  };
  getLastCommitTimestamp(agentId: bigint): Promise<bigint>;
}

/**
 * Long-running process that subscribes to SnapshotCommitted events,
 * queries Valiron for the agent's current public signals, computes drift
 * signals and severity, and delivers DriftAlert objects.
 */
export class DriftEngine {
  private contract: RegistryContract;
  private provider: ethers.JsonRpcProvider;
  private valiron: IValironSDK;
  private agentKit: IAgentKitProvider | undefined;
  private sensitivity: SensitivityConfig;
  private chainId: number;
  private history: AgentHistoryTracker;
  private dispatcher: AlertDispatcher;
  private fromBlock: number;
  private running = false;
  private staleCheckInterval: ReturnType<typeof setInterval> | null = null;
  private trackedAgents = new Set<string>();
  private eventListener: ((...args: unknown[]) => void) | null = null;

  /** Exposed for testing — all alerts emitted by this engine instance. */
  readonly alerts: DriftAlert[] = [];

  constructor(config: DriftEngineConfig) {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.contract = new ethers.Contract(
      config.contractAddress,
      BEHAVIOR_SNAPSHOT_REGISTRY_ABI,
      this.provider,
    ) as unknown as RegistryContract;
    this.valiron = config.valironSdk;
    this.agentKit = config.agentKit;
    this.chainId = config.chainId ?? 84532;
    this.fromBlock = config.fromBlock ?? 0;

    this.sensitivity = {
      ...DEFAULT_SENSITIVITY,
      ...config.sensitivity,
    };

    this.history = new AgentHistoryTracker(this.sensitivity.trackHistory);
    this.dispatcher = new AlertDispatcher(config.alerts, config.onDrift);
  }

  /** For test injection — replace the contract instance. */
  _setContract(contract: RegistryContract): void {
    this.contract = contract;
  }

  /** Expose the history tracker for test inspection. */
  _getHistory(): AgentHistoryTracker {
    return this.history;
  }

  async start(): Promise<void> {
    this.running = true;

    this.eventListener = (...args: unknown[]) => {
      void this.handleEvent(args);
    };

    this.contract.on('SnapshotCommitted', this.eventListener);

    if (this.sensitivity.staleChainHours > 0) {
      this.staleCheckInterval = setInterval(
        () => void this.checkStaleChains(),
        this.sensitivity.staleChainHours * 3600 * 1000,
      );
    }
  }

  async stop(): Promise<void> {
    this.running = false;

    if (this.eventListener) {
      this.contract.off('SnapshotCommitted', this.eventListener);
      this.eventListener = null;
    }

    if (this.staleCheckInterval) {
      clearInterval(this.staleCheckInterval);
      this.staleCheckInterval = null;
    }

    await this.dispatcher.stop();
  }

  /**
   * Process a single SnapshotCommitted event. Exposed for direct invocation
   * in tests without needing a real event subscription.
   */
  async processEvent(event: SnapshotCommittedEvent): Promise<DriftAlert | null> {
    const agentId = event.agentId.toString();
    this.trackedAgents.add(agentId);

    const currentSignals = await this.fetchAgentSignals(agentId);

    const driftSignals = detectDriftSignals(
      agentId,
      currentSignals,
      this.history,
      this.sensitivity,
    );

    const severity = classifySeverity(driftSignals, this.sensitivity);

    let alert: DriftAlert = {
      agentId,
      chainId: this.chainId,
      snapshotIndex: Number(event.snapshotIndex),
      previousSnapshotHash: event.previousHash,
      currentSnapshotHash: event.snapshotHash,
      driftSignals,
      severity,
      timestamp: Date.now(),
    };

    alert = await enrichWithAgentKit(alert, this.agentKit);

    this.history.push(agentId, currentSignals);

    this.alerts.push(alert);

    await this.dispatcher.dispatch(alert);

    return alert;
  }

  private async handleEvent(args: unknown[]): Promise<void> {
    try {
      const [agentId, snapshotIndex, snapshotHash, previousHash, timestamp, encryptedDataUri] =
        args as [bigint, bigint, string, string, bigint, string];

      const log = args[args.length - 1] as { blockNumber?: number; transactionHash?: string } | undefined;

      const event: SnapshotCommittedEvent = {
        agentId,
        snapshotIndex,
        snapshotHash,
        previousHash,
        timestamp,
        encryptedDataUri,
        blockNumber: log?.blockNumber ?? 0,
        transactionHash: log?.transactionHash ?? '',
      };

      await this.processEvent(event);
    } catch (err) {
      console.error('[DriftEngine] Error processing event:', err);
    }
  }

  private async fetchAgentSignals(agentId: string): Promise<AgentSignals> {
    try {
      const profile = await this.valiron.getAgentProfile(agentId);
      return {
        score: profile.localReputation?.score ?? 0,
        tier: profile.localReputation?.tier ?? 'unknown',
        riskLevel: profile.localReputation?.riskLevel ?? 'unknown',
        route: profile.routing.finalRoute,
        onchainReputationCount: profile.onchainReputation.count,
        onchainReputationAvg: profile.onchainReputation.averageScore,
        timestamp: Date.now(),
      };
    } catch {
      return {
        score: 0,
        tier: 'unknown',
        riskLevel: 'unknown',
        route: 'unknown',
        onchainReputationCount: 0,
        onchainReputationAvg: 0,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Polling check for stale chains — agents that haven't produced a commit
   * within the configured staleChainHours window.
   */
  private async checkStaleChains(): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const threshold = this.sensitivity.staleChainHours * 3600;

    for (const agentId of this.trackedAgents) {
      try {
        const lastCommit = await this.contract.getLastCommitTimestamp(BigInt(agentId));
        const elapsed = now - Number(lastCommit);

        if (Number(lastCommit) > 0 && elapsed > threshold) {
          const alert: DriftAlert = {
            agentId,
            chainId: this.chainId,
            snapshotIndex: -1,
            previousSnapshotHash: '',
            currentSnapshotHash: '',
            driftSignals: [
              {
                dimension: 'stale_chain',
                previous: Number(lastCommit),
                current: now,
                description: `No commits for ${Math.floor(elapsed / 3600)} hours (threshold: ${this.sensitivity.staleChainHours}h)`,
              },
            ],
            severity: 'medium',
            timestamp: Date.now(),
          };

          this.alerts.push(alert);
          await this.dispatcher.dispatch(alert);
        }
      } catch {
        // skip agents we can't query
      }
    }
  }
}
