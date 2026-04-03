# Verifier Guide

For verifiers and consumers: how to check an agent's behavioral integrity, read drift alerts, and interpret chain metrics.

## What you can verify

As a verifier (marketplace, protocol, consumer), you can answer these questions about any agent without special permissions:

1. **Has this agent's behavior ever changed?** → Check chain length
2. **Is the behavioral chain intact?** → Call verify endpoint
3. **When was the last behavioral change?** → Check chain head timestamp
4. **How volatile is this agent?** → Changes per month ratio
5. **Has drift been flagged?** → Check drift history
6. **Was a human accountable?** → Check AgentKit delegation

## Checking chain integrity via API

### Full chain

```
GET /api/agents/:agentId/chain
```

Returns the complete hash chain — every behavioral change from genesis to current head:

```json
{
  "agentId": 42,
  "chainLength": 3,
  "chain": [
    {
      "index": 0,
      "snapshotHash": "0xab3f...d412",
      "previousHash": "0x0000...0000",
      "timestamp": 1728345600000,
      "description": "Genesis commit"
    },
    {
      "index": 1,
      "snapshotHash": "0xc901...e7a3",
      "previousHash": "0xab3f...d412",
      "timestamp": 1734220800000
    }
  ]
}
```

**Verification rule:** Each node's `previousHash` must equal the prior node's `snapshotHash`. Genesis `previousHash` must be `0x0000...0000`.

### Verify endpoint

```
GET /api/agents/:agentId/chain/verify
```

The server performs the verification for you:

```json
{
  "agentId": 42,
  "valid": true,
  "chainLength": 3
}
```

If the chain is broken:

```json
{
  "agentId": 99,
  "valid": false,
  "chainLength": 3,
  "brokenAt": 2
}
```

A broken chain means the hash linkage was disrupted. This should never happen under normal operation — it indicates tampering or data corruption.

### Chain head (lightweight check)

```
GET /api/agents/:agentId/chain/head
```

```json
{
  "agentId": 42,
  "headHash": "0xf482...1b09",
  "snapshotCount": 3,
  "lastCommitTimestamp": 1711094400000
}
```

## Reading drift alerts

```
GET /api/agents/:agentId/drift
```

Returns the alert history, sorted most recent first:

```json
{
  "agentId": 45,
  "totalAlerts": 8,
  "alerts": [
    {
      "severity": "critical",
      "snapshotIndex": 21,
      "driftSignals": [
        {
          "dimension": "subprocess_spawn",
          "description": "Subprocess spawned: sh -c curl (agent never spawned processes before)"
        }
      ],
      "timestamp": 1712102400000,
      "humanNullifierHash": null
    }
  ]
}
```

### Severity levels

| Level | What it means for you |
|-------|----------------------|
| **Critical** | Do not route production traffic to this agent. Investigate before restoring. |
| **High** | Proceed with caution. Apply rate limiting or additional validation. |
| **Medium** | Monitor closely. Change may be intentional (operator update) or early warning. |
| **Low** | Behavior changed but no negative indicators. Typical for normal updates. |

### Supply chain attack patterns

Watch for these critical drift signals — they indicate potential compromise:

- `"Dependency graph hash changed. New package: plain-crypto-js@4.2.1"` — dependency injection
- `"Sensitive env var access: AWS_SECRET_ACCESS_KEY, NPM_TOKEN"` — credential harvesting
- `"Subprocess spawned: sh -c curl"` — data exfiltration attempt

## Interpreting chain length as stability

Chain length = number of behavioral changes. **Lower is better.**

| Chain length | Period | Interpretation |
|-------------|--------|---------------|
| 1–3 | 6+ months | Extremely stable. Minimal behavioral changes. |
| 5–10 | 3+ months | Stable. Changes are infrequent and likely planned. |
| 10–20 | 1–3 months | Moderately volatile. Frequent updates or iterations. |
| 20+ | < 1 month | Highly volatile. Investigate before trusting. |

The **changes per month** ratio normalizes for age:

```
changesPerMonth = chainLength / (daysSinceGenesis / 30)
```

An agent with 2 changes over 365 days (0.16/month) is far more stable than one with 15 changes over 45 days (10/month).

## Trust signal endpoint

```
GET /api/agents/:agentId/trust-signal
```

A single composite signal for programmatic consumption:

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

| Field | Type | Description |
|-------|------|-------------|
| `chainLength` | number | Total behavioral changes (not evaluations) |
| `lastCommitAge` | number | Seconds since last behavioral change |
| `driftFlags` | number | Total drift alerts for this agent |
| `recentCriticalDrift` | boolean | Any critical/high alert in last 24 hours |
| `chainIntact` | boolean | Hash chain passes verification |
| `integrityScore` | number | 0-100 composite score |
| `humanDelegated` | boolean | World ID delegation exists |

### Integrity score breakdown

- Starts at 100
- -40 if chain integrity is broken
- -20 if recent critical drift detected
- -3 per drift flag (max -30)
- +5 if human delegated (accountability bonus)
- Clamped to 0–100

## AgentKit delegation

```
GET /api/agents/:agentId/delegation
```

When an agent was delegated by a human via World ID:

```json
{
  "agentId": 47,
  "delegated": true,
  "humanNullifierHash": "0x7f3a...9e2b",
  "delegationTimestamp": 1695772800000
}
```

Human delegation means a real person (verified via World ID) is accountable for this agent's behavior. When drift is detected, the alert includes the nullifier hash — you know which human's agent changed behavior.

Non-delegated agents return:

```json
{
  "agentId": 42,
  "delegated": false
}
```

## Real-time monitoring

### SSE event stream

```
GET /api/events
```

Connect via `EventSource` to receive drift alerts in real time:

```typescript
const es = new EventSource('https://your-server/api/events');
es.addEventListener('drift', (event) => {
  const alert = JSON.parse(event.data);
  if (alert.severity === 'critical') {
    // Immediately suspend traffic to this agent
  }
});
```

Events are delivered within 5 seconds of the on-chain commit.

## Decision matrix

| Signal | Action |
|--------|--------|
| `chainIntact: false` | Block immediately. Chain tampering detected. |
| `recentCriticalDrift: true` | Suspend and investigate. Possible compromise. |
| `integrityScore < 30` | High risk. Apply strict rate limiting. |
| `integrityScore 30–70` | Medium risk. Monitor closely, apply throttling. |
| `integrityScore > 70` | Low risk. Normal operation with standard monitoring. |
| `humanDelegated: true` | Accountability exists. Factor into trust decisions. |
| `chainLength > 20` in 30 days | High volatility. Agent is unstable. |
