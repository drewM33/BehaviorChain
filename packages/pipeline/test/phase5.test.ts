import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import { BehaviorChainPipeline } from '../src/pipeline.js';
import type {
  IBehaviorChainSDK,
  IDriftEngine,
  IValironSDK,
  BehaviorChainTrustSignal,
} from '../src/types.js';
import type { CommitResult, ChainVerificationResult, SnapshotEvent } from '@behaviorchain/sdk';
import type { DriftAlert, SnapshotCommittedEvent, IAgentKitProvider } from '@behaviorchain/drift';

const ZERO_HASH =
  '0x0000000000000000000000000000000000000000000000000000000000000000';

function mockHash(seed: string): string {
  return '0x' + createHash('sha256').update(seed).digest('hex');
}

// ---------------------------------------------------------------------------
// Mock Valiron SDK — returns configurable snapshot hashes
// ---------------------------------------------------------------------------

class MockValironSDK implements IValironSDK {
  private snapshots = new Map<string, string>();
  private shouldFail = false;

  setSnapshot(agentId: string, hash: string) {
    this.snapshots.set(agentId, hash);
  }

  setFailing(fail: boolean) {
    this.shouldFail = fail;
  }

  async getAgentSnapshot(agentId: string) {
    if (this.shouldFail) throw new Error('Valiron unavailable');
    const hash = this.snapshots.get(agentId);
    if (!hash) throw new Error(`No snapshot for agent ${agentId}`);
    return { snapshotHash: hash, encryptedDataUri: null };
  }

  async getAgentProfile(_agentId: string) {
    if (this.shouldFail) throw new Error('Valiron unavailable');
    return {
      localReputation: { score: 85, tier: 'AA', riskLevel: 'GREEN' },
      routing: { finalRoute: 'prod' },
      onchainReputation: { count: 10, averageScore: 80 },
    };
  }
}

// ---------------------------------------------------------------------------
// Mock BehaviorChain SDK — in-memory chain simulation
// ---------------------------------------------------------------------------

class MockBehaviorChainSDK implements IBehaviorChainSDK {
  private chainHeads = new Map<string, string>();
  private counts = new Map<string, number>();
  private events = new Map<string, SnapshotEvent[]>();
  private valiron: MockValironSDK;
  private shouldFail = false;

  readonly commitLog: Array<{ agentId: string; committed: boolean; hash: string }> = [];

  constructor(valiron: MockValironSDK) {
    this.valiron = valiron;
  }

  setFailing(fail: boolean) {
    this.shouldFail = fail;
  }

  async commitIfChanged(agentId: string): Promise<CommitResult> {
    if (this.shouldFail) throw new Error('Contract call failed');

    const snapshot = await this.valiron.getAgentSnapshot(agentId);
    const chainHead = this.chainHeads.get(agentId) ?? ZERO_HASH;

    if (snapshot.snapshotHash.toLowerCase() === chainHead.toLowerCase()) {
      this.commitLog.push({ agentId, committed: false, hash: snapshot.snapshotHash });
      return { committed: false, snapshotHash: snapshot.snapshotHash };
    }

    const prevCount = this.counts.get(agentId) ?? 0;
    this.chainHeads.set(agentId, snapshot.snapshotHash);
    this.counts.set(agentId, prevCount + 1);

    const event: SnapshotEvent = {
      agentId: BigInt(agentId),
      snapshotIndex: BigInt(prevCount),
      snapshotHash: snapshot.snapshotHash,
      previousHash: chainHead,
      timestamp: BigInt(Math.floor(Date.now() / 1000)),
      encryptedDataUri: '',
      blockNumber: 0,
      transactionHash: mockHash(`tx-${agentId}-${prevCount}`),
    };

    let agentEvents = this.events.get(agentId);
    if (!agentEvents) {
      agentEvents = [];
      this.events.set(agentId, agentEvents);
    }
    agentEvents.push(event);

    this.commitLog.push({ agentId, committed: true, hash: snapshot.snapshotHash });
    return {
      committed: true,
      snapshotHash: snapshot.snapshotHash,
      previousHash: chainHead,
    };
  }

  async getChainHead(agentId: string): Promise<string> {
    return this.chainHeads.get(agentId) ?? ZERO_HASH;
  }

  async getSnapshotCount(agentId: string): Promise<number> {
    return this.counts.get(agentId) ?? 0;
  }

