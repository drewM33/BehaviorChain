import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { ZERO_BYTES32 } from '@behaviorchain/sdk';
import type { CommitResult, SnapshotEvent } from '@behaviorchain/sdk';
import type { SnapshotCommittedEvent } from '@behaviorchain/drift';
import type {
  BehaviorChainPipelineConfig,
  IBehaviorChainSDK,
  IDriftEngine,
  IValironSDK,
  BehaviorChainTrustSignal,
  PipelineStats,
  RetryEntry,
} from './types.js';
import type { IAgentKitProvider } from '@behaviorchain/drift';
import {
  AGENTKIT,
  parseAgentkitHeader,
  validateAgentkitMessage,
  verifyAgentkitSignature,
  createAgentBookVerifier,
} from '@worldcoin/agentkit';

export class BehaviorChainPipeline {
  private valiron: IValironSDK;
  private sdk: IBehaviorChainSDK;
  private driftEngine: IDriftEngine | undefined;
  private agentKit: IAgentKitProvider | undefined;
  private webhookSecret: string | undefined;
  private agentIds: string[];
  private retryIntervalMs: number;
  private maxRetries: number;
  private webhookPort: number;
  private chainId: number;

  private retryQueue: RetryEntry[] = [];
  private retryTimer: ReturnType<typeof setInterval> | null = null;
  private server: ReturnType<typeof serve> | null = null;
  private running = false;

  private onCommit: BehaviorChainPipelineConfig['onCommit'];
  private onSkip: BehaviorChainPipelineConfig['onSkip'];
  private onError: BehaviorChainPipelineConfig['onError'];

  readonly app: Hono;

  readonly stats: PipelineStats = {
    webhooksReceived: 0,
    commitsAttempted: 0,
    commitsMade: 0,
    commitsSkipped: 0,
    commitsFailed: 0,
    retriesProcessed: 0,
    recoveredGaps: 0,
  };

