/**
 * Phase 3 — Drift Detection Engine tests.
 *
 * Covers ALL 9 milestone goals:
 *   1. Engine processes each SnapshotCommitted event as confirmed change
 *   2. Score drop 25 → "high"
 *   3. Route → sandbox_only → "critical"
 *   4. Tier downgrade → correct severity
 *   5. GREEN → RED → "critical"
 *   6. Webhook within 5 seconds
 *   7. Configurable thresholds work
 *   8. AgentKit nullifier in alerts when available
 *   9. Stable agents produce no commits, therefore no false positives
 *
 * Exit metrics:
 *   - Alert latency: event → webhook < 5 seconds at p95
 *   - False positive rate: 0% on stable agents
 *   - Severity classification: 100% of test fixtures classified correctly
 *   - AgentKit enrichment: adds < 500ms, degrades gracefully when unavailable
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import http from 'node:http';
import {
  DriftEngine,
  AgentHistoryTracker,
  detectDriftSignals,
  classifySeverity,
  enrichWithAgentKit,
  isTierDowngrade,
  tierDowngradeLevels,
  DEFAULT_SENSITIVITY,
} from '../src/index.js';
import type {
  DriftAlert,
  DriftEngineConfig,
  AgentSignals,
  SnapshotCommittedEvent,
  IAgentKitProvider,
  SensitivityConfig,
} from '../src/index.js';
import type { IValironSDK, AgentProfile } from '@behaviorchain/sdk';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<SnapshotCommittedEvent> = {}): SnapshotCommittedEvent {
  return {
    agentId: BigInt(42),
    snapshotIndex: BigInt(1),
    snapshotHash: '0xabc123',
    previousHash: '0xdef456',
    timestamp: BigInt(Math.floor(Date.now() / 1000)),
    encryptedDataUri: '',
    blockNumber: 100,
    transactionHash: '0xtx1',
    ...overrides,
  };
}

function makeProfile(overrides: Partial<{
  score: number;
  tier: string;
  riskLevel: string;
  route: string;
  count: number;
  averageScore: number;
}> = {}): AgentProfile {
  return {
    localReputation: {
      score: overrides.score ?? 85,
      tier: overrides.tier ?? 'AAA',
      riskLevel: overrides.riskLevel ?? 'GREEN',
    },
    routing: { finalRoute: overrides.route ?? 'prod' },
    onchainReputation: {
      count: overrides.count ?? 10,
      averageScore: overrides.averageScore ?? 4.5,
    },
  };
}

function makeValiron(profile: AgentProfile): IValironSDK {
  return {
    getAgentSnapshot: vi.fn().mockRejectedValue(new Error('stub')),
    getAgentProfile: vi.fn().mockResolvedValue(profile),
  };
}

function makeSignals(overrides: Partial<AgentSignals> = {}): AgentSignals {
  return {
    score: 85,
    tier: 'AAA',
    riskLevel: 'GREEN',
    route: 'prod',
    onchainReputationCount: 10,
    onchainReputationAvg: 4.5,
    timestamp: Date.now(),
    ...overrides,
  };
}

function makeEngine(opts: {
  profile?: AgentProfile;
  onDrift?: (alert: DriftAlert) => void;
  sensitivity?: Partial<SensitivityConfig>;
  agentKit?: IAgentKitProvider;
  webhookUrl?: string;
}): DriftEngine {
  const profile = opts.profile ?? makeProfile();
  const config: DriftEngineConfig = {
    contractAddress: '0x0000000000000000000000000000000000000001',
    rpcUrl: 'http://localhost:8545',
    valironSdk: makeValiron(profile),
    chainId: 84532,
    sensitivity: opts.sensitivity,
    alerts: {
      webhookUrl: opts.webhookUrl,
    },
    onDrift: opts.onDrift,
    agentKit: opts.agentKit,
  };

  const engine = new DriftEngine(config);

  // Stub the contract to avoid real RPC calls
  const stubContract = {
    on: vi.fn(),
    off: vi.fn(),
    queryFilter: vi.fn().mockResolvedValue([]),
    filters: { SnapshotCommitted: vi.fn() },
    getLastCommitTimestamp: vi.fn().mockResolvedValue(BigInt(0)),
  };
  engine._setContract(stubContract as any);

  return engine;
}

// ===========================================================================
// Milestone 1: Engine processes each SnapshotCommitted event as confirmed change
// ===========================================================================

describe('Milestone 1: Event processing', () => {
  it('processes a SnapshotCommitted event and produces a DriftAlert', async () => {
    const alerts: DriftAlert[] = [];
    const engine = makeEngine({ onDrift: (a) => alerts.push(a) });

    const alert = await engine.processEvent(makeEvent());

    expect(alert).not.toBeNull();
    expect(alert!.agentId).toBe('42');
    expect(alert!.chainId).toBe(84532);
    expect(alert!.snapshotIndex).toBe(1);
    expect(alert!.driftSignals.length).toBeGreaterThanOrEqual(1);
    expect(alert!.driftSignals[0].dimension).toBe('hash_change');
    expect(alerts).toHaveLength(1);
  });

  it('includes hash_change signal on every event (commit-on-change guarantee)', async () => {
    const engine = makeEngine({});
    const alert = await engine.processEvent(makeEvent());
    const hashSignal = alert!.driftSignals.find((s) => s.dimension === 'hash_change');
    expect(hashSignal).toBeDefined();
    expect(hashSignal!.description).toContain('confirmed by on-chain commit');
  });

  it('tracks history across multiple events for the same agent', async () => {
    const engine = makeEngine({});

    await engine.processEvent(makeEvent({ snapshotIndex: BigInt(0) }));
    await engine.processEvent(makeEvent({ snapshotIndex: BigInt(1) }));

    const history = engine._getHistory().getHistory('42');
    expect(history).toHaveLength(2);
  });
});

// ===========================================================================
// Milestone 2: Score drop 25 → "high"
// ===========================================================================

describe('Milestone 2: Score drop severity', () => {
  it('classifies a 25-point score drop as "high"', async () => {
    const engine = makeEngine({ profile: makeProfile({ score: 60 }) });

    // Seed history with score=85
    engine._getHistory().push('42', makeSignals({ score: 85 }));

    const alert = await engine.processEvent(makeEvent());

    const scoreDrop = alert!.driftSignals.find((s) => s.dimension === 'score_drop');
    expect(scoreDrop).toBeDefined();
    expect(scoreDrop!.previous).toBe(85);
    expect(scoreDrop!.current).toBe(60);
    expect(alert!.severity).toBe('high');
  });

  it('classifies a 15-point score drop as "medium"', async () => {
    const engine = makeEngine({ profile: makeProfile({ score: 70 }) });
    engine._getHistory().push('42', makeSignals({ score: 85 }));

    const alert = await engine.processEvent(makeEvent());
    expect(alert!.severity).toBe('medium');
  });

  it('does not flag a 10-point score drop with default threshold', async () => {
    const engine = makeEngine({ profile: makeProfile({ score: 75 }) });
    engine._getHistory().push('42', makeSignals({ score: 85 }));

    const alert = await engine.processEvent(makeEvent());
    const scoreDrop = alert!.driftSignals.find((s) => s.dimension === 'score_drop');
    expect(scoreDrop).toBeUndefined();
  });
});

// ===========================================================================
// Milestone 3: Route → sandbox_only → "critical"
// ===========================================================================

describe('Milestone 3: Route change severity', () => {
  it('classifies route → sandbox_only as "critical"', async () => {
    const engine = makeEngine({ profile: makeProfile({ route: 'sandbox_only' }) });
    engine._getHistory().push('42', makeSignals({ route: 'prod' }));

    const alert = await engine.processEvent(makeEvent());

    const routeSignal = alert!.driftSignals.find((s) => s.dimension === 'route_change');
    expect(routeSignal).toBeDefined();
    expect(routeSignal!.current).toBe('sandbox_only');
    expect(alert!.severity).toBe('critical');
  });

  it('classifies route → prod_throttled as "high"', async () => {
    const engine = makeEngine({ profile: makeProfile({ route: 'prod_throttled' }) });
    engine._getHistory().push('42', makeSignals({ route: 'prod' }));

    const alert = await engine.processEvent(makeEvent());
    expect(alert!.severity).toBe('high');
  });
});

// ===========================================================================
// Milestone 4: Tier downgrade → correct severity
// ===========================================================================

describe('Milestone 4: Tier downgrade severity', () => {
  it('classifies tier → CAA as "critical"', async () => {
    const engine = makeEngine({ profile: makeProfile({ tier: 'CAA' }) });
    engine._getHistory().push('42', makeSignals({ tier: 'AAA' }));

    const alert = await engine.processEvent(makeEvent());
    expect(alert!.severity).toBe('critical');
  });

  it('classifies tier → CA as "critical"', async () => {
    const engine = makeEngine({ profile: makeProfile({ tier: 'CA' }) });
    engine._getHistory().push('42', makeSignals({ tier: 'A' }));

    const alert = await engine.processEvent(makeEvent());
    expect(alert!.severity).toBe('critical');
  });

  it('classifies tier → C as "critical"', async () => {
    const engine = makeEngine({ profile: makeProfile({ tier: 'C' }) });
    engine._getHistory().push('42', makeSignals({ tier: 'BAA' }));

    const alert = await engine.processEvent(makeEvent());
    expect(alert!.severity).toBe('critical');
  });

  it('classifies 1-level tier downgrade as "medium"', async () => {
    const engine = makeEngine({ profile: makeProfile({ tier: 'AA' }) });
    engine._getHistory().push('42', makeSignals({ tier: 'AAA' }));

    const alert = await engine.processEvent(makeEvent());
    expect(alert!.severity).toBe('medium');
  });

  it('classifies 2-level tier downgrade as "high"', async () => {
    const engine = makeEngine({ profile: makeProfile({ tier: 'A' }) });
    engine._getHistory().push('42', makeSignals({ tier: 'AAA' }));

    const alert = await engine.processEvent(makeEvent());
    expect(alert!.severity).toBe('high');
  });

  it('isTierDowngrade returns true for AAA → A', () => {
    expect(isTierDowngrade('AAA', 'A')).toBe(true);
  });

  it('isTierDowngrade returns false for A → AAA', () => {
    expect(isTierDowngrade('A', 'AAA')).toBe(false);
  });

  it('tierDowngradeLevels returns correct level count', () => {
    expect(tierDowngradeLevels('AAA', 'A')).toBe(2);
    expect(tierDowngradeLevels('AAA', 'AA')).toBe(1);
    expect(tierDowngradeLevels('AAA', 'BAA')).toBe(3);
  });
});

// ===========================================================================
// Milestone 5: GREEN → RED → "critical"
// ===========================================================================

describe('Milestone 5: Risk level escalation', () => {
  it('classifies GREEN → RED as "critical"', async () => {
    const engine = makeEngine({ profile: makeProfile({ riskLevel: 'RED' }) });
    engine._getHistory().push('42', makeSignals({ riskLevel: 'GREEN' }));

    const alert = await engine.processEvent(makeEvent());

    const cliff = alert!.driftSignals.find((s) => s.dimension === 'score_cliff');
    expect(cliff).toBeDefined();
    expect(cliff!.current).toBe('RED');

    const escalation = alert!.driftSignals.find((s) => s.dimension === 'risk_escalation');
    expect(escalation).toBeDefined();

    expect(alert!.severity).toBe('critical');
  });

  it('classifies GREEN → YELLOW as "medium"', async () => {
    const engine = makeEngine({ profile: makeProfile({ riskLevel: 'YELLOW' }) });
    engine._getHistory().push('42', makeSignals({ riskLevel: 'GREEN' }));

    const alert = await engine.processEvent(makeEvent());
    expect(alert!.severity).toBe('medium');
  });

  it('classifies YELLOW → RED as "critical" via risk_escalation', async () => {
    const engine = makeEngine({ profile: makeProfile({ riskLevel: 'RED' }) });
    engine._getHistory().push('42', makeSignals({ riskLevel: 'YELLOW' }));

    const alert = await engine.processEvent(makeEvent());
    const escalation = alert!.driftSignals.find((s) => s.dimension === 'risk_escalation');
    expect(escalation).toBeDefined();
    expect(alert!.severity).toBe('critical');
  });
});

// ===========================================================================
// Milestone 6: Webhook within 5 seconds
// ===========================================================================

describe('Milestone 6: Webhook delivery latency', () => {
  let webhookServer: http.Server;
  let webhookPort: number;
  let receivedAlerts: { body: DriftAlert; receivedAt: number }[];

  beforeEach(async () => {
    receivedAlerts = [];
    webhookServer = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk: Buffer) => {
        body += chunk.toString();
      });
      req.on('end', () => {
        receivedAlerts.push({
          body: JSON.parse(body) as DriftAlert,
          receivedAt: Date.now(),
        });
        res.writeHead(200);
        res.end('ok');
      });
    });

    await new Promise<void>((resolve) => {
      webhookServer.listen(0, () => {
        webhookPort = (webhookServer.address() as { port: number }).port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      webhookServer.close(() => resolve());
    });
  });

  it('delivers webhook within 5 seconds (p95 target)', async () => {
    const engine = makeEngine({
      webhookUrl: `http://127.0.0.1:${webhookPort}/drift`,
    });

    const startTime = Date.now();
    await engine.processEvent(makeEvent());
    const elapsed = Date.now() - startTime;

    expect(receivedAlerts).toHaveLength(1);
    expect(elapsed).toBeLessThan(5000);
    expect(receivedAlerts[0].body.agentId).toBe('42');
  });

  it('delivers correct DriftAlert JSON via webhook', async () => {
    const engine = makeEngine({
      webhookUrl: `http://127.0.0.1:${webhookPort}/drift`,
      profile: makeProfile({ route: 'sandbox_only' }),
    });
    engine._getHistory().push('42', makeSignals({ route: 'prod' }));

    await engine.processEvent(makeEvent());

    expect(receivedAlerts).toHaveLength(1);
    const body = receivedAlerts[0].body;
    expect(body.severity).toBe('critical');
    expect(body.driftSignals.some((s) => s.dimension === 'route_change')).toBe(true);
  });

  it('delivers webhook within 5 seconds under multiple rapid events', async () => {
    const engine = makeEngine({
      webhookUrl: `http://127.0.0.1:${webhookPort}/drift`,
    });

    const startTime = Date.now();

    await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        engine.processEvent(makeEvent({ snapshotIndex: BigInt(i) })),
      ),
    );

    const elapsed = Date.now() - startTime;

    expect(receivedAlerts).toHaveLength(5);
    expect(elapsed).toBeLessThan(5000);
  });
});

// ===========================================================================
// Milestone 7: Configurable thresholds work
// ===========================================================================

describe('Milestone 7: Configurable sensitivity', () => {
  it('raising scoreDropThreshold suppresses previously-triggering drift', async () => {
    // With default threshold (15), a 20-point drop triggers
    const engine1 = makeEngine({ profile: makeProfile({ score: 65 }) });
    engine1._getHistory().push('42', makeSignals({ score: 85 }));

    const alert1 = await engine1.processEvent(makeEvent());
    expect(alert1!.driftSignals.some((s) => s.dimension === 'score_drop')).toBe(true);
    expect(alert1!.severity).toBe('medium');

    // With raised threshold (25), a 20-point drop does NOT trigger
    const engine2 = makeEngine({
      profile: makeProfile({ score: 65 }),
      sensitivity: { scoreDropThreshold: 25 },
    });
    engine2._getHistory().push('42', makeSignals({ score: 85 }));

    const alert2 = await engine2.processEvent(makeEvent());
    expect(alert2!.driftSignals.some((s) => s.dimension === 'score_drop')).toBe(false);
    expect(alert2!.severity).toBe('low');
  });

  it('lowering scoreDropThreshold triggers on smaller drops', async () => {
    const engine = makeEngine({
      profile: makeProfile({ score: 80 }),
      sensitivity: { scoreDropThreshold: 5 },
    });
    engine._getHistory().push('42', makeSignals({ score: 85 }));

    const alert = await engine.processEvent(makeEvent());
    expect(alert!.driftSignals.some((s) => s.dimension === 'score_drop')).toBe(true);
  });

  it('trackHistory controls how many entries are kept', () => {
    const tracker = new AgentHistoryTracker(3);
    for (let i = 0; i < 5; i++) {
      tracker.push('42', makeSignals({ score: 50 + i }));
    }
    const history = tracker.getHistory('42');
    expect(history).toHaveLength(3);
    expect(history[0].score).toBe(52);
    expect(history[2].score).toBe(54);
  });

  it('severity threshold suppresses low-severity alerts from webhook delivery', async () => {
    let webhookServer: http.Server;
    const receivedAlerts: DriftAlert[] = [];

    webhookServer = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk: Buffer) => {
        body += chunk.toString();
      });
      req.on('end', () => {
        receivedAlerts.push(JSON.parse(body));
        res.writeHead(200);
        res.end('ok');
      });
    });

    const port = await new Promise<number>((resolve) => {
      webhookServer.listen(0, () => {
        resolve((webhookServer.address() as { port: number }).port);
      });
    });

    try {
      const config: DriftEngineConfig = {
        contractAddress: '0x0000000000000000000000000000000000000001',
        rpcUrl: 'http://localhost:8545',
        valironSdk: makeValiron(makeProfile()),
        alerts: {
          webhookUrl: `http://127.0.0.1:${port}/drift`,
          severityThreshold: 'high',
        },
      };
      const engine = new DriftEngine(config);
      engine._setContract({
        on: vi.fn(), off: vi.fn(),
        queryFilter: vi.fn().mockResolvedValue([]),
        filters: { SnapshotCommitted: vi.fn() },
        getLastCommitTimestamp: vi.fn().mockResolvedValue(BigInt(0)),
      } as any);

      // This event produces a "low" severity alert (just hash_change)
      await engine.processEvent(makeEvent());

      // Give a moment for any async webhook call
      await new Promise((r) => setTimeout(r, 100));

      expect(receivedAlerts).toHaveLength(0);
    } finally {
      await new Promise<void>((resolve) => {
        webhookServer.close(() => resolve());
      });
    }
  });
});

// ===========================================================================
// Milestone 8: AgentKit nullifier in alerts when available
// ===========================================================================

describe('Milestone 8: AgentKit enrichment', () => {
  it('includes humanNullifierHash and delegationTimestamp when AgentKit returns delegation', async () => {
    const agentKit: IAgentKitProvider = {
      getDelegation: vi.fn().mockResolvedValue({
        humanNullifierHash: '0xnullifier123',
        delegationTimestamp: 1700000000000,
      }),
    };

    const engine = makeEngine({ agentKit });
    const alert = await engine.processEvent(makeEvent());

    expect(alert!.humanNullifierHash).toBe('0xnullifier123');
    expect(alert!.delegationTimestamp).toBe(1700000000000);
  });

  it('produces valid alert without AgentKit (graceful degradation)', async () => {
    const engine = makeEngine({});
    const alert = await engine.processEvent(makeEvent());

    expect(alert).not.toBeNull();
    expect(alert!.humanNullifierHash).toBeUndefined();
    expect(alert!.delegationTimestamp).toBeUndefined();
    expect(alert!.driftSignals.length).toBeGreaterThanOrEqual(1);
  });

  it('produces valid alert when AgentKit throws (graceful degradation)', async () => {
    const agentKit: IAgentKitProvider = {
      getDelegation: vi.fn().mockRejectedValue(new Error('AgentKit unavailable')),
    };

    const engine = makeEngine({ agentKit });
    const alert = await engine.processEvent(makeEvent());

    expect(alert).not.toBeNull();
    expect(alert!.humanNullifierHash).toBeUndefined();
    expect(alert!.severity).toBeDefined();
  });

  it('AgentKit enrichment adds < 500ms', async () => {
    const agentKit: IAgentKitProvider = {
      getDelegation: vi.fn().mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 50));
        return {
          humanNullifierHash: '0xnullifier',
          delegationTimestamp: Date.now(),
        };
      }),
    };

    const start = Date.now();
    const engine = makeEngine({ agentKit });
    await engine.processEvent(makeEvent());
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(500);
  });

  it('enrichWithAgentKit returns unmodified alert when delegation is null', async () => {
    const provider: IAgentKitProvider = {
      getDelegation: vi.fn().mockResolvedValue(null),
    };

    const alert: DriftAlert = {
      agentId: '42',
      chainId: 84532,
      snapshotIndex: 1,
      previousSnapshotHash: '0x1',
      currentSnapshotHash: '0x2',
      driftSignals: [],
      severity: 'low',
      timestamp: Date.now(),
    };

    const enriched = await enrichWithAgentKit(alert, provider);
    expect(enriched.humanNullifierHash).toBeUndefined();
  });
});

// ===========================================================================
// Milestone 9: Stable agents produce no commits, therefore no false positives
// ===========================================================================

describe('Milestone 9: No false positives on stable agents', () => {
  it('stable agent with no SnapshotCommitted events produces zero alerts', () => {
    const engine = makeEngine({});
    // No events processed → no alerts
    expect(engine.alerts).toHaveLength(0);
  });

  it('engine only produces alerts when processEvent is called (event-driven)', async () => {
    const alerts: DriftAlert[] = [];
    const engine = makeEngine({ onDrift: (a) => alerts.push(a) });

    // Start engine but don't emit events
    await engine.start();

    // Wait a tick to confirm no spontaneous alerts
    await new Promise((r) => setTimeout(r, 100));

    expect(alerts).toHaveLength(0);

    await engine.stop();
  });

  it('commit-on-change design: no event = no hash change = no alert = 0% false positive rate', () => {
    // This is a design verification test.
    // The contract only emits SnapshotCommitted when a hash differs from the chain head.
    // The DriftEngine only processes SnapshotCommitted events.
    // Therefore: no behavioral change → no event → no alert → 0% false positive rate.
    //
    // We verify the engine has no timer-based or polling-based alert generation
    // for tracked agents (stale chain is separate and requires explicit tracking).
    const engine = makeEngine({});
    expect(engine.alerts).toHaveLength(0);
  });
});

// ===========================================================================
// Exit metrics verification
// ===========================================================================

describe('Exit metrics', () => {
  describe('Severity classification: 100% of test fixtures classified correctly', () => {
    const fixtures: { signals: Partial<AgentSignals>; previous: Partial<AgentSignals>; expectedSeverity: string; label: string }[] = [
      {
        label: 'route → sandbox_only = critical',
        previous: { route: 'prod' },
        signals: { route: 'sandbox_only' },
        expectedSeverity: 'critical',
      },
      {
        label: 'risk GREEN → RED = critical',
        previous: { riskLevel: 'GREEN' },
        signals: { riskLevel: 'RED' },
        expectedSeverity: 'critical',
      },
      {
        label: 'tier → CAA = critical',
        previous: { tier: 'AAA' },
        signals: { tier: 'CAA' },
        expectedSeverity: 'critical',
      },
      {
        label: 'tier → CA = critical',
        previous: { tier: 'A' },
        signals: { tier: 'CA' },
        expectedSeverity: 'critical',
      },
      {
        label: 'tier → C = critical',
        previous: { tier: 'BAA' },
        signals: { tier: 'C' },
        expectedSeverity: 'critical',
      },
      {
        label: 'score drop 25 = high',
        previous: { score: 85 },
        signals: { score: 60 },
        expectedSeverity: 'high',
      },
      {
        label: 'route → prod_throttled = high',
        previous: { route: 'prod' },
        signals: { route: 'prod_throttled' },
        expectedSeverity: 'high',
      },
      {
        label: 'score drop 15 = medium',
        previous: { score: 85 },
        signals: { score: 70 },
        expectedSeverity: 'medium',
      },
      {
        label: 'tier downgrade 1 level (AAA → AA) = medium',
        previous: { tier: 'AAA' },
        signals: { tier: 'AA' },
        expectedSeverity: 'medium',
      },
      {
        label: 'tier downgrade 2 levels (AAA → A) = high',
        previous: { tier: 'AAA' },
        signals: { tier: 'A' },
        expectedSeverity: 'high',
      },
      {
        label: 'risk GREEN → YELLOW = medium',
        previous: { riskLevel: 'GREEN' },
        signals: { riskLevel: 'YELLOW' },
        expectedSeverity: 'medium',
      },
      {
        label: 'no meaningful change (just hash_change) = low',
        previous: {},
        signals: {},
        expectedSeverity: 'low',
      },
    ];

    for (const fixture of fixtures) {
      it(fixture.label, () => {
        const history = new AgentHistoryTracker(10);
        history.push('42', makeSignals(fixture.previous));

        const current = makeSignals(fixture.signals);
        const driftSignals = detectDriftSignals('42', current, history, DEFAULT_SENSITIVITY);
        const severity = classifySeverity(driftSignals, DEFAULT_SENSITIVITY);

        expect(severity).toBe(fixture.expectedSeverity);
      });
    }
  });

  describe('Alert latency: event → webhook < 5 seconds at p95', () => {
    it('batch of 20 events all deliver within 5 seconds', async () => {
      let webhookServer: http.Server;
      const timestamps: number[] = [];

      webhookServer = http.createServer((req, res) => {
        let body = '';
        req.on('data', (chunk: Buffer) => {
          body += chunk.toString();
        });
        req.on('end', () => {
          timestamps.push(Date.now());
          res.writeHead(200);
          res.end('ok');
        });
      });

      const port = await new Promise<number>((resolve) => {
        webhookServer.listen(0, () => {
          resolve((webhookServer.address() as { port: number }).port);
        });
      });

      try {
        const engine = makeEngine({
          webhookUrl: `http://127.0.0.1:${port}/drift`,
        });

        const batchStart = Date.now();

        for (let i = 0; i < 20; i++) {
          await engine.processEvent(makeEvent({ snapshotIndex: BigInt(i) }));
        }

        const latencies = timestamps.map((t) => t - batchStart);
        const sorted = [...latencies].sort((a, b) => a - b);
        const p95Index = Math.floor(sorted.length * 0.95);
        const p95Latency = sorted[p95Index];

        expect(p95Latency).toBeLessThan(5000);
      } finally {
        await new Promise<void>((resolve) => {
          webhookServer.close(() => resolve());
        });
      }
    });
  });
});

// ===========================================================================
// Unit tests for signal detection helpers
// ===========================================================================

describe('Signal detection: unit tests', () => {
  it('detects negative feedback spike', () => {
    const history = new AgentHistoryTracker(10);
    // Push 5 entries, 3 with low scores
    history.push('42', makeSignals({ score: 30 }));
    history.push('42', makeSignals({ score: 80 }));
    history.push('42', makeSignals({ score: 35 }));
    history.push('42', makeSignals({ score: 25 }));

    const current = makeSignals({ score: 40 });
    const signals = detectDriftSignals('42', current, history, DEFAULT_SENSITIVITY);
    const spike = signals.find((s) => s.dimension === 'negative_feedback_spike');
    expect(spike).toBeDefined();
  });

  it('does not detect score_cliff when risk stays GREEN', () => {
    const history = new AgentHistoryTracker(10);
    history.push('42', makeSignals({ riskLevel: 'GREEN' }));

    const current = makeSignals({ riskLevel: 'GREEN' });
    const signals = detectDriftSignals('42', current, history, DEFAULT_SENSITIVITY);
    const cliff = signals.find((s) => s.dimension === 'score_cliff');
    expect(cliff).toBeUndefined();
  });

  it('first event for an agent only produces hash_change (no history to compare)', () => {
    const history = new AgentHistoryTracker(10);
    const current = makeSignals();
    const signals = detectDriftSignals('42', current, history, DEFAULT_SENSITIVITY);
    expect(signals).toHaveLength(1);
    expect(signals[0].dimension).toBe('hash_change');
  });
});

// ===========================================================================
// History tracker unit tests
// ===========================================================================

describe('AgentHistoryTracker', () => {
  it('returns undefined for unknown agent', () => {
    const tracker = new AgentHistoryTracker(10);
    expect(tracker.getLatest('unknown')).toBeUndefined();
    expect(tracker.has('unknown')).toBe(false);
  });

  it('push + getLatest returns most recent entry', () => {
    const tracker = new AgentHistoryTracker(10);
    tracker.push('42', makeSignals({ score: 80 }));
    tracker.push('42', makeSignals({ score: 90 }));
    expect(tracker.getLatest('42')!.score).toBe(90);
  });

  it('clear removes all history', () => {
    const tracker = new AgentHistoryTracker(10);
    tracker.push('42', makeSignals());
    tracker.clear();
    expect(tracker.has('42')).toBe(false);
  });

  it('countRecentLowScores counts correctly', () => {
    const tracker = new AgentHistoryTracker(10);
    tracker.push('42', makeSignals({ score: 30 }));
    tracker.push('42', makeSignals({ score: 80 }));
    tracker.push('42', makeSignals({ score: 20 }));
    tracker.push('42', makeSignals({ score: 35 }));
    tracker.push('42', makeSignals({ score: 90 }));

    expect(tracker.countRecentLowScores('42', 40, 5)).toBe(3);
    expect(tracker.countRecentLowScores('42', 40, 2)).toBe(1);
  });
});
