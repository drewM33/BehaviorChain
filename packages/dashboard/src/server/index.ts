import 'dotenv/config';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';
import { serve } from '@hono/node-server';
import {
  getAgent,
  getAllAlerts,
  getLeaderboard,
  getStats,
  verifyChain,
  generateLiveAlert,
  AGENTS,
} from './mock-data.js';
import {
  getOnChainChain,
  getOnChainHead,
  verifyOnChainChain,
  getOnChainProfile,
} from './on-chain.js';

function isLiveAgent(agentId: number): boolean {
  return agentId > 0;
}

export const app = new Hono();

app.use('*', cors());

// -------------------------------------------------------------------------
// GET /api/agents/:agentId/chain — full snapshot chain
// -------------------------------------------------------------------------
app.get('/api/agents/:agentId/chain', async (c) => {
  const agentId = Number(c.req.param('agentId'));

  if (isLiveAgent(agentId)) {
    try {
      const data = await getOnChainChain(agentId);
      return c.json(data);
    } catch (e: any) {
      return c.json({ error: `On-chain query failed: ${e.message}` }, 502);
    }
  }

  const agent = getAgent(agentId);
  if (!agent) return c.json({ error: 'Agent not found' }, 404);

  return c.json({
    agentId: agent.agentId,
    chain: agent.chain,
    chainLength: agent.chainLength,
  });
});

// -------------------------------------------------------------------------
// GET /api/agents/:agentId/chain/head — current head hash + count
// -------------------------------------------------------------------------
app.get('/api/agents/:agentId/chain/head', async (c) => {
  const agentId = Number(c.req.param('agentId'));

  if (isLiveAgent(agentId)) {
    try {
      const data = await getOnChainHead(agentId);
      return c.json(data);
    } catch (e: any) {
      return c.json({ error: `On-chain query failed: ${e.message}` }, 502);
    }
  }

  const agent = getAgent(agentId);
  if (!agent) return c.json({ error: 'Agent not found' }, 404);

  const head = agent.chain[agent.chain.length - 1];
  return c.json({
    agentId: agent.agentId,
    headHash: head?.snapshotHash ?? null,
    snapshotCount: agent.chainLength,
    lastCommitTimestamp: head?.timestamp ?? null,
  });
});

// -------------------------------------------------------------------------
// GET /api/agents/:agentId/chain/verify — verify chain integrity
// -------------------------------------------------------------------------
app.get('/api/agents/:agentId/chain/verify', async (c) => {
  const agentId = Number(c.req.param('agentId'));

  if (isLiveAgent(agentId)) {
    try {
      const data = await verifyOnChainChain(agentId);
      return c.json(data);
    } catch (e: any) {
      return c.json({ error: `On-chain query failed: ${e.message}` }, 502);
    }
  }

  const agent = getAgent(agentId);
  if (!agent) return c.json({ error: 'Agent not found' }, 404);

  const result = verifyChain(agent.chain);
  return c.json({
    agentId: agent.agentId,
    valid: result.valid,
    chainLength: agent.chainLength,
    ...(result.brokenAt !== undefined && { brokenAt: result.brokenAt }),
  });
});

// -------------------------------------------------------------------------
// GET /api/agents/:agentId/drift — drift alert history
// -------------------------------------------------------------------------
app.get('/api/agents/:agentId/drift', (c) => {
  const agentId = Number(c.req.param('agentId'));
  const agent = getAgent(agentId);

  if (!agent) {
    return c.json({ agentId, alerts: [], totalAlerts: 0 });
  }

  return c.json({
    agentId: agent.agentId,
    alerts: agent.driftAlerts.sort((a, b) => b.timestamp - a.timestamp),
    totalAlerts: agent.driftAlerts.length,
  });
});

