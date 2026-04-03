# API Reference

Complete reference for the BehaviorChain SDK, API endpoints, and types.

---

## SDK Methods (`@behaviorchain/sdk`)

### `BehaviorChainSDK`

```typescript
import { BehaviorChainSDK } from '@behaviorchain/sdk';

const sdk = new BehaviorChainSDK({
  rpcUrl: string;           // Base RPC endpoint
  privateKey: string;       // Agent owner wallet private key
  contractAddress: string;  // BehaviorSnapshotRegistry address
  valiron: IValironSDK;     // Valiron SDK instance
  fromBlock?: number;       // Block to start querying events from (default: 0)
});
```

#### `commitIfChanged(agentId: string): Promise<CommitResult>`

Core commit-on-change logic. Fetches the latest snapshot hash from Valiron, compares against the on-chain head, and only commits if they differ.

```typescript
const result = await sdk.commitIfChanged('42');
// result.committed: boolean — true if a new snapshot was committed
// result.snapshotHash: string — the hash that was evaluated
// result.tx?: TransactionReceipt — present when committed
// result.previousHash?: string — the prior chain head
```

**Gas cost:** ~65,000 gas on Base when a commit occurs. Zero gas when hash matches.

#### `verifyChain(agentId: string): Promise<ChainVerificationResult>`

Reads all `SnapshotCommitted` events for an agent and verifies the `previousHash` linkage from genesis to head.

```typescript
const result = await sdk.verifyChain('42');
// result.valid: boolean — true if chain is intact
// result.chainLength: number — total snapshots
// result.events: SnapshotEvent[] — all events in order
// result.brokenAt?: number — index where chain breaks (if invalid)
```

#### `getChainHead(agentId: string): Promise<string>`

Returns the current chain head hash (bytes32) for an agent. Returns `0x0000...0000` if no snapshots exist.

#### `getSnapshotCount(agentId: string): Promise<number>`

Returns the number of behavioral changes (snapshots) for an agent.

#### `getSnapshotEvents(agentId: string): Promise<SnapshotEvent[]>`

Returns all `SnapshotCommitted` events for an agent, with automatic pagination for RPC block range limits.

#### `startAutoCommit(agentId: string, options: AutoCommitOptions)`

Starts an HTTP server that listens for Valiron `evaluation_complete` webhook POSTs. On each event, calls `commitIfChanged(agentId)`.

```typescript
const { server, close } = sdk.startAutoCommit('42', {
  webhookPort: 3001,
  onCommit: (result) => console.log('Changed:', result.snapshotHash),
  onSkip: (result) => console.log('Same:', result.snapshotHash),
});
```

---

## Pipeline (`@behaviorchain/pipeline`)

### `BehaviorChainPipeline`

```typescript
import { BehaviorChainPipeline } from '@behaviorchain/pipeline';

const pipeline = new BehaviorChainPipeline({
  valiron: IValironSDK;
  behaviorchain: IBehaviorChainSDK;
  driftEngine?: IDriftEngine;
  agentKit?: IAgentKitProvider;
  webhookPort?: number;        // default: 3002
  webhookSecret?: string;      // validates x-valiron-signature header
  agentIds?: string[];         // agents to recover on startup
  retryIntervalMs?: number;    // default: 10000
  maxRetries?: number;         // default: 5
});
```

#### `start(): Promise<void>`

Starts the retry timer and runs recovery for configured `agentIds`.

#### `startServer(): void`

Starts the HTTP server for webhooks and trust signal queries.

#### `stop(): Promise<void>`

Stops the retry timer and HTTP server.

#### `processEvaluation(agentId: string): Promise<CommitResult>`

Processes a single evaluation event — calls `commitIfChanged`, notifies the drift engine on change, queues for retry on failure.

#### `recover(agentIds: string[]): Promise<number>`

Checks each agent for gaps between Valiron snapshot and on-chain head. Commits missing snapshots. Returns count of recovered gaps.

#### `getTrustSignal(agentId: string): Promise<BehaviorChainTrustSignal>`

