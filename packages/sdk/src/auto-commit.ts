import http from 'node:http';
import type { BehaviorChainSDK } from './sdk.js';
import type { AutoCommitOptions } from './types.js';

export function createAutoCommitServer(
  sdk: BehaviorChainSDK,
  agentId: string,
  options: AutoCommitOptions,
): { server: http.Server; close: () => Promise<void> } {
  const server = http.createServer((req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'listening', agentId }));
      return;
    }

    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });

    req.on('end', () => {
      void (async () => {
        try {
          const payload = JSON.parse(body) as Record<string, unknown>;

          if (payload.event !== 'evaluation_complete' && !payload.agentId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unknown event' }));
            return;
          }

          const result = await sdk.commitIfChanged(agentId);

          if (result.committed) {
            options.onCommit?.(result);
          } else {
            options.onSkip?.({ snapshotHash: result.snapshotHash });
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({ ok: true, committed: result.committed }),
          );
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: message }));
        }
      })();
    });
  });

  server.listen(options.webhookPort);

  return {
    server,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}