  constructor(config: BehaviorChainPipelineConfig) {
    this.valiron = config.valiron;
    this.sdk = config.behaviorchain;
    this.driftEngine = config.driftEngine;
    this.agentKit = config.agentKit;
    this.webhookSecret = config.webhookSecret;
    this.agentIds = config.agentIds ?? [];
    this.retryIntervalMs = config.retryIntervalMs ?? 10_000;
    this.maxRetries = config.maxRetries ?? 5;
    this.webhookPort = config.webhookPort ?? 3002;
    this.chainId = config.chainId ?? Number(process.env.BEHAVIORCHAIN_CHAIN_ID ?? '84532');

    this.onCommit = config.onCommit;
    this.onSkip = config.onSkip;
    this.onError = config.onError;

    this.app = this.buildApp();
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  async start(): Promise<void> {
    this.running = true;

    this.retryTimer = setInterval(
      () => void this.processRetryQueue(),
      this.retryIntervalMs,
    );

    if (this.agentIds.length > 0) {
      await this.recover(this.agentIds);
    }
  }

  startServer(): void {
    this.server = serve({ fetch: this.app.fetch, port: this.webhookPort });
  }

  async stop(): Promise<void> {
    this.running = false;

    if (this.retryTimer) {
      clearInterval(this.retryTimer);
      this.retryTimer = null;
    }

    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  /**
   * Simulate registering a webhook with Valiron's operator API.
   * In production this would POST to /operator/webhooks/register.
   */
  async registerWebhook(url: string): Promise<void> {
    // In production: POST to Valiron's webhook registration endpoint.
    // For now, log the registration intent.
    void url;
  }

  // -----------------------------------------------------------------------
  // Core: process a single evaluation event
  // -----------------------------------------------------------------------

  async processEvaluation(agentId: string, humanNullifierHash?: string): Promise<CommitResult> {
    this.stats.commitsAttempted++;

    try {
      const result = await this.sdk.commitIfChanged(agentId);

      if (result.committed) {
        this.stats.commitsMade++;
        this.onCommit?.(agentId, result);

        if (this.driftEngine) {
          const count = await this.sdk.getSnapshotCount(agentId);
          const event: SnapshotCommittedEvent = {
            agentId: BigInt(agentId),
            snapshotIndex: BigInt(count - 1),
            snapshotHash: result.snapshotHash,
            previousHash: result.previousHash ?? ZERO_BYTES32,
            timestamp: BigInt(Math.floor(Date.now() / 1000)),
            encryptedDataUri: '',
            blockNumber: 0,
            transactionHash: '',
          };
          const alert = await this.driftEngine.processEvent(event);
          if (alert && humanNullifierHash) {
            alert.humanNullifierHash = humanNullifierHash;
          }
        }
      } else {
        this.stats.commitsSkipped++;
        this.onSkip?.(agentId);
      }

      return result;
    } catch (err: unknown) {
      this.stats.commitsFailed++;
      const error = err instanceof Error ? err : new Error(String(err));
      this.onError?.(agentId, error);

      this.enqueueRetry(agentId);

      return { committed: false, snapshotHash: '' };
    }
  }

  // -----------------------------------------------------------------------
  // Recovery: detect and fill gaps between Valiron state and on-chain head
  // -----------------------------------------------------------------------

  async recover(agentIds: string[]): Promise<number> {
    let recovered = 0;

    for (const agentId of agentIds) {
      try {
        const snapshot = await this.valiron.getAgentSnapshot(agentId);
        const chainHead = await this.sdk.getChainHead(agentId);

        if (snapshot.snapshotHash.toLowerCase() !== chainHead.toLowerCase()) {
          const result = await this.sdk.commitIfChanged(agentId);
          if (result.committed) {
            recovered++;
            this.stats.recoveredGaps++;
            this.stats.commitsMade++;

            if (this.driftEngine) {
              const count = await this.sdk.getSnapshotCount(agentId);
              const event: SnapshotCommittedEvent = {
                agentId: BigInt(agentId),
                snapshotIndex: BigInt(count - 1),
                snapshotHash: result.snapshotHash,
                previousHash: result.previousHash ?? ZERO_BYTES32,
                timestamp: BigInt(Math.floor(Date.now() / 1000)),
                encryptedDataUri: '',
                blockNumber: 0,
                transactionHash: '',
              };
              await this.driftEngine.processEvent(event);
            }
          }
        }
      } catch {
        // Agent unavailable — skip, will be retried on next cycle
      }
    }

    return recovered;
  }

  // -----------------------------------------------------------------------
  // Trust signal computation
  // -----------------------------------------------------------------------

  async getTrustSignal(agentId: string): Promise<BehaviorChainTrustSignal> {
    const [verification, snapshotCount, events] = await Promise.all([
      this.sdk.verifyChain(agentId),
      this.sdk.getSnapshotCount(agentId),
      this.sdk.getSnapshotEvents(agentId),
    ]);

    const lastEvent = events[events.length - 1];
    const lastCommitAge = lastEvent
      ? Math.floor((Date.now() - Number(lastEvent.timestamp) * 1000) / 1000)
      : 0;

    const agentAlerts = this.driftEngine?.alerts.filter(
      (a) => a.agentId === agentId,
    ) ?? [];

    const driftFlags = agentAlerts.length;
    const recentCriticalDrift = agentAlerts.some(
      (a) =>
        (a.severity === 'critical' || a.severity === 'high') &&
        Date.now() - a.timestamp < 86_400_000,
    );

    let humanDelegated = false;
    if (this.agentKit) {
      try {
        const delegation = await this.agentKit.getDelegation(agentId);
        humanDelegated = delegation !== null;
      } catch {
        // AgentKit unavailable — default to false
      }
    }

    let integrityScore = 100;
    if (!verification.valid) integrityScore -= 40;
    if (recentCriticalDrift) integrityScore -= 20;
    integrityScore -= Math.min(30, driftFlags * 3);
    if (humanDelegated) integrityScore = Math.min(100, integrityScore + 5);
    integrityScore = Math.max(0, integrityScore);

    return {
      agentId,
      chainLength: snapshotCount,
      lastCommitAge,
      driftFlags,
      recentCriticalDrift,
      chainIntact: verification.valid,
      integrityScore,
      humanDelegated,
    };
  }

  // -----------------------------------------------------------------------
  // Retry queue
  // -----------------------------------------------------------------------

  private enqueueRetry(agentId: string): void {
    const existing = this.retryQueue.find((e) => e.agentId === agentId);
    if (existing) {
      existing.attempts++;
      existing.lastAttempt = Date.now();
      existing.nextAttempt = Date.now() + this.backoff(existing.attempts);
      return;
    }

    this.retryQueue.push({
      agentId,
      attempts: 1,
      lastAttempt: Date.now(),
      nextAttempt: Date.now() + this.backoff(1),
    });
  }

  private backoff(attempts: number): number {
    return Math.min(60_000, 2_000 * Math.pow(2, attempts - 1));
  }

  async processRetryQueue(): Promise<void> {
    const now = Date.now();
    const ready = this.retryQueue.filter((e) => e.nextAttempt <= now);

    for (const entry of ready) {
      this.stats.retriesProcessed++;
      try {
        const result = await this.sdk.commitIfChanged(entry.agentId);
        if (result.committed) {
          this.stats.commitsMade++;
          this.onCommit?.(entry.agentId, result);
        } else {
          this.stats.commitsSkipped++;
        }
        this.retryQueue = this.retryQueue.filter((e) => e !== entry);
      } catch {
        entry.attempts++;
        entry.lastAttempt = now;
        entry.nextAttempt = now + this.backoff(entry.attempts);

        if (entry.attempts > this.maxRetries) {
          this.retryQueue = this.retryQueue.filter((e) => e !== entry);
        }
      }
    }
  }

  getRetryQueue(): RetryEntry[] {
    return [...this.retryQueue];
  }

  // -----------------------------------------------------------------------
  // HTTP server (webhook receiver + trust signal endpoint)
  // -----------------------------------------------------------------------

  private buildApp(): Hono {
    const app = new Hono();

    // POST /hooks/valiron — Valiron webhook receiver
    app.post('/hooks/valiron', async (c) => {
      this.stats.webhooksReceived++;

      if (this.webhookSecret) {
        const sig = c.req.header('x-valiron-signature');
        if (sig !== this.webhookSecret) {
          return c.json({ error: 'Invalid signature' }, 401);
        }
      }

      const body = await c.req.json<{ event?: string; agentId?: string | number }>();

      if (body.event !== 'evaluation_complete' || !body.agentId) {
        return c.json({ error: 'Invalid payload' }, 400);
      }

      let humanNullifierHash: string | undefined;
      const agentkitHeader = c.req.header(AGENTKIT);
      if (agentkitHeader) {
        try {
          const parsed = parseAgentkitHeader(agentkitHeader);
          await validateAgentkitMessage(parsed, c.req.url);
          await verifyAgentkitSignature(parsed);
          const agentBook = createAgentBookVerifier({
            network: this.chainId === 8453 ? 'base' : 'base-sepolia',
          });
          const human = await agentBook.lookupHuman(parsed.address, parsed.chainId);
          if (human) {
            humanNullifierHash = human.nullifierHash;
          }
        } catch {
          // AgentKit verification failed — proceed without human attribution
        }
      }

      const agentId = String(body.agentId);
      const result = await this.processEvaluation(agentId, humanNullifierHash);

      return c.json({
        ok: true,
        agentId,
        committed: result.committed,
        snapshotHash: result.snapshotHash,
      });
    });

    // GET /api/agents/:agentId/trust-signal
    app.get('/api/agents/:agentId/trust-signal', async (c) => {
      const agentId = c.req.param('agentId');
      try {
        const signal = await this.getTrustSignal(agentId);
        return c.json(signal);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return c.json({ error: msg }, 500);
      }
    });

    return app;
  }
}