Computes the composite trust signal for an agent.

---

## Drift Engine (`@behaviorchain/drift`)

### `DriftEngine`

```typescript
import { DriftEngine } from '@behaviorchain/drift';

const engine = new DriftEngine({
  contractAddress: string;
  rpcUrl: string;
  valironSdk: IValironSDK;
  chainId?: number;            // default: 84532
  sensitivity?: {
    scoreDropThreshold?: number;  // default: 15
    staleChainHours?: number;     // default: 24
    trackHistory?: number;        // default: 10
  };
  alerts?: {
    webhookUrl?: string;
    websocketPort?: number;
    severityThreshold?: Severity; // default: 'low'
  };
  agentKit?: IAgentKitProvider;
  onDrift?: (alert: DriftAlert) => void;
});
```

#### `start(): Promise<void>`

Subscribes to `SnapshotCommitted` events and begins drift monitoring.

#### `stop(): Promise<void>`

Unsubscribes from events and stops the alert dispatcher.

#### `processEvent(event: SnapshotCommittedEvent): Promise<DriftAlert | null>`

Processes a single event directly (used by the pipeline and for testing).

### Drift signals

| Dimension | Trigger | Typical severity |
|-----------|---------|-----------------|
| `hash_change` | Every commit (guaranteed) | low |
| `score_drop` | Score decreases ≥ threshold | medium (≥15) / high (≥25) |
| `score_cliff` | GREEN → YELLOW/RED in one evaluation | medium / critical |
| `tier_downgrade` | Tier drops (e.g., AAA → A) | medium (1 level) / critical (to C-tier) |
| `route_change` | Route changes (e.g., prod → sandbox_only) | high / critical |
| `risk_escalation` | Risk level increases | medium / critical (to RED) |
| `negative_feedback_spike` | ≥3 low scores in last 5 evaluations | medium |
| `stale_chain` | No commits within configured window | medium |

### Severity classification

| Level | Triggers |
|-------|----------|
| **critical** | Route → `sandbox_only`, risk → RED, tier → CAA/CA/C |
| **high** | Score drop ≥25, route → `prod_throttled`, tier drop ≥2 levels |
| **medium** | Score drop ≥15, tier downgrade 1 level, stale chain, feedback spike |
| **low** | Hash change only (no negative indicators) |

---

## Dashboard API Endpoints

Base URL: `http://localhost:3001` (configurable via `BEHAVIORCHAIN_DASHBOARD_PORT`)

### Chain endpoints

#### `GET /api/agents/:agentId/chain`

Full snapshot chain with hashes, timestamps, and descriptions.

**Response:**
```json
{
  "agentId": 42,
  "chainLength": 3,
  "chain": [
    {
      "index": 0,
      "snapshotHash": "0xab3f...",
      "previousHash": "0x0000...0000",
      "timestamp": 1728345600000,
      "encryptedDataUri": "ipfs://Qm...",
      "description": "Genesis commit"
    }
  ]
}
```

#### `GET /api/agents/:agentId/chain/head`

Current chain head hash and snapshot count.

**Response:**
```json
{
  "agentId": 42,
  "headHash": "0xf482...1b09",
  "snapshotCount": 3,
  "lastCommitTimestamp": 1711094400000
}
```

#### `GET /api/agents/:agentId/chain/verify`

Verify chain integrity from genesis to head.

**Response (valid):**
```json
{ "agentId": 42, "valid": true, "chainLength": 3 }
```

**Response (broken):**
```json
{ "agentId": 99, "valid": false, "chainLength": 3, "brokenAt": 2 }
```

### Drift endpoints

#### `GET /api/agents/:agentId/drift`

Drift alert history for an agent, sorted reverse-chronologically.

**Response:**
```json
{
  "agentId": 45,
  "totalAlerts": 8,
  "alerts": [DriftAlert, ...]
}
```

### Profile endpoints

#### `GET /api/agents/:agentId/profile`

Combined chain data + Valiron trust profile + delegation info.

