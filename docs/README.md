# BehaviorChain Documentation

Tamper-proof behavioral identity for AI agents. An ERC-8004 extension that hash-chains behavioral state commitments on-chain, enabling real-time drift detection before reputation feedback arrives.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Valiron                                  │
│              (evaluates agent behavior)                         │
│                                                                 │
│   getAgentSnapshot() ───► snapshotHash                         │
│   evaluation_complete ───► webhook POST                        │
└──────────────┬──────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│     @behaviorchain/pipeline          │
│                                      │
│  Webhook listener ► commitIfChanged  │
│  Recovery ► fills missed commits     │
│  Trust signal ► GET /trust-signal    │
└──────────────┬───────────────────────┘
               │
        ┌──────┴──────┐
        ▼             ▼
┌──────────────┐  ┌────────────────────┐
│ @behaviorchain│  │ @behaviorchain     │
│ /sdk          │  │ /drift             │
│               │  │                    │
│ commitIfChanged│ │ SnapshotCommitted  │
│ verifyChain   │  │ event ► detect     │
│ getChainHead  │  │ drift signals ►    │
│               │  │ classify severity  │
└──────┬────────┘  └────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│  BehaviorSnapshotRegistry (on-chain) │
│                                      │
│  commitSnapshot()  ► SnapshotCommitted│
│  getChainHead()    ► bytes32          │
│  flagDrift()       ► DriftFlagged     │
│                                      │
│  Base Sepolia: 0x8DdD...dAed0        │
│  Base Mainnet: (after deployment)    │
└──────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│     @behaviorchain/dashboard         │
│                                      │
│  Telemetry  ► agent profile + chain  │
│  Race Control ► real-time drift feed │
│  Standings  ► stability leaderboard  │
│  Pit Wall   ► aggregate stats        │
│  Badge      ► embeddable SVG         │
└──────────────────────────────────────┘
```

## Packages

| Package | Description |
|---------|-------------|
| `@behaviorchain/contracts` | Solidity contract + deployment scripts + ABI |
| `@behaviorchain/sdk` | TypeScript SDK — commit-on-change, chain verification |
| `@behaviorchain/drift` | Drift detection engine — real-time severity classification |
| `@behaviorchain/pipeline` | Valiron integration — webhook listener, recovery, trust signals |
| `@behaviorchain/dashboard` | React dashboard + Hono API server |

## Quickstart — Zero to Genesis in 10 Minutes

### Prerequisites

- Node.js 18+
- A wallet with ETH on your target network (Base Sepolia for testnet, Base mainnet for production)
- An agent registered in the [ERC-8004 Identity Registry](https://basescan.org/address/0x8004A818BFB912233c491871b3d84c89A494BD9e) (same address on all chains)

### 1. Clone and install

```bash
git clone https://github.com/drewM33/BehaviorChain.git
cd BehaviorChain/packages/sdk
npm install
```

### 2. Set environment variables

```bash
# Base Sepolia (testnet — default)
export BEHAVIORCHAIN_RPC_URL="https://sepolia.base.org"
export BEHAVIORCHAIN_PRIVATE_KEY="0x_YOUR_PRIVATE_KEY"
export BEHAVIORCHAIN_CONTRACT_ADDRESS="0xDe27DF9DA6BaD0b172F3F1b48CEe818dFE4487CD"

# Base Mainnet (production) — uncomment and set after deploying:
# export BEHAVIORCHAIN_CHAIN_ID="8453"
# export BEHAVIORCHAIN_RPC_URL="https://mainnet.base.org"
# export BEHAVIORCHAIN_CONTRACT_ADDRESS="<your-mainnet-address>"
```

### 3. Commit a genesis snapshot

```typescript
import { BehaviorChainSDK, ZERO_BYTES32 } from '@behaviorchain/sdk';
import { ValironSDK } from '@valiron/sdk';

const valiron = new ValironSDK({ chain: 'base' });

const sdk = new BehaviorChainSDK({
  rpcUrl: process.env.BEHAVIORCHAIN_RPC_URL!,
  privateKey: process.env.BEHAVIORCHAIN_PRIVATE_KEY!,
  contractAddress: process.env.BEHAVIORCHAIN_CONTRACT_ADDRESS!,
  valiron,
});

const agentId = '42'; // your ERC-8004 agent ID

const result = await sdk.commitIfChanged(agentId);

if (result.committed) {
  console.log('Genesis snapshot committed!');
  console.log('  Hash:', result.snapshotHash);
  console.log('  Tx:', result.tx?.hash);
} else {
  console.log('No change — hash matches chain head');
}
```

### 4. Verify the chain

```typescript
const verification = await sdk.verifyChain(agentId);
console.log('Chain valid:', verification.valid);
console.log('Chain length:', verification.chainLength);
```

### 5. Start auto-commit (optional)

```typescript
sdk.startAutoCommit(agentId, {
  webhookPort: 3001,
  onCommit: (r) => console.log(`Behavior changed: ${r.snapshotHash}`),
  onSkip: () => console.log('Evaluated — no change'),
});
```

Register the webhook with Valiron to receive `evaluation_complete` events:

```
POST https://valiron.dev/operator/webhooks/register
{
  "event": "evaluation_complete",
  "url": "https://your-server.com:3001",
  "agentIds": [42]
}
```

## Deployments

| Network | Chain ID | Contract Address | `BEHAVIORCHAIN_CHAIN_ID` |
|---------|----------|-----------------|--------------------------|
| Base Sepolia | 84532 | `0xDe27DF9DA6BaD0b172F3F1b48CEe818dFE4487CD` | `84532` (default) |
| Base Mainnet | 8453 | *(deploy with `npm run deploy:base` in `packages/contracts`)* | `8453` |

## Further Reading

- [EIP Draft](./eip-draft.md) — Standards Track proposal for behavioral snapshots
- [Operator Guide](./operator-guide.md) — Running and maintaining behavioral chains
- [Verifier Guide](./verifier-guide.md) — Checking chain integrity and interpreting drift
- [API Reference](./api-reference.md) — Complete SDK, API, and type documentation
