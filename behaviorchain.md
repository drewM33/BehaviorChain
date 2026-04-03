# BehaviorChain — Hackathon Builder Spec

Tamper-proof behavioral identity for AI agents. An ERC-8004 extension that hash-chains behavioral state commitments on-chain, enabling real-time drift detection before reputation feedback arrives.

40 days, 6 phases. Built to become the canonical standard for agent behavioral integrity.

---

## The Problem

An agent passes validation on day 1. It builds reputation over 200 clean interactions. On interaction 201, it starts exfiltrating wallet data or redirecting transactions.

ERC-8004's Reputation Registry captures feedback after the fact. By the time negative feedback lands, the damage is done — keys stolen, funds redirected.

There is no native way to diff an agent's behavior at time T vs time T-1. No hash chain that lets a verifier say "this agent's behavioral profile has never been forked or silently rewritten."

Reputation tells you "this agent went bad." BehaviorChain tells you "this agent just changed" — in real time, before anyone gets hurt.

---

## What BehaviorChain Is

An ERC-8004 extension consisting of:

1. **A hash-chained commitment registry** — a smart contract where each behavioral snapshot commits to the hash of the previous snapshot. The contract enforces chain continuity. Broken chains revert. Fork detection is built into the state transition function. Full history is reconstructable from events alone.

2. **Encrypted storage with public hashes** — raw behavioral data is always encrypted. Only hashes go on-chain. A verifier can confirm the chain is intact without reading the contents.

3. **A drift detection engine** — an off-chain service that monitors snapshot chains and detects behavioral drift in real time, before reputation feedback arrives.

4. **Human accountability via AgentKit** — when a drifting agent was delegated by a human via World ID, the drift alert includes the human's nullifier hash. You know *which human's agent* changed behavior, not just which agent.

5. **A dashboard and API** — the product surface where developers and operators see the integrity of agents they interact with.

---

## Core Design Principle: Commit on Change, Not on Schedule

BehaviorChain only commits a new snapshot when the behavioral fingerprint actually changes. If Valiron evaluates an agent and the snapshot hash is identical to the chain head, no commit is made. No gas spent. No event emitted.

This means:
- A `SnapshotCommitted` event IS the drift signal. Anyone watching the contract knows an agent's behavior changed just from seeing the event.
- Chain length means "number of behavioral changes" not "number of evaluations" — it's a volatility metric for free.
- An agent with 3 commits over a year is more stable than one with 50 commits in a month.
- The drift engine explains *what* changed. The commit tells you *that* something changed.

---

## What Valiron Provides (Your Data Source)

Valiron is the trust and reputation layer for AI agents. It evaluates agent behavior through sandbox testing and on-chain reputation via ERC-8004. You consume Valiron as a black box.

### Valiron SDK (`@valiron/sdk@0.10.0`)

**Pin to version 0.10.0 or later.** This is the first version that ships `getAgentSnapshot()`.

```ts
import { ValironSDK } from '@valiron/sdk';
const valiron = new ValironSDK({ chain: 'base' });
```

**Available methods (verified from `@valiron/sdk@0.10.0` type definitions):**

| Method | Returns | Description |
|--------|---------|-------------|
| `getAgentProfile(agentId, opts?)` | `AgentProfile` | Full trust profile: identity, reputation, routing, score, tier, risk level |
| `checkAgent(agentId, opts?)` | `RouteDecision` | Quick route: `"prod"` / `"prod_throttled"` / `"sandbox"` / `"sandbox_only"` |
| `getWalletProfile(wallet, opts?)` | `WalletProfile` | Trust profile by wallet (reverse lookup) |
| `resolveWallet(wallet, opts?)` | `WalletResolution` | Lightweight wallet → agentId (Redis → Agent0 subgraph) |
| `triggerSandboxTest(agentId, opts?)` | `SandboxResult` | Run behavioral evaluation. Returns score, tier, risk level |
| `gate(agentId, opts?)` | `GateResult` | Combined on-chain + behavioral → allow/deny |
| `getAgentSnapshot(agentId, opts?)` | `AgentSnapshotSummary` | **Opaque behavioral snapshot hash for chain commitments** |

**Middleware exports:**

