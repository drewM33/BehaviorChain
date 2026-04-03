import http from 'node:http';
import type { DriftAlert, AlertConfig, Severity } from './types.js';
import { SEVERITY_ORDER } from './types.js';

/**
 * Delivers a DriftAlert via all configured channels: webhook POST,
 * WebSocket broadcast, and callback invocation.
 */
export class AlertDispatcher {
  private webhookUrl: string | undefined;
  private severityThreshold: Severity;
  private onDrift: ((alert: DriftAlert) => void) | undefined;

  private wsClients = new Set<import('node:http').ServerResponse>();
  private wsServer: http.Server | null = null;

  constructor(
    config: AlertConfig | undefined,
    onDrift: ((alert: DriftAlert) => void) | undefined,
  ) {
    this.webhookUrl = config?.webhookUrl;
    this.severityThreshold = config?.severityThreshold ?? 'low';
    this.onDrift = onDrift;

    if (config?.websocketPort) {
      this.startWsServer(config.websocketPort);
    }
  }

  /**
   * Dispatches an alert if it meets the severity threshold.
   * Returns true if the alert was dispatched, false if suppressed.
   */
  async dispatch(alert: DriftAlert): Promise<boolean> {
    if (SEVERITY_ORDER[alert.severity] < SEVERITY_ORDER[this.severityThreshold]) {
      return false;
    }

    const promises: Promise<void>[] = [];

    if (this.webhookUrl) {
      promises.push(this.postWebhook(alert));
    }

    this.broadcastWs(alert);
    this.onDrift?.(alert);

    await Promise.allSettled(promises);
    return true;
  }

  private async postWebhook(alert: DriftAlert): Promise<void> {
    const body = JSON.stringify(alert);
    const url = new URL(this.webhookUrl!);

    return new Promise<void>((resolve, reject) => {
      const req = http.request(
        {
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: url.pathname + url.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
          timeout: 5000,
        },
        (res) => {
          res.resume();
          resolve();
        },
      );

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Webhook request timed out'));
      });
      req.write(body);
      req.end();
    });
  }

  /**
   * SSE-style WebSocket server for broadcasting alerts to connected clients.
   * Uses Server-Sent Events over HTTP for simplicity (no ws dependency).
   */
  private startWsServer(port: number): void {
    this.wsServer = http.createServer((req, res) => {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });

      this.wsClients.add(res);

      req.on('close', () => {
        this.wsClients.delete(res);
      });
    });

    this.wsServer.listen(port);
  }

  private broadcastWs(alert: DriftAlert): void {
    const data = `data: ${JSON.stringify(alert)}\n\n`;
    for (const client of this.wsClients) {
      client.write(data);
    }
  }

  async stop(): Promise<void> {
    for (const client of this.wsClients) {
      client.end();
    }
    this.wsClients.clear();

    if (this.wsServer) {
      await new Promise<void>((resolve) => {
        this.wsServer!.close(() => resolve());
      });
      this.wsServer = null;
    }
  }
}