// -------------------------------------------------------------------------
// GET /api/agents/:agentId/profile — combined chain + Valiron trust profile
// -------------------------------------------------------------------------
app.get('/api/agents/:agentId/profile', async (c) => {
  const agentId = Number(c.req.param('agentId'));

  if (isLiveAgent(agentId)) {
    try {
      const data = await getOnChainProfile(agentId);
      return c.json(data);
    } catch (e: any) {
      return c.json({ error: `On-chain query failed: ${e.message}` }, 502);
    }
  }

  const agent = getAgent(agentId);
  if (!agent) return c.json({ error: 'Agent not found' }, 404);

  const head = agent.chain[agent.chain.length - 1];
  const verifyResult = verifyChain(agent.chain);

  return c.json({
    agentId: agent.agentId,
    name: agent.name,
    chain: {
      length: agent.chainLength,
      headHash: head?.snapshotHash ?? null,
      intact: verifyResult.valid,
      firstChange: agent.firstChangeDate,
      lastChange: agent.lastChangeDate,
      lastChangeDescription: agent.lastChangeDescription,
      nodes: agent.chain,
    },
    trust: {
      score: agent.score,
      tier: agent.tier,
      riskLevel: agent.riskLevel,
      route: agent.route,
    },
    drift: {
      flagCount: agent.driftFlagCount,
      highestSeverity: agent.highestSeverity,
      alerts: agent.driftAlerts.sort((a, b) => b.timestamp - a.timestamp),
    },
    delegation: agent.delegation,
    cleanLaps: agent.cleanLaps,
  });
});

// -------------------------------------------------------------------------
// GET /api/agents/:agentId/delegation — AgentKit delegation info
// -------------------------------------------------------------------------
app.get('/api/agents/:agentId/delegation', (c) => {
  const agentId = Number(c.req.param('agentId'));

  const agent = getAgent(agentId);
  if (agent?.delegation) {
    return c.json({
      agentId: agent.agentId,
      delegated: true,
      humanNullifierHash: agent.delegation.humanNullifierHash,
      delegationTimestamp: agent.delegation.delegationTimestamp,
    });
  }

  return c.json({ agentId, delegated: false });
});

// -------------------------------------------------------------------------
// GET /api/stats — aggregate stats
// -------------------------------------------------------------------------
app.get('/api/stats', (c) => {
  return c.json(getStats());
});

// -------------------------------------------------------------------------
// GET /api/leaderboard — agents ranked by stability
// -------------------------------------------------------------------------
app.get('/api/leaderboard', (c) => {
  const ranked = getLeaderboard();
  return c.json({
    leaderboard: ranked.map((agent, i) => {
      const days = Math.max(1, (Date.now() - agent.firstChangeDate) / 86_400_000);
      return {
        position: i + 1,
        agentId: agent.agentId,
        name: agent.name,
        cleanLaps: agent.cleanLaps,
        chainLength: agent.chainLength,
        changesPerMonth: Number((agent.chainLength / days * 30).toFixed(2)),
        tier: agent.tier,
        riskLevel: agent.riskLevel,
        driftFlags: agent.driftFlagCount,
        score: agent.score,
      };
    }),
  });
});

// -------------------------------------------------------------------------
// GET /api/events — SSE stream for real-time drift alerts
// -------------------------------------------------------------------------
app.get('/api/events', (c) => {
  return streamSSE(c, async (stream) => {
    let id = 0;
    while (true) {
      const alert = generateLiveAlert();
      await stream.writeSSE({
        data: JSON.stringify(alert),
        event: 'drift',
        id: String(id++),
      });
      await stream.sleep(3000 + Math.random() * 4000);
    }
  });
});

// -------------------------------------------------------------------------
// Start server
// -------------------------------------------------------------------------
const PORT = Number(process.env.BEHAVIORCHAIN_DASHBOARD_PORT ?? 3001);

if (process.env.NODE_ENV !== 'test') {
  serve({ fetch: app.fetch, port: PORT }, (info) => {
    console.log(`[BehaviorChain API] listening on http://localhost:${info.port}`);
  });
}