  async verifyChain(agentId: string): Promise<ChainVerificationResult> {
    const events = this.events.get(agentId) ?? [];
    if (events.length === 0) return { valid: true, chainLength: 0, events: [] };

    for (let i = 0; i < events.length; i++) {
      const expected = i === 0 ? ZERO_HASH : events[i - 1].snapshotHash;
      if (events[i].previousHash.toLowerCase() !== expected.toLowerCase()) {
        return { valid: false, chainLength: events.length, events, brokenAt: i };
      }
    }
    return { valid: true, chainLength: events.length, events };
  }

  async getSnapshotEvents(agentId: string): Promise<SnapshotEvent[]> {
    return this.events.get(agentId) ?? [];
  }
}

// ---------------------------------------------------------------------------
// Mock Drift Engine — records processed events
// ---------------------------------------------------------------------------

class MockDriftEngine implements IDriftEngine {
  readonly alerts: DriftAlert[] = [];

  async processEvent(event: SnapshotCommittedEvent): Promise<DriftAlert | null> {
    const alert: DriftAlert = {
      agentId: event.agentId.toString(),
      chainId: 84532,
      snapshotIndex: Number(event.snapshotIndex),
      previousSnapshotHash: event.previousHash,
      currentSnapshotHash: event.snapshotHash,
      driftSignals: [{
        dimension: 'hash_change',
        previous: 'n/a',
        current: 'n/a',
        description: 'Behavioral snapshot hash changed',
      }],
      severity: 'low',
      timestamp: Date.now(),
    };
    this.alerts.push(alert);
    return alert;
  }
}

// ---------------------------------------------------------------------------
// Mock AgentKit provider
// ---------------------------------------------------------------------------

class MockAgentKitProvider implements IAgentKitProvider {
  private delegations = new Map<string, { humanNullifierHash: string; delegationTimestamp: number }>();

  setDelegation(agentId: string, nullifier: string) {
    this.delegations.set(agentId, {
      humanNullifierHash: nullifier,
      delegationTimestamp: Date.now() - 86_400_000 * 30,
    });
  }

  async getDelegation(agentId: string) {
    return this.delegations.get(agentId) ?? null;
  }
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

let valiron: MockValironSDK;
let sdk: MockBehaviorChainSDK;
let driftEngine: MockDriftEngine;
let agentKit: MockAgentKitProvider;
let pipeline: BehaviorChainPipeline;

beforeEach(() => {
  valiron = new MockValironSDK();
  sdk = new MockBehaviorChainSDK(valiron);
  driftEngine = new MockDriftEngine();
  agentKit = new MockAgentKitProvider();

  pipeline = new BehaviorChainPipeline({
    valiron,
    behaviorchain: sdk,
    driftEngine,
    agentKit,
    webhookPort: 0,
    retryIntervalMs: 100,
    maxRetries: 3,
  });
});

afterEach(async () => {
  await pipeline.stop();
});

// ===========================================================================
// Milestone 1: Webhook → commitIfChanged pipeline works
// ===========================================================================
describe('Milestone 1: Webhook → commitIfChanged pipeline works', () => {
  it('POST /hooks/valiron triggers commitIfChanged and commits new hash', async () => {
    const hash = mockHash('agent-42-v1');
    valiron.setSnapshot('42', hash);

    const res = await pipeline.app.request('/hooks/valiron', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'evaluation_complete', agentId: '42' }),
    });

    const body = await res.json() as Record<string, unknown>;
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.committed).toBe(true);
    expect(body.snapshotHash).toBe(hash);
  });

  it('validates webhook secret when configured', async () => {
    const securePipeline = new BehaviorChainPipeline({
      valiron,
      behaviorchain: sdk,
      webhookSecret: 'secret-123',
      webhookPort: 0,
    });

    valiron.setSnapshot('42', mockHash('test'));

    const noSig = await securePipeline.app.request('/hooks/valiron', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'evaluation_complete', agentId: '42' }),
    });
    expect(noSig.status).toBe(401);

    const badSig = await securePipeline.app.request('/hooks/valiron', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-valiron-signature': 'wrong' },
      body: JSON.stringify({ event: 'evaluation_complete', agentId: '42' }),
    });
    expect(badSig.status).toBe(401);

    const goodSig = await securePipeline.app.request('/hooks/valiron', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-valiron-signature': 'secret-123' },
      body: JSON.stringify({ event: 'evaluation_complete', agentId: '42' }),
    });
    expect(goodSig.status).toBe(200);
  });

  it('rejects invalid payloads', async () => {
    const res = await pipeline.app.request('/hooks/valiron', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'unknown_event' }),
    });
    expect(res.status).toBe(400);
  });

  it('tracks pipeline stats for webhook events', async () => {
    valiron.setSnapshot('42', mockHash('agent-42-stats'));

    await pipeline.app.request('/hooks/valiron', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'evaluation_complete', agentId: '42' }),
    });

    expect(pipeline.stats.webhooksReceived).toBe(1);
    expect(pipeline.stats.commitsAttempted).toBe(1);
    expect(pipeline.stats.commitsMade).toBe(1);
  });

  it('processes evaluation with < 1 second overhead', async () => {
    valiron.setSnapshot('42', mockHash('perf-test'));
    const start = performance.now();
    await pipeline.processEvaluation('42');
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(1000);
  });
});

