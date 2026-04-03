import { describe, it, expect, beforeAll } from 'vitest';
import { app } from '../src/server/index.js';
import type { DriftAlert } from '@behaviorchain/drift';

/**
 * Phase 4 Milestone Tests
 *
 * Covers ALL 8 milestone goals from the spec:
 *  1. Chain API returns full hash chain
 *  2. Verify endpoint detects tampered chains
 *  3. Drift history returned
 *  4. Profile page renders (API provides data for rendering)
 *  5. Drift feed within 5 seconds (SSE endpoint streams)
 *  6. Badge renders accurately (API provides correct badge data)
 *  7. Leaderboard ranks by stability
 *  8. Human delegator shown when available
 */

const ZERO_HASH =
  '0x0000000000000000000000000000000000000000000000000000000000000000';

async function get(path: string) {
  const res = await app.request(path);
  return { status: res.status, body: await res.json() as Record<string, unknown> };
}

// ---------------------------------------------------------------------------
// Milestone 1: Chain API returns full hash chain
// ---------------------------------------------------------------------------
describe('Milestone 1: Chain API returns full hash chain', () => {
  it('GET /api/agents/42/chain returns full chain with correct structure', async () => {
    const { status, body } = await get('/api/agents/42/chain');
    expect(status).toBe(200);
    expect(body.agentId).toBe(42);
    expect(body.chainLength).toBe(3);

    const chain = body.chain as Array<{
      index: number;
      snapshotHash: string;
      previousHash: string;
      timestamp: number;
      description: string;
    }>;
    expect(chain).toHaveLength(3);

    // Genesis has ZERO previousHash
    expect(chain[0].previousHash).toBe(ZERO_HASH);
    expect(chain[0].index).toBe(0);

    // Each node links to the previous node's hash
    for (let i = 1; i < chain.length; i++) {
      expect(chain[i].previousHash).toBe(chain[i - 1].snapshotHash);
    }

    // Hashes are 0x-prefixed
    chain.forEach((node) => {
      expect(node.snapshotHash).toMatch(/^0x[a-f0-9]{64}$/);
    });
  });

  it('GET /api/agents/42/chain/head returns correct head and count', async () => {
    const { status, body } = await get('/api/agents/42/chain/head');
    expect(status).toBe(200);
    expect(body.snapshotCount).toBe(3);
    expect(body.headHash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(body.lastCommitTimestamp).toBeTypeOf('number');
  });

  it('returns 404 for unknown agent', async () => {
    const { status } = await get('/api/agents/999/chain');
    expect(status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Milestone 2: Verify endpoint detects tampered chains
// ---------------------------------------------------------------------------
describe('Milestone 2: Verify endpoint detects tampered chains', () => {
  it('GET /api/agents/42/chain/verify returns valid for intact chain', async () => {
    const { status, body } = await get('/api/agents/42/chain/verify');
    expect(status).toBe(200);
    expect(body.valid).toBe(true);
    expect(body.chainLength).toBe(3);
    expect(body).not.toHaveProperty('brokenAt');
  });

  it('GET /api/agents/99/chain/verify detects tampered chain', async () => {
    const { status, body } = await get('/api/agents/99/chain/verify');
    expect(status).toBe(200);
    expect(body.valid).toBe(false);
    expect(body.brokenAt).toBe(2);
  });

  it('verifies all other agents have intact chains', async () => {
    for (const id of [43, 44, 45, 46, 47]) {
      const { body } = await get(`/api/agents/${id}/chain/verify`);
      expect(body.valid).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Milestone 3: Drift history returned
// ---------------------------------------------------------------------------
describe('Milestone 3: Drift history returned', () => {
  it('GET /api/agents/45/drift returns drift alerts', async () => {
    const { status, body } = await get('/api/agents/45/drift');
    expect(status).toBe(200);
    expect(body.agentId).toBe(45);
    expect(body.totalAlerts).toBeGreaterThan(0);

    const alerts = body.alerts as DriftAlert[];
    expect(alerts.length).toBeGreaterThan(0);

    // Should contain critical alerts (supply chain attack patterns)
    const criticals = alerts.filter((a) => a.severity === 'critical');
    expect(criticals.length).toBeGreaterThanOrEqual(3);

    // Alerts should reference real attack patterns
    const descriptions = alerts.flatMap((a) =>
      a.driftSignals.map((s) => s.description),
    );
    expect(descriptions.some((d) => d.includes('plain-crypto-js'))).toBe(true);
    expect(descriptions.some((d) => d.includes('AWS_SECRET_ACCESS_KEY'))).toBe(true);
    expect(descriptions.some((d) => d.includes('sh -c curl'))).toBe(true);
  });

  it('stable agent has zero drift alerts', async () => {
    const { body } = await get('/api/agents/42/drift');
    expect(body.totalAlerts).toBe(0);
    expect(body.alerts).toHaveLength(0);
  });

  it('alerts are sorted reverse-chronologically', async () => {
    const { body } = await get('/api/agents/45/drift');
    const alerts = body.alerts as DriftAlert[];
    for (let i = 1; i < alerts.length; i++) {
      expect(alerts[i - 1].timestamp).toBeGreaterThanOrEqual(alerts[i].timestamp);
    }
  });
});

// ---------------------------------------------------------------------------
// Milestone 4: Profile page renders (API provides all required data)
// ---------------------------------------------------------------------------
describe('Milestone 4: Profile page data complete for rendering', () => {
  it('GET /api/agents/42/profile contains all fields needed for telemetry page', async () => {
    const { status, body } = await get('/api/agents/42/profile');
    expect(status).toBe(200);

    // Agent identity
    expect(body.agentId).toBe(42);
    expect(body.name).toBeTypeOf('string');

    // Chain data for metric cards
    const chain = body.chain as Record<string, unknown>;
    expect(chain.length).toBe(3);
    expect(chain.headHash).toMatch(/^0x/);
    expect(chain.intact).toBe(true);
    expect(chain.lastChangeDescription).toBeTypeOf('string');
    expect(chain.nodes).toBeInstanceOf(Array);

    // Trust profile for Valiron overlay
    const trust = body.trust as Record<string, unknown>;
    expect(trust.score).toBeTypeOf('number');
    expect(trust.tier).toBeTypeOf('string');
    expect(trust.riskLevel).toBeTypeOf('string');
    expect(trust.route).toBeTypeOf('string');

    // Drift data
    const drift = body.drift as Record<string, unknown>;
    expect(drift.flagCount).toBeTypeOf('number');
    expect(drift.highestSeverity).toBeTypeOf('string');
    expect(drift.alerts).toBeInstanceOf(Array);

    // Clean laps
    expect(body.cleanLaps).toBeTypeOf('number');
  });

  it('profile for volatile agent (44) shows warnings', async () => {
    const { body } = await get('/api/agents/44/profile');
    const trust = body.trust as Record<string, unknown>;
    expect(trust.riskLevel).toBe('YELLOW');
    expect(trust.route).toBe('prod_throttled');

    const drift = body.drift as Record<string, unknown>;
    expect(drift.flagCount).toBeGreaterThan(0);
  });

  it('profile for compromised agent (45) shows critical status', async () => {
    const { body } = await get('/api/agents/45/profile');
    const trust = body.trust as Record<string, unknown>;
    expect(trust.riskLevel).toBe('RED');
    expect(trust.route).toBe('sandbox_only');
    expect(trust.tier).toBe('C');
    expect(trust.score).toBeLessThan(25);
  });
});

// ---------------------------------------------------------------------------
// Milestone 5: Drift feed within 5 seconds (SSE endpoint)
// ---------------------------------------------------------------------------
describe('Milestone 5: Drift feed delivers via SSE', () => {
  it('GET /api/events returns SSE stream with drift events', async () => {
    const res = await app.request('/api/events');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    // Read the first chunk from the stream
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    const startTime = Date.now();
    let receivedData = '';
    let eventReceived = false;

    // Read until we get a complete SSE event or 5s timeout
    while (Date.now() - startTime < 5000) {
      const { done, value } = await reader.read();
      if (done) break;

      receivedData += decoder.decode(value, { stream: true });

      if (receivedData.includes('event: drift') && receivedData.includes('data: ')) {
        eventReceived = true;
        break;
      }
    }

    reader.cancel();

    expect(eventReceived).toBe(true);
    expect(Date.now() - startTime).toBeLessThan(5000);

    // Parse the event data
    const dataMatch = receivedData.match(/data: (.+)/);
    expect(dataMatch).not.toBeNull();
    const alert = JSON.parse(dataMatch![1]) as DriftAlert;
    expect(alert.agentId).toBeTypeOf('string');
    expect(alert.severity).toBeTypeOf('string');
    expect(alert.driftSignals).toBeInstanceOf(Array);
  });
});

// ---------------------------------------------------------------------------
// Milestone 6: Badge renders accurately
// ---------------------------------------------------------------------------
describe('Milestone 6: Badge renders accurate data', () => {
  it('profile provides correct data for badge rendering', async () => {
    const { body } = await get('/api/agents/42/profile');
    const chain = body.chain as Record<string, unknown>;
    const drift = body.drift as Record<string, unknown>;

    // Badge should show: "N changes in M days — X drift flags"
    expect(chain.length).toBe(3);
    expect(chain.firstChange).toBeTypeOf('number');
    expect(drift.flagCount).toBe(0);

    const days = Math.round(
      (Date.now() - (chain.firstChange as number)) / 86_400_000,
    );
    expect(days).toBeGreaterThan(0);
  });

  it('agent 45 badge data reflects high drift count', async () => {
    const { body } = await get('/api/agents/45/profile');
    const drift = body.drift as Record<string, unknown>;
    expect(drift.flagCount).toBeGreaterThanOrEqual(8);
  });
});

// ---------------------------------------------------------------------------
// Milestone 7: Leaderboard ranks by stability
// ---------------------------------------------------------------------------
describe('Milestone 7: Leaderboard ranks by stability', () => {
  it('GET /api/leaderboard returns agents sorted by stability', async () => {
    const { status, body } = await get('/api/leaderboard');
    expect(status).toBe(200);

    const leaderboard = body.leaderboard as Array<{
      position: number;
      agentId: number;
      cleanLaps: number;
      chainLength: number;
      changesPerMonth: number;
      tier: string;
      driftFlags: number;
    }>;

    expect(leaderboard.length).toBeGreaterThanOrEqual(5);

    // Positions are sequential
    leaderboard.forEach((entry, i) => {
      expect(entry.position).toBe(i + 1);
    });

    // Sorted by changes/month ascending (fewest changes = most stable = rank 1)
    for (let i = 1; i < leaderboard.length; i++) {
      expect(leaderboard[i].changesPerMonth).toBeGreaterThanOrEqual(
        leaderboard[i - 1].changesPerMonth,
      );
    }

    // Agent 47 (2 changes in 365 days) should rank higher than agent 45 (22 in 14 days)
    const rank47 = leaderboard.find((e) => e.agentId === 47)!.position;
    const rank45 = leaderboard.find((e) => e.agentId === 45)!.position;
    expect(rank47).toBeLessThan(rank45);

    // All required columns present
    leaderboard.forEach((entry) => {
      expect(entry.agentId).toBeTypeOf('number');
      expect(entry.cleanLaps).toBeTypeOf('number');
      expect(entry.chainLength).toBeTypeOf('number');
      expect(entry.changesPerMonth).toBeTypeOf('number');
      expect(entry.tier).toBeTypeOf('string');
      expect(entry.driftFlags).toBeTypeOf('number');
    });
  });

  it('excludes tampered test agent from leaderboard', async () => {
    const { body } = await get('/api/leaderboard');
    const leaderboard = body.leaderboard as Array<{ agentId: number }>;
    expect(leaderboard.find((e) => e.agentId === 99)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Milestone 8: Human delegator shown when available
// ---------------------------------------------------------------------------
describe('Milestone 8: Human delegator shown when available', () => {
  it('GET /api/agents/47/delegation returns World ID delegation', async () => {
    const { status, body } = await get('/api/agents/47/delegation');
    expect(status).toBe(200);
    expect(body.delegated).toBe(true);
    expect(body.humanNullifierHash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(body.delegationTimestamp).toBeTypeOf('number');
  });

  it('profile for delegated agent includes delegation data', async () => {
    const { body } = await get('/api/agents/47/profile');
    const delegation = body.delegation as Record<string, unknown>;
    expect(delegation).not.toBeNull();
    expect(delegation.humanNullifierHash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(delegation.delegationTimestamp).toBeTypeOf('number');
  });

  it('non-delegated agent returns delegated: false', async () => {
    const { body } = await get('/api/agents/42/delegation');
    expect(body.delegated).toBe(false);
    expect(body).not.toHaveProperty('humanNullifierHash');
  });

  it('drift alerts for agent 45 do not include delegation (no World ID)', async () => {
    const { body } = await get('/api/agents/45/drift');
    const alerts = body.alerts as DriftAlert[];
    alerts.forEach((alert) => {
      expect(alert.humanNullifierHash).toBeUndefined();
    });
  });
});

// ---------------------------------------------------------------------------
// Aggregate stats endpoint
// ---------------------------------------------------------------------------
describe('Stats endpoint', () => {
  it('GET /api/stats returns aggregate metrics', async () => {
    const { status, body } = await get('/api/stats');
    expect(status).toBe(200);
    expect(body.totalAgents).toBeGreaterThanOrEqual(5);
    expect(body.totalBehavioralChanges).toBeGreaterThan(0);
    expect(body.industryAvgDetectionDays).toBe(267);
    expect(body.behaviorChainDetectionSeconds).toBe(5);
  });
});
