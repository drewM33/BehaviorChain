import type { Hono } from 'hono';
import { signRequest } from '@worldcoin/idkit/signing';

const DEFAULT_GATE_ACTION = 'register-behaviorchain-agent';

/**
 * World ID 4.0 requires a real RP signature from the backend (never `demo-signature` on the client).
 * @see https://docs.world.org/world-id/idkit/integrate
 */
export function registerWorldIdRoutes(app: Hono): void {
  app.post('/api/world-id/rp-signature', async (c) => {
    const signingKey = process.env.WORLDCOIN_RP_SIGNING_KEY ?? process.env.RP_SIGNING_KEY;
    if (!signingKey?.trim()) {
      return c.json(
        {
          error:
            'World ID RP signing key missing. Set WORLDCOIN_RP_SIGNING_KEY in the dashboard API .env (Developer Portal → signing key). Restart the API server after adding it.',
        },
        503,
      );
    }

    let action = DEFAULT_GATE_ACTION;
    try {
      const body = await c.req.json<{ action?: string }>();
      if (typeof body?.action === 'string' && body.action.trim()) {
        action = body.action.trim();
      }
    } catch {
      // empty body is OK
    }

    try {
      const { sig, nonce, createdAt, expiresAt } = signRequest(action, signingKey, 300);
      return c.json({
        sig,
        nonce,
        created_at: createdAt,
        expires_at: expiresAt,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'RP signing failed';
      return c.json({ error: message }, 500);
    }
  });

  app.post('/api/world-id/verify', async (c) => {
    const rpId = process.env.WORLDCOIN_RP_ID?.trim();
    if (!rpId) {
      return c.json(
        {
          error:
            'WORLDCOIN_RP_ID is not set on the API server. Add it from the Developer Portal (same as VITE_WORLDCOIN_RP_ID).',
        },
        503,
      );
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
      return c.json(
        { error: text || `World verify failed (${response.status})` },
        502,
      );
    }

    return c.json(await response.json());
  });
}