**Response:**
```json
{
  "agentId": 42,
  "name": "sentinel-alpha",
  "chain": { "length": 3, "headHash": "0x...", "intact": true, "nodes": [...] },
  "trust": { "score": 98, "tier": "AAA", "riskLevel": "GREEN", "route": "prod" },
  "drift": { "flagCount": 0, "highestSeverity": "none", "alerts": [] },
  "delegation": null,
  "cleanLaps": 450
}
```

#### `GET /api/agents/:agentId/delegation`

AgentKit delegation info (World ID).

**Response (delegated):**
```json
{
  "agentId": 47,
  "delegated": true,
  "humanNullifierHash": "0x7f3a...9e2b",
  "delegationTimestamp": 1695772800000
}
```

**Response (not delegated):**
```json
{ "agentId": 42, "delegated": false }
```

### Aggregate endpoints

#### `GET /api/stats`

Aggregate metrics across all monitored agents.

**Response:**
```json
{
  "totalAgents": 6,
  "totalBehavioralChanges": 51,
  "totalDriftAlerts": 15,
  "driftDetectionRate": "100%",
  "averageCleanLaps": 290,
  "chainIntegrityRate": "100%",
  "industryAvgDetectionDays": 267,
  "behaviorChainDetectionSeconds": 5
}
```

#### `GET /api/leaderboard`

Agents ranked by stability (fewest changes per month).

**Response:**
```json
{
  "leaderboard": [
    {
      "position": 1,
      "agentId": 47,
      "name": "delegate-prime",
      "cleanLaps": 600,
      "chainLength": 2,
      "changesPerMonth": 0.16,
      "tier": "AAA",
      "riskLevel": "GREEN",
      "driftFlags": 0,
      "score": 95
    }
  ]
}
```

### Trust signal endpoint

#### `GET /api/agents/:agentId/trust-signal`

Composite trust signal for programmatic consumption.

**Response:**
```json
{
  "agentId": "42",
  "chainLength": 3,
  "lastCommitAge": 1036800,
  "driftFlags": 0,
  "recentCriticalDrift": false,
  "chainIntact": true,
  "integrityScore": 100,
  "humanDelegated": false
}
```

### Real-time stream

#### `GET /api/events`

Server-Sent Events stream. Connect via `EventSource`:

```typescript
const es = new EventSource('/api/events');
es.addEventListener('drift', (event) => {
  const alert: DriftAlert = JSON.parse(event.data);
});
```

Events are `DriftAlert` objects serialized as JSON.

---

## Types

### `DriftAlert`

```typescript
interface DriftAlert {
  agentId: string;
  chainId: number;
  snapshotIndex: number;
  previousSnapshotHash: string;
  currentSnapshotHash: string;
  driftSignals: DriftSignal[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  humanNullifierHash?: string;
  delegationTimestamp?: number;
}
```

### `DriftSignal`

```typescript
interface DriftSignal {
  dimension: string;
  previous: string | number;
  current: string | number;
  description: string;
}
```

### `BehaviorChainTrustSignal`

```typescript
interface BehaviorChainTrustSignal {
  agentId: string;
  chainLength: number;
  lastCommitAge: number;
  driftFlags: number;
  recentCriticalDrift: boolean;
  chainIntact: boolean;
  integrityScore: number;
  humanDelegated: boolean;
}
```

### `CommitResult`

```typescript
interface CommitResult {
  committed: boolean;
  snapshotHash: string;
  tx?: TransactionReceipt;
  previousHash?: string;
}
```

### `ChainVerificationResult`

```typescript
interface ChainVerificationResult {
  valid: boolean;
  chainLength: number;
  events: SnapshotEvent[];
  brokenAt?: number;
}
```

### `SnapshotEvent`

```typescript
interface SnapshotEvent {
  agentId: bigint;
  snapshotIndex: bigint;
  snapshotHash: string;
  previousHash: string;
  timestamp: bigint;
  encryptedDataUri: string;
  blockNumber: number;
  transactionHash: string;
}
```