| Export | Framework |
|--------|-----------|
| `createValironGate(config)` | Express/Connect |
| `valironFastifyPlugin(fastify, opts)` | Fastify |
| `createValironNextMiddleware(config)` | Next.js |
| `valironGateCheck(sdk, opts)` | Any framework (Hono, Koa, Deno, Bun) |

### `AgentSnapshotSummary` (exact type from SDK 0.10.0)

```ts
interface AgentSnapshotSummary {
  agentId: string;
  /** Deterministic SHA-256 hash of the behavioral evaluation. Opaque. */
  snapshotHash: string;
  /** Hash of the prior snapshot, or "0x0" for the first evaluation. */
  previousHash: string;
  /** IPFS CID of the encrypted full snapshot data, or null. */
  encryptedDataUri: string | null;
  /** ISO 8601 timestamp of when the evaluation was performed. */
  timestamp: string | null;
  /** Total number of interactions in the evaluation window. */
  interactionCount: number;
}
```

### Webhook Registration

```
POST /operator/webhooks/register
{
  "event": "evaluation_complete",
  "url": "https://your-endpoint.com/hooks/valiron",
  "agentIds": [42, 43]
}
```

### Fallback Mode

If `getAgentSnapshot()` returns 404 or errors:

```ts
async function fallbackSnapshot(valiron: ValironSDK, agentId: string) {
  const profile = await valiron.getAgentProfile(agentId);
  const publicFields = {
    score: profile.localReputation?.score,
    tier: profile.localReputation?.tier,
    riskLevel: profile.localReputation?.riskLevel,
    route: profile.routing.finalRoute,
    feedbackCount: profile.onchainReputation.count,
    averageScore: profile.onchainReputation.averageScore,
  };
  const canonical = JSON.stringify(publicFields, Object.keys(publicFields).sort());
  return { snapshotHash: '0x' + createHash('sha256').update(canonical).digest('hex') };
}
```

### What You Do NOT Have Access To

- Raw behavioral metrics (request timing, error rates, backoff patterns)
- Sandbox test events or interaction logs
- Scoring algorithm weights or thresholds

### Future Signals (Valiron Roadmap)

Valiron plans to add supply chain integrity signals internally. When added, `snapshotHash` changes automatically. BehaviorChain benefits with zero code changes.

### Supported Chains

ERC-8004 registries (same address all chains):
- Identity: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- Reputation: `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`

Deploy BehaviorSnapshotRegistry to **Base Sepolia** (testnet) and **Base mainnet** (production).

---

## What BehaviorChain Is NOT

- Not a traffic classifier (AgentDetect)
- Not a trust-tiering middleware (Valiron edge proxy)
- Not a reputation system (ERC-8004 Reputation Registry)
- Not a payment protocol (x402/MPP)

BehaviorChain is the integrity layer underneath all of these.

---

## Principles

**Proactive, not reactive.** Detect change at commit time, not when someone complains.

**Commit on change, not on schedule.** Only commit when hash differs from chain head. No change = no commit = no gas = no noise.

**Encrypted data, public proofs.** Only hashes on-chain. Privacy by construction.

**Linear chain, not Merkle tree.** Ordering and continuity matter, not set membership.

**Incremental verification.** Check hash N-1 matches, then inspect N only.

**Composable with ERC-8004.** Extension, not replacement.

**Human accountability.** AgentKit traces drift back to the delegating human. Access control (Triage) vs accountability (BehaviorChain).

---

## AgentKit Integration (World ID Accountability)

Triage uses AgentKit for access control. BehaviorChain uses it for accountability.

When processing a new commit, the SDK checks for AgentKit delegation. If a World ID nullifier hash exists, drift alerts include it.

```ts
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

interface DriftSignal {
  dimension: string;
  previous: string | number;
  current: string | number;
  description: string;
}
```

---

## Risk Register

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Gas costs | High | Adoption barrier | Commit-on-change = gas only on actual changes. L2 (Base). |
| Off-chain data lost | Medium | Data unrecoverable | Redundant storage (IPFS + fallback). |
| Schema evolution | Medium | Migration | Version field in events. |
| Valiron API down | Medium | Commits paused | Queue + retry. Chain state preserved. |
| False positive alerts | High | Alert fatigue | Configurable severity thresholds. |
| Snapshot API unavailable | Low | Degraded mode | Fallback: hash public profile fields. |