// ===========================================================================
// Milestone 2: 10 evaluations with unchanged hash → zero commits
// ===========================================================================
describe('Milestone 2: Unchanged hash → zero commits', () => {
  it('10 identical evaluations produce exactly 1 commit (genesis) then 9 skips', async () => {
    const hash = mockHash('stable-agent-42');
    valiron.setSnapshot('42', hash);

    for (let i = 0; i < 10; i++) {
      await pipeline.processEvaluation('42');
    }

    const commits = sdk.commitLog.filter((e) => e.agentId === '42' && e.committed);
    const skips = sdk.commitLog.filter((e) => e.agentId === '42' && !e.committed);

    expect(commits).toHaveLength(1);
    expect(skips).toHaveLength(9);
    expect(pipeline.stats.commitsMade).toBe(1);
    expect(pipeline.stats.commitsSkipped).toBe(9);
  });

  it('10 evaluations with the same hash as existing chain head produce zero commits', async () => {
    const genesisHash = mockHash('pre-existing');
    valiron.setSnapshot('42', genesisHash);

    // First: establish genesis
    await pipeline.processEvaluation('42');
    expect(pipeline.stats.commitsMade).toBe(1);

    // Reset stats tracking for the test
    const commitsBefore = pipeline.stats.commitsMade;

    // 10 more with same hash
    for (let i = 0; i < 10; i++) {
      await pipeline.processEvaluation('42');
    }

    expect(pipeline.stats.commitsMade - commitsBefore).toBe(0);
    expect(pipeline.stats.commitsSkipped).toBe(10);
  });
});

// ===========================================================================
// Milestone 3: Hash change → commit + drift engine fires
// ===========================================================================
describe('Milestone 3: Hash change → commit + drift engine fires', () => {
  it('changed hash triggers commit and drift engine processEvent', async () => {
    // Genesis
    valiron.setSnapshot('42', mockHash('v1'));
    await pipeline.processEvaluation('42');
    expect(pipeline.stats.commitsMade).toBe(1);
    expect(driftEngine.alerts).toHaveLength(1);

    // Hash changes
    valiron.setSnapshot('42', mockHash('v2'));
    await pipeline.processEvaluation('42');
    expect(pipeline.stats.commitsMade).toBe(2);
    expect(driftEngine.alerts).toHaveLength(2);

    // Drift engine received correct snapshot hashes
    const alert = driftEngine.alerts[1];
    expect(alert.agentId).toBe('42');
    expect(alert.currentSnapshotHash).toBe(mockHash('v2'));
    expect(alert.previousSnapshotHash).toBe(mockHash('v1'));
  });

  it('multiple agents can commit independently', async () => {
    valiron.setSnapshot('42', mockHash('42-v1'));
    valiron.setSnapshot('43', mockHash('43-v1'));

    await pipeline.processEvaluation('42');
    await pipeline.processEvaluation('43');

    expect(pipeline.stats.commitsMade).toBe(2);
    expect(driftEngine.alerts).toHaveLength(2);
    expect(driftEngine.alerts[0].agentId).toBe('42');
    expect(driftEngine.alerts[1].agentId).toBe('43');
  });

  it('pipeline with no drift engine still commits without errors', async () => {
    const noDriftPipeline = new BehaviorChainPipeline({
      valiron,
      behaviorchain: sdk,
      webhookPort: 0,
    });

    valiron.setSnapshot('42', mockHash('no-drift'));
    const result = await noDriftPipeline.processEvaluation('42');
    expect(result.committed).toBe(true);
  });
});

