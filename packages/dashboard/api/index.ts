import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';

import {
  getAgent,
  getLeaderboard,
  getStats,
  verifyChain,
  generateLiveAlert,
} from '../src/server/mock-data.js';
import {
  getOnChainChain,
  getOnChainHead,
  verifyOnChainChain,
  getOnChainProfile,
} from '../src/server/on-chain.js';
import { signRequest } from '@worldcoin/idkit/signing';

function isLiveAgent(agentId: number): boolean {
  return agentId > 0;
}

const app = new Hono().basePath('/api');
app.use('*', cors());

const DEFAULT_GATE_ACTION = 'register-behaviorchain-agent';

app.post('/world-id/rp-signature', async (c) => {
  const signingKey = process.env.WORLDCOIN_RP_SIGNING_KEY ?? process.env.RP_SIGNING_KEY;
  if (!signingKey?.trim()) {
    return c.json({ error: 'World ID RP signing key not configured on the server.' }, 503);
  }

  let action = DEFAULT_GATE_ACTION;
  try {
    const body = await c.req.json<{ action?: string }>();
    if (typeof body?.action === 'string' && body.action.trim()) {
      action = body.action.trim();
    }
  } catch {}

  try {
    const { sig, nonce, createdAt, expiresAt } = signRequest(action, signingKey, 300);
    return c.json({ sig, nonce, created_at: createdAt, expires_at: expiresAt });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'RP signing failed';
    return c.json({ error: message }, 500);
  }
});

