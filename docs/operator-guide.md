# Operator Guide

For agent operators: how to maintain a behavioral chain, interpret drift alerts, and keep your agents' integrity proofs current.

## What is a behavioral chain?

A behavioral chain is a sequence of hash commitments that records every time your agent's behavior changes. Each commit links to the previous one, creating a tamper-proof history.

```
[Genesis] ──► [Change 1] ──► [Change 2] ──► [Current Head]
  0x0→ab3f     ab3f→c901      c901→f482       head = f482
```

Commits only happen when behavior changes. If your agent is evaluated 500 times and the behavioral fingerprint is identical each time, the chain stays at length 1. Short chains = stable agents.

## SDK Quickstart

### Install

```bash
npm install @behaviorchain/sdk @valiron/sdk
```

### Initialize

```typescript
import { BehaviorChainSDK } from '@behaviorchain/sdk';
import { ValironSDK } from '@valiron/sdk';

const sdk = new BehaviorChainSDK({
  rpcUrl: process.env.BEHAVIORCHAIN_RPC_URL!,
  privateKey: process.env.BEHAVIORCHAIN_PRIVATE_KEY!,
  contractAddress: process.env.BEHAVIORCHAIN_CONTRACT_ADDRESS!,
  valiron: new ValironSDK({ chain: 'base' }),
});
```

### Commit on change

```typescript
const result = await sdk.commitIfChanged('42');

if (result.committed) {
  // Behavior changed — new snapshot committed on-chain
  console.log('New hash:', result.snapshotHash);
  console.log('Previous:', result.previousHash);
} else {
  // Same behavior — no gas spent
  console.log('No change detected');
}
```

### When do commits happen?

Commits happen **only when the behavioral fingerprint changes**. The SDK:

1. Fetches the latest snapshot hash from Valiron (`getAgentSnapshot`)
2. Reads the current chain head from the contract (`getChainHead`)
3. Compares the two hashes
4. If identical → returns `{ committed: false }`, zero gas
5. If different → calls `commitSnapshot` on-chain, emits `SnapshotCommitted`

You don't need to decide when to commit. The SDK handles it.

### Auto-commit via webhooks

For continuous monitoring, register a webhook with Valiron and let the SDK handle commits automatically:

```typescript
sdk.startAutoCommit('42', {
  webhookPort: 3001,
  onCommit: (result) => {
    console.log(`Agent 42 behavior changed: ${result.snapshotHash}`);
    // Alert your team, update dashboards, etc.
  },
  onSkip: () => {
    console.log('Agent 42 evaluated — no change');
  },
});
```

### Full pipeline (recommended for production)

For production deployments, use the `@behaviorchain/pipeline` package which adds recovery from missed webhooks, retry queues, and a trust signal endpoint:

```typescript
import { BehaviorChainPipeline } from '@behaviorchain/pipeline';
import { DriftEngine } from '@behaviorchain/drift';

const pipeline = new BehaviorChainPipeline({
  valiron,
  behaviorchain: sdk,
  driftEngine: new DriftEngine({ ... }),
  agentIds: ['42', '43'],
  webhookPort: 3002,
  webhookSecret: process.env.BEHAVIORCHAIN_VALIRON_WEBHOOK_SECRET,
});

await pipeline.start();     // recovers missed commits on startup
pipeline.startServer();     // starts webhook + trust signal HTTP server
```

## Encryption key management

Raw behavioral data is always encrypted before storage. Only hashes go on-chain.

- The `encryptedDataUri` field in each snapshot points to an IPFS CID containing the encrypted evaluation data
- Use a unique encryption key per agent
- Store keys in a secrets manager (AWS Secrets Manager, HashiCorp Vault)
- Rotate keys periodically — old snapshots remain verifiable by hash even after key rotation
- If you lose the encryption key, the on-chain hash chain is still valid for integrity verification

## Interpreting drift alerts

When the drift engine detects a behavioral change, it classifies the severity:

| Severity | Meaning | Example triggers |
|----------|---------|-----------------|
| **Critical** | Agent is compromised or severely degraded | Route → `sandbox_only`, risk → RED, tier → C |
| **High** | Significant negative change | Score drop ≥25 points, route → `prod_throttled` |
| **Medium** | Notable change worth investigating | Score drop ≥15 points, tier downgrade 1 level |
| **Low** | Minor change, informational | Hash changed but no negative signal indicators |

A `DriftAlert` contains:

```typescript
{
  agentId: '42',
  severity: 'high',
  snapshotIndex: 5,
  driftSignals: [
    { dimension: 'score_drop', previous: 95, current: 68,
      description: 'Score dropped by 27 points' },
    { dimension: 'route_change', previous: 'prod', current: 'prod_throttled',
      description: 'Route changed from prod to prod_throttled' }
  ],
  humanNullifierHash: '0x7f3a...',  // if World ID delegated
}
```

### What to do when you receive an alert

| Severity | Response |
|----------|----------|
| Critical | Investigate immediately. Check for supply chain attacks, unauthorized model changes, env var leaks. |
| High | Review within 1 hour. Check recent deployments, dependency updates, config changes. |
| Medium | Review within 24 hours. May be expected (planned update) or early warning. |
| Low | Informational. Log for audit trail. |

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BEHAVIORCHAIN_RPC_URL` | Yes | — | Base RPC endpoint |
| `BEHAVIORCHAIN_PRIVATE_KEY` | Yes | — | Wallet private key (agent owner) |
| `BEHAVIORCHAIN_CONTRACT_ADDRESS` | Yes | — | BehaviorSnapshotRegistry address |
| `BEHAVIORCHAIN_CHAIN_ID` | No | `84532` | Chain ID (84532 = Base Sepolia, 8453 = Base mainnet) |
| `BEHAVIORCHAIN_IPFS_GATEWAY` | No | Public gateway | IPFS gateway for encrypted data |
| `BEHAVIORCHAIN_WEBHOOK_URL` | No | — | URL for drift alert delivery |
| `BEHAVIORCHAIN_WEBSOCKET_PORT` | No | — | Port for SSE drift alert stream |
| `BEHAVIORCHAIN_DASHBOARD_PORT` | No | `3000` | Dashboard server port |
| `BEHAVIORCHAIN_VALIRON_WEBHOOK_SECRET` | No | — | Shared secret for webhook validation |

### Switching to Base mainnet

All packages read `BEHAVIORCHAIN_CHAIN_ID` to determine which network to target. Set the following to run on mainnet:

```bash
export BEHAVIORCHAIN_CHAIN_ID=8453
export BEHAVIORCHAIN_RPC_URL="https://mainnet.base.org"
export BEHAVIORCHAIN_CONTRACT_ADDRESS="0x2Dd0946Be048e7B61E2995bdDE97860427e74562"
```

For frontend/dashboard, also set the client-side env var:

```bash
NEXT_PUBLIC_CHAIN_ID=8453    # Next.js frontend
VITE_CHAIN_ID=8453           # Dashboard (Vite)
```

The SDK, drift engine, pipeline, scripts, frontend, and dashboard all derive explorer URLs, chain names, and RPC defaults from the chain ID automatically via `getNetworkConfig()` from `@behaviorchain/sdk`.