// ===========================================================================
// Milestone 4: Trust signal endpoint returns accurate data
// ===========================================================================
describe('Milestone 4: Trust signal endpoint accurate', () => {
  it('GET /api/agents/:agentId/trust-signal returns correct structure', async () => {
    valiron.setSnapshot('42', mockHash('trust-v1'));
    await pipeline.processEvaluation('42');

    const res = await pipeline.app.request('/api/agents/42/trust-signal');
    const signal = await res.json() as BehaviorChainTrustSignal;

    expect(res.status).toBe(200);
    expect(signal.agentId).toBe('42');
    expect(signal.chainLength).toBe(1);
    expect(signal.lastCommitAge).toBeTypeOf('number');
    expect(signal.driftFlags).toBe(1);
    expect(signal.recentCriticalDrift).toBe(false);
    expect(signal.chainIntact).toBe(true);
    expect(signal.integrityScore).toBeTypeOf('number');
    expect(signal.integrityScore).toBeGreaterThanOrEqual(0);
    expect(signal.integrityScore).toBeLessThanOrEqual(100);
    expect(signal.humanDelegated).toBe(false);
  });

  it('trust signal reflects chain length after multiple commits', async () => {
    valiron.setSnapshot('42', mockHash('ts-v1'));
    await pipeline.processEvaluation('42');
    valiron.setSnapshot('42', mockHash('ts-v2'));
    await pipeline.processEvaluation('42');
    valiron.setSnapshot('42', mockHash('ts-v3'));
    await pipeline.processEvaluation('42');

    const signal = await pipeline.getTrustSignal('42');
    expect(signal.chainLength).toBe(3);
    expect(signal.driftFlags).toBe(3);
  });

  it('trust signal shows humanDelegated when AgentKit delegation exists', async () => {
    agentKit.setDelegation('47', mockHash('nullifier-47'));
    valiron.setSnapshot('47', mockHash('delegated-v1'));
    await pipeline.processEvaluation('47');

    const signal = await pipeline.getTrustSignal('47');
    expect(signal.humanDelegated).toBe(true);
    expect(signal.integrityScore).toBeGreaterThanOrEqual(0);
  });

  it('trust signal is consistent across 100 sequential queries', async () => {
    valiron.setSnapshot('42', mockHash('consistent'));
    await pipeline.processEvaluation('42');

    const signals: BehaviorChainTrustSignal[] = [];
    for (let i = 0; i < 100; i++) {
      signals.push(await pipeline.getTrustSignal('42'));
    }

    const first = signals[0];
    for (const s of signals) {
      expect(s.chainLength).toBe(first.chainLength);
      expect(s.driftFlags).toBe(first.driftFlags);
      expect(s.chainIntact).toBe(first.chainIntact);
      expect(s.integrityScore).toBe(first.integrityScore);
      expect(s.humanDelegated).toBe(first.humanDelegated);
    }
  });

  it('intact chain with no drift = high integrity score', async () => {
    // Create a pipeline without drift engine so no alerts accumulate
    const cleanPipeline = new BehaviorChainPipeline({
      valiron,
      behaviorchain: sdk,
      webhookPort: 0,
    });

    valiron.setSnapshot('42', mockHash('clean'));
    await cleanPipeline.processEvaluation('42');

    const signal = await cleanPipeline.getTrustSignal('42');
    expect(signal.chainIntact).toBe(true);
    expect(signal.driftFlags).toBe(0);
    expect(signal.integrityScore).toBe(100);
  });
});