app.post('/world-id/verify', async (c) => {
  const rpId = process.env.WORLDCOIN_RP_ID?.trim();
  if (!rpId) {
    return c.json({ error: 'WORLDCOIN_RP_ID is not set on the server.' }, 503);
  }

  let idkitResponse: unknown;
  try {
    const body = await c.req.json<{ idkitResponse?: unknown }>();
    idkitResponse = body?.idkitResponse;
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (idkitResponse === undefined || idkitResponse === null) {
    return c.json({ error: 'Missing idkitResponse' }, 400);
  }

  const response = await fetch(`https://developer.world.org/api/v4/verify/${rpId}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(idkitResponse),
  });

  if (!response.ok) {
    const text = await response.text();
    return c.json({ error: text || `World verify failed (${response.status})` }, 502);
  }

  return c.json(await response.json());
});

app.get('/stats', (c) => c.json(getStats()));

app.get('/leaderboard', (c) => {
  const ranked = getLeaderboard();
  return c.json({
    leaderboard: ranked.map((agent, i) => {
      const days = Math.max(1, (Date.now() - agent.firstChangeDate) / 86_400_000);
      return {
        position: i + 1, agentId: agent.agentId, name: agent.name,
        cleanLaps: agent.cleanLaps, chainLength: agent.chainLength,
        changesPerMonth: Number(((agent.chainLength / days) * 30).toFixed(2)),
        tier: agent.tier, riskLevel: agent.riskLevel,
        driftFlags: agent.driftFlagCount, score: agent.score,
      };
    }),
  });
});

app.get('/agents/:agentId/chain', async (c) => {
  const agentId = Number(c.req.param('agentId'));
  if (isLiveAgent(agentId)) {
    try { return c.json(await getOnChainChain(agentId)); }
    catch (e: any) { return c.json({ error: `On-chain query failed: ${e.message}` }, 502); }
  }
  const agent = getAgent(agentId);
  if (!agent) return c.json({ error: 'Agent not found' }, 404);
  return c.json({ agentId: agent.agentId, chain: agent.chain, chainLength: agent.chainLength });
});

app.get('/agents/:agentId/chain/head', async (c) => {
  const agentId = Number(c.req.param('agentId'));
  if (isLiveAgent(agentId)) {
    try { return c.json(await getOnChainHead(agentId)); }
    catch (e: any) { return c.json({ error: `On-chain query failed: ${e.message}` }, 502); }
  }
  const agent = getAgent(agentId);
  if (!agent) return c.json({ error: 'Agent not found' }, 404);
  const head = agent.chain[agent.chain.length - 1];
  return c.json({ agentId: agent.agentId, headHash: head?.snapshotHash ?? null, snapshotCount: agent.chainLength, lastCommitTimestamp: head?.timestamp ?? null });
});

app.get('/agents/:agentId/chain/verify', async (c) => {
  const agentId = Number(c.req.param('agentId'));
  if (isLiveAgent(agentId)) {
    try { return c.json(await verifyOnChainChain(agentId)); }
    catch (e: any) { return c.json({ error: `On-chain query failed: ${e.message}` }, 502); }
  }
  const agent = getAgent(agentId);
  if (!agent) return c.json({ error: 'Agent not found' }, 404);
  const result = verifyChain(agent.chain);
  return c.json({ agentId: agent.agentId, valid: result.valid, chainLength: agent.chainLength, ...(result.brokenAt !== undefined && { brokenAt: result.brokenAt }) });
});

app.get('/agents/:agentId/drift', (c) => {
  const agentId = Number(c.req.param('agentId'));
  const agent = getAgent(agentId);
  if (!agent) return c.json({ agentId, alerts: [], totalAlerts: 0 });
  return c.json({ agentId: agent.agentId, alerts: agent.driftAlerts.sort((a, b) => b.timestamp - a.timestamp), totalAlerts: agent.driftAlerts.length });
});

app.get('/agents/:agentId/profile', async (c) => {
  const agentId = Number(c.req.param('agentId'));
  if (isLiveAgent(agentId)) {
    try { return c.json(await getOnChainProfile(agentId)); }
    catch (e: any) { return c.json({ error: `On-chain query failed: ${e.message}` }, 502); }
  }
  const agent = getAgent(agentId);
  if (!agent) return c.json({ error: 'Agent not found' }, 404);
  const head = agent.chain[agent.chain.length - 1];
  const verifyResult = verifyChain(agent.chain);
  return c.json({
    agentId: agent.agentId, name: agent.name,
    chain: { length: agent.chainLength, headHash: head?.snapshotHash ?? null, intact: verifyResult.valid, firstChange: agent.firstChangeDate, lastChange: agent.lastChangeDate, lastChangeDescription: agent.lastChangeDescription, nodes: agent.chain },
    trust: { score: agent.score, tier: agent.tier, riskLevel: agent.riskLevel, route: agent.route },
    drift: { flagCount: agent.driftFlagCount, highestSeverity: agent.highestSeverity, alerts: agent.driftAlerts.sort((a, b) => b.timestamp - a.timestamp) },
    delegation: agent.delegation, cleanLaps: agent.cleanLaps,
  });
});

app.get('/agents/:agentId/delegation', (c) => {
  const agentId = Number(c.req.param('agentId'));
  const agent = getAgent(agentId);
  if (agent?.delegation) return c.json({ agentId: agent.agentId, delegated: true, humanNullifierHash: agent.delegation.humanNullifierHash, delegationTimestamp: agent.delegation.delegationTimestamp });
  return c.json({ agentId, delegated: false });
});

app.get('/events', (c) => {
  return streamSSE(c, async (stream) => {
    let id = 0;
    while (true) {
      const alert = generateLiveAlert();
      await stream.writeSSE({ data: JSON.stringify(alert), event: 'drift', id: String(id++) });
      await stream.sleep(3000 + Math.random() * 4000);
    }
  });
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = new URL(req.url!, `https://${req.headers.host}`);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
  }

  const webReq = new Request(url.toString(), {
    method: req.method,
    headers,
    body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
  });

  const webRes = await app.fetch(webReq);

  res.status(webRes.status);
  webRes.headers.forEach((value, key) => res.setHeader(key, value));
  const body = await webRes.text();
  res.send(body);
}