---

## Phase 1 — Smart Contract (Day 1–8)

### Contract: BehaviorSnapshotRegistry

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract BehaviorSnapshotRegistry {
    mapping(uint256 agentId => bytes32 headHash) public chainHeads;
    mapping(uint256 agentId => uint256 snapshotCount) public snapshotCounts;
    mapping(uint256 agentId => uint256 lastCommitTimestamp) public lastCommits;

    event SnapshotCommitted(
        uint256 indexed agentId,
        uint256 indexed snapshotIndex,
        bytes32 snapshotHash,
        bytes32 previousHash,
        uint256 timestamp,
        string encryptedDataUri
    );

    event DriftFlagged(
        uint256 indexed agentId,
        uint256 indexed snapshotIndex,
        address indexed flagger,
        string reason
    );

    function commitSnapshot(
        uint256 agentId, bytes32 snapshotHash,
        bytes32 previousHash, string calldata encryptedDataUri
    ) external;

    function getChainHead(uint256 agentId) external view returns (bytes32);
    function getSnapshotCount(uint256 agentId) external view returns (uint256);
    function getLastCommitTimestamp(uint256 agentId) external view returns (uint256);
    function flagDrift(uint256 agentId, uint256 snapshotIndex, string calldata reason) external;
    function verifyChainContinuity(uint256 agentId, bytes32[] calldata hashes) external view returns (bool);
}
```

Chain continuity: `previousHash == chainHeads[agentId]` or revert. Genesis: `previousHash == 0x0 && snapshotCounts[agentId] == 0`. Owner auth via ERC-8004 `ownerOf(agentId)`.

### Prioritization (MoSCoW)

- **Must:** commitSnapshot with chain continuity enforcement, SnapshotCommitted events, getChainHead, genesis handling, owner authorization via ERC-8004 ownerOf, Base Sepolia deployment
- **Should:** flagDrift (community flagging), verifyChainContinuity (batch verification)
- **Could:** Maximum interval enforcement between snapshots, multi-chain deployment scripts

### Milestone Goals

Phase 1 is complete when ALL of the following pass:

1. Contract deployed to Base Sepolia, verified
2. Correct previousHash → event emitted
3. Wrong previousHash → revert
4. Genesis accepted only when snapshotCount is 0
5. getChainHead correct after N commits
6. Events reconstruct full chain
7. Unauthorized caller reverts
8. ABI + address published

### Exit Metrics

- Contract verified on block explorer with zero compilation warnings
- Gas cost per commitSnapshot call documented (target: <100k gas on Base)
- 100% of chain continuity edge cases covered by test fixtures

### Phase Retrospective

Before starting Phase 2: Did the contract deploy cleanly? Were there gas cost surprises? Does chain continuity enforcement work in edge cases (rapid sequential commits, concurrent commits, max uint256 agentId)? Document any contract changes needed before the SDK builds against this ABI.

---

## Phase 2 — BehaviorChain SDK (Day 9–16)

### Dependencies

- Phase 1 contract deployed and ABI finalized
- `@valiron/sdk@^0.10.0` available on npm (confirmed: v0.10.0 published)
- Base Sepolia RPC endpoint accessible

### Dependency

```json
{ "dependencies": { "@valiron/sdk": "^0.10.0" } }
```

### Core Logic: Commit on Change

```ts
async commitIfChanged(agentId: string): Promise<CommitResult> {
  // 1. Get latest snapshot hash from Valiron
  let snapshotHash: string;
  let encryptedDataUri: string | null;
  try {
    const snapshot = await this.valiron.getAgentSnapshot(agentId);
    snapshotHash = snapshot.snapshotHash;
    encryptedDataUri = snapshot.encryptedDataUri;
  } catch {
    const fallback = await this.fallbackSnapshot(agentId);
    snapshotHash = fallback.snapshotHash;
    encryptedDataUri = null;
  }

  // 2. Get current chain head
  const chainHead = await this.contract.getChainHead(agentId);

  // 3. Only commit if different
  if (snapshotHash === chainHead) {
    return { committed: false, snapshotHash };
  }

  // 4. Behavior changed — commit
  const tx = await this.contract.commitSnapshot(
    agentId, snapshotHash, chainHead, encryptedDataUri ?? ''
  );

  return { committed: true, tx, snapshotHash, previousHash: chainHead };
}
```

### Auto-Commit Mode

```ts
sdk.startAutoCommit(agentId, {
  webhookPort: 3001,
  onCommit: (result) => console.log(`Agent ${agentId} changed — ${result.snapshotHash}`),
  onSkip: () => console.log(`Agent ${agentId} evaluated — no change`),
});
```

### Prioritization (MoSCoW)

- **Must:** commitIfChanged (compare-then-commit logic), getChainHead, getSnapshotCount, verifyChain, genesis handling, Valiron SDK 0.10.0 integration, fallback snapshot mode
- **Should:** Auto-commit via webhook listener, retry logic with exponential backoff, batch commit mode
- **Could:** Multi-chain commit (same snapshot to multiple chains), Arweave backup storage

### Milestone Goals

Phase 2 is complete when ALL of the following pass:

1. `@behaviorchain/sdk` installs with `@valiron/sdk@^0.10.0` as dependency
2. commitIfChanged returns `{ committed: false }` when hash matches chain head — zero gas
3. commitIfChanged returns `{ committed: true, tx }` when hash differs — tx confirmed
4. Genesis snapshot committed with previousHash 0x0
5. Second snapshot with different hash committed
6. Same hash as chain head → `{ committed: false }` confirmed
7. verifyChain returns true for valid chain
8. Auto-commit via webhook within 5 seconds
9. Fallback mode when getAgentSnapshot returns 404

### Exit Metrics

- SDK package builds and publishes with zero type errors
- Commit-on-change logic verified: 10 identical hashes → 0 commits, 1 different hash → 1 commit
- Round-trip latency: getAgentSnapshot → compare → commitSnapshot < 3 seconds (excluding block confirmation)
- Fallback mode produces deterministic hashes from identical profile data

### Phase Retrospective

Before starting Phase 3: Is the Valiron SDK integration stable? Did the fallback mode activate during testing? What's the actual gas cost per commit on Base Sepolia? Is the webhook listener reliable under rapid-fire evaluation events? Document any SDK API changes needed before the drift engine builds against it.

---

## Phase 3 — Drift Detection Engine (Day 17–26)

### Dependencies

- Phase 1 contract deployed and emitting SnapshotCommitted events
- Phase 2 SDK committing snapshots (provides test data for the engine)
- Valiron SDK for querying public agent signals (score, tier, route, reputation)
- AgentKit SDK for human delegation lookup (optional — graceful degradation if unavailable)

Every `SnapshotCommitted` event = confirmed behavioral change. The engine enriches it.

### Drift Signals

- **Hash change** (guaranteed by commit-on-change)
- **Score drop** (configurable threshold, default 15 points)
- **Score cliff** (GREEN → YELLOW/RED in one evaluation)
- **Tier downgrade** (AAA → A, BAA → BA, etc.)
- **Route change** (`prod` → `sandbox_only`)
- **Risk level escalation** (GREEN → RED)
- **Negative feedback spike**
- **Stale chain** (agent no longer being evaluated)

### Severity

- **Critical:** route → sandbox_only, risk → RED, tier → CAA/CA/C
- **High:** score drop ≥25, route → prod_throttled
- **Medium:** score drop ≥15, tier downgrade 1 level
- **Low:** all other changes

### Prioritization (MoSCoW)

- **Must:** Event subscription to SnapshotCommitted, score/tier/route drift detection, severity classification, webhook alert delivery
- **Should:** On-chain reputation drift, stale chain detection, score instability (stddev over last 5), configurable sensitivity thresholds, WebSocket streaming, AgentKit human accountability enrichment
- **Could:** Historical drift analysis (patterns across multiple agents), ML-based anomaly detection, snapshot frequency analysis

### Milestone Goals

Phase 3 is complete when ALL of the following pass:

1. Engine processes each SnapshotCommitted event as confirmed change
2. Score drop 25 → "high"
3. Route → sandbox_only → "critical"
4. Tier downgrade → correct severity
5. GREEN → RED → "critical"
6. Webhook within 5 seconds
7. Configurable thresholds work
8. AgentKit nullifier in alerts when available
9. Stable agents produce no commits, therefore no false positives

### Exit Metrics

- Alert latency: event emitted → webhook delivered < 5 seconds at p95
- False positive rate: 0% on stable agents (agents with no hash changes produce no events, therefore no alerts)
- Severity classification accuracy: 100% of test fixtures classified correctly
- AgentKit enrichment: adds < 500ms to alert processing when available, degrades gracefully when unavailable

### Phase Retrospective

Before starting Phase 4: Which drift signals produced false positives in testing? Are the default severity thresholds (15-point score drop = medium, 25 = high) reasonable against real Valiron evaluation data? Did event subscription handle rapid consecutive commits without dropping events? Does AgentKit enrichment add meaningful signal or just latency?

---

## Phase 4 — Dashboard + API (Day 27–32)

### Dependencies

- Phase 1 contract deployed (chain data source)
- Phase 2 SDK for chain verification and snapshot queries
- Phase 3 drift engine running and producing alerts (drift feed data source)
- Valiron SDK for agent profile overlay (score, tier, identity)

### API

```
GET  /api/agents/:agentId/chain
GET  /api/agents/:agentId/chain/head
GET  /api/agents/:agentId/chain/verify
GET  /api/agents/:agentId/drift
GET  /api/agents/:agentId/profile
GET  /api/agents/:agentId/delegation
GET  /api/stats
GET  /api/leaderboard
```

### Dashboard

- Agent profile with chain visualization + Valiron overlay + human delegator
- Chain explorer
- Drift feed (real-time, filterable)
- Integrity badge: "3 changes in 180 days, 0 drift flags"
- Leaderboard: fewest changes = most stable
- Stats page

### Prioritization (MoSCoW)

- **Must:** Chain/head/verify/drift API endpoints, agent profile page with chain visualization, chain explorer, drift feed (real-time)
- **Should:** Integrity badge (embeddable SVG), leaderboard (stability ranking), stats page, WebSocket streaming, AgentKit delegation display on profile
- **Could:** Community drift flagging via API, embeddable dashboard widgets, historical trend charts

### Milestone Goals

Phase 4 is complete when ALL of the following pass:

1. Chain API returns full hash chain
2. Verify endpoint detects tampered chains
3. Drift history returned
4. Profile page renders
5. Drift feed within 5 seconds
6. Badge renders accurately
7. Leaderboard ranks by stability
8. Human delegator shown when available

### Exit Metrics

- All API endpoints return correct data for agents with 0, 1, 10, and 100+ snapshots
- Dashboard loads in < 2 seconds on first paint
- Drift feed latency: commit event → visible in dashboard < 5 seconds
- Integrity badge SVG is valid, renders in all major browsers, and updates within 60 seconds of new commit

### Phase Retrospective

Before starting Phase 5: Is the API surface complete enough for Valiron to consume as an enrichment signal? Does the dashboard tell a compelling story for the ETHGlobal demo? Which dashboard pages got the most attention during internal review — double down on those for the demo.

---

## Phase 5 — Valiron Integration (Day 33–37)

### Dependencies

- Phase 2 SDK with commitIfChanged working against live contract
- Phase 3 drift engine running and producing alerts
- Phase 4 API serving trust signal endpoint
- Valiron webhook registration endpoint live (`POST /operator/webhooks/register`)

### Pipeline

```ts
const pipeline = new BehaviorChainPipeline({
  valiron: new ValironSDK({ chain: 'base' }),
  behaviorchain: new BehaviorChainSDK({ ... }),
  driftEngine: engine,
});
// On each evaluation_complete:
//   commitIfChanged(agentId)
//   hash same → nothing
//   hash different → commit → drift engine processes
```

### Trust Signal Endpoint

```ts
interface BehaviorChainTrustSignal {
  agentId: string;
  chainLength: number;        // behavioral changes, not evaluations
  lastCommitAge: number;
  driftFlags: number;
  recentCriticalDrift: boolean;
  chainIntact: boolean;
  integrityScore: number;     // 0-100
  humanDelegated: boolean;
}
```

### Prioritization (MoSCoW)

- **Must:** Webhook listener → commitIfChanged pipeline (Valiron → BehaviorChain), pipeline recovery from missed webhooks
- **Should:** Trust signal endpoint (BehaviorChain → Valiron), integrityScore computation
- **Could:** Automatic Valiron score adjustment based on chain integrity, multi-agent batch processing

### Milestone Goals

Phase 5 is complete when ALL of the following pass:

1. Webhook → commitIfChanged pipeline works
2. 10 evaluations with unchanged hash → zero commits confirmed
3. Hash change → commit + drift engine fires
4. Trust signal endpoint accurate
5. Recovery from missed webhooks

### Exit Metrics

- Pipeline processes webhook events with < 1 second overhead before calling commitIfChanged
- Zero missed commits: every hash change detected by the pipeline results in an on-chain commit
- Trust signal endpoint returns consistent data across 100 sequential queries
- Pipeline survives Valiron API restart: queued events processed on reconnection

### Phase Retrospective

Before starting Phase 6: Is the end-to-end pipeline (Valiron evaluation → webhook → commitIfChanged → on-chain commit → drift detection → dashboard) working reliably? What's the median time from Valiron evaluation to drift alert visible in dashboard? Is the trust signal endpoint useful enough for Valiron to consume in v2 scoring?

---

## Phase 6 — EIP + Mainnet + Docs (Day 38–40)

### Dependencies

- Phases 1–5 complete and tested on testnet
- Contract ABI finalized (no further changes after mainnet deploy)
- End-to-end pipeline verified: Valiron evaluation → commit → drift detection → dashboard

### Prioritization (MoSCoW)

- **Must:** EIP draft submitted, contract deployed to Base mainnet and verified, SDK defaults updated to mainnet, operator quickstart documentation
- **Should:** Full API reference, verifier/consumer documentation, developer integration guide
- **Could:** Video walkthrough, ecosystem migration guide, canonical format standalone spec

### Milestone Goals

Phase 6 is complete when ALL of the following pass:

1. EIP draft on ethereum-magicians
2. Contract on Base mainnet, verified
3. SDK defaults → mainnet
4. Quickstart: zero to genesis in 10 minutes
5. Full API reference

### Exit Metrics

- EIP draft receives at least one substantive reply on ethereum-magicians within 7 days (validates community interest)
- Mainnet contract verified and functional: genesis snapshot committed by at least one real agent
- Documentation passes the "new developer" test: someone unfamiliar with the project can go from npm install to committed genesis snapshot following only the docs

---

## Environment Variables (9 total)

**Required (3):**
1. `BEHAVIORCHAIN_RPC_URL`
2. `BEHAVIORCHAIN_PRIVATE_KEY`
3. `BEHAVIORCHAIN_CONTRACT_ADDRESS`

**Optional with defaults (2):**
4. `BEHAVIORCHAIN_CHAIN_ID` (default: 84532)
5. `BEHAVIORCHAIN_IPFS_GATEWAY` (default: public gateway)

**Optional (4):**
6. `BEHAVIORCHAIN_WEBHOOK_URL`
7. `BEHAVIORCHAIN_WEBSOCKET_PORT`
8. `BEHAVIORCHAIN_DASHBOARD_PORT` (default: 3000)
9. `BEHAVIORCHAIN_VALIRON_WEBHOOK_SECRET`

**Removed:** ~~`BEHAVIORCHAIN_SNAPSHOT_FREQUENCY`~~ — commits happen on change, not on schedule.

---

## Packages

- `@behaviorchain/contracts` — Solidity + deployment + ABIs
- `@behaviorchain/sdk` — TypeScript SDK (depends on `@valiron/sdk@^0.10.0`)
- `@behaviorchain/drift` — Drift detection engine
- `@behaviorchain/dashboard` — React dashboard + API

---

## Strategic Context

**ERC-8004:** "Who is this agent?" → **BehaviorChain:** "Has it stayed consistent?"

**Valiron:** Scores agents. **BehaviorChain:** Makes those scores tamper-proof.

**AgentKit:** Triage = access control. BehaviorChain = accountability.

**Commit-on-change:** The commit IS the signal. Chain length = volatility. The on-chain event stream is a public, permissionless feed of every behavioral change across every agent.

This is not a weekend hack. It's a reference implementation for an EIP.