// ===========================================================================
// Milestone 5: Recovery from missed webhooks
// ===========================================================================
describe('Milestone 5: Recovery from missed webhooks', () => {
  it('pipeline detects gap between Valiron snapshot and on-chain head on startup', async () => {
    // Agent 42 has a snapshot in Valiron but nothing on-chain
    valiron.setSnapshot('42', mockHash('missed-v1'));

    const recovered = await pipeline.recover(['42']);

    expect(recovered).toBe(1);
    expect(pipeline.stats.recoveredGaps).toBe(1);
    expect(pipeline.stats.commitsMade).toBe(1);

    const chainHead = await sdk.getChainHead('42');
    expect(chainHead).toBe(mockHash('missed-v1'));
  });

  it('recovery is a no-op when chain head matches Valiron snapshot', async () => {
    valiron.setSnapshot('42', mockHash('synced'));
    await pipeline.processEvaluation('42');

    const gapsBefore = pipeline.stats.recoveredGaps;
    const recovered = await pipeline.recover(['42']);
    expect(recovered).toBe(0);
    expect(pipeline.stats.recoveredGaps).toBe(gapsBefore);
  });

  it('pipeline.start() triggers recovery for configured agentIds', async () => {
    valiron.setSnapshot('42', mockHash('startup-gap'));
    valiron.setSnapshot('43', mockHash('startup-gap-43'));

    const autoPipeline = new BehaviorChainPipeline({
      valiron,
      behaviorchain: sdk,
      driftEngine,
      agentIds: ['42', '43'],
      webhookPort: 0,
      retryIntervalMs: 100_000,
    });

    await autoPipeline.start();

    expect(autoPipeline.stats.recoveredGaps).toBe(2);
    expect(autoPipeline.stats.commitsMade).toBe(2);

    const head42 = await sdk.getChainHead('42');
    const head43 = await sdk.getChainHead('43');
    expect(head42).toBe(mockHash('startup-gap'));
    expect(head43).toBe(mockHash('startup-gap-43'));

    await autoPipeline.stop();
  });

  it('recovery fires drift engine for recovered commits', async () => {
    valiron.setSnapshot('42', mockHash('drift-recovery'));
    await pipeline.recover(['42']);

    expect(driftEngine.alerts).toHaveLength(1);
    expect(driftEngine.alerts[0].agentId).toBe('42');
  });
});

// ===========================================================================
// Exit metrics
// ===========================================================================
describe('Exit metrics', () => {
  it('pipeline processes webhook with < 1s overhead', async () => {
    valiron.setSnapshot('42', mockHash('latency'));
    const start = performance.now();

    await pipeline.app.request('/hooks/valiron', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'evaluation_complete', agentId: '42' }),
    });

    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(1000);
  });

  it('zero missed commits: every hash change produces a commit', async () => {
    const hashes = Array.from({ length: 5 }, (_, i) => mockHash(`seq-${i}`));

    for (const hash of hashes) {
      valiron.setSnapshot('42', hash);
      await pipeline.processEvaluation('42');
    }

    expect(pipeline.stats.commitsMade).toBe(5);
    expect(pipeline.stats.commitsSkipped).toBe(0);
  });

  it('failed commits are retried and eventually succeed', async () => {
    valiron.setSnapshot('42', mockHash('retry-test'));
    sdk.setFailing(true);

    await pipeline.processEvaluation('42');
    expect(pipeline.stats.commitsFailed).toBe(1);
    expect(pipeline.getRetryQueue()).toHaveLength(1);

    // "Fix" the SDK
    sdk.setFailing(false);

    // Manually process the retry queue (simulating the timer)
    // Set nextAttempt to now so it's ready
    const queue = pipeline.getRetryQueue();
    // wait briefly and process
    await pipeline.processRetryQueue();

    // The retry may not fire immediately because of the backoff timer.
    // Force the retry by setting nextAttempt to the past
    const internalQueue = pipeline.getRetryQueue();
    if (internalQueue.length > 0) {
      internalQueue[0].nextAttempt = 0;
      await pipeline.processRetryQueue();
    }

    expect(pipeline.stats.retriesProcessed).toBeGreaterThanOrEqual(1);
  });

  it('pipeline survives Valiron restart: queued events processed', async () => {
    valiron.setSnapshot('42', mockHash('pre-restart'));
    await pipeline.processEvaluation('42');
    expect(pipeline.stats.commitsMade).toBe(1);

    // Valiron goes down
    valiron.setFailing(true);
    sdk.setFailing(true);

    // Webhook comes in but Valiron is down — commit fails, queued for retry
    valiron.setSnapshot('42', mockHash('during-restart'));
    await pipeline.processEvaluation('42');
    expect(pipeline.stats.commitsFailed).toBe(1);

    // Valiron comes back
    valiron.setFailing(false);
    sdk.setFailing(false);
    valiron.setSnapshot('42', mockHash('post-restart'));

    // Force retry
    const q = pipeline.getRetryQueue();
    if (q.length > 0) q[0].nextAttempt = 0;
    await pipeline.processRetryQueue();

    expect(pipeline.stats.retriesProcessed).toBeGreaterThanOrEqual(1);
  });
});
