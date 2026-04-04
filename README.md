# BehaviorChain

Tamper-proof behavioral identity for AI agents.

An ERC-8004 extension that hash-chains behavioral state commitments on-chain, enabling real-time drift detection before reputation feedback arrives. Commits only occur when behavior changes — the on-chain event stream is a permissionless feed of every behavioral change across every agent.

## The Problem

An agent passes validation on day 1. It builds reputation over 200 clean interactions. On interaction 201, it starts exfiltrating wallet data.

ERC-8004's Reputation Registry captures feedback *after the fact*. BehaviorChain detects the change *when it happens* — in real time, before anyone gets hurt.

## How It Works

```
Valiron evaluates agent → snapshot hash changes → SDK commits on-chain
→ drift engine detects signals → alert delivered in < 5 seconds
```

- **Commit on change, not on schedule.** No change = no commit = no gas = no noise.
- **The commit IS the signal.** A `SnapshotCommitted` event means behavior changed.
- **Chain length = volatility.** 3 changes in a year → stable. 50 in a month → investigate.
- **Encrypted data, public proofs.** Only hashes go on-chain. Privacy by construction.

## Packages

| Package | Description |
|---------|-------------|
| [`@behaviorchain/contracts`](packages/contracts) | Solidity contract + deployment scripts |
| [`@behaviorchain/sdk`](packages/sdk) | TypeScript SDK — commit-on-change, chain verification |
| [`@behaviorchain/drift`](packages/drift) | Drift detection engine — severity classification, alerting |
| [`@behaviorchain/pipeline`](packages/pipeline) | Valiron integration — webhooks, recovery, trust signals |
| [`@behaviorchain/frontend`](packages/frontend) | Next.js dashboard — Control Panel, drift feed, stats |
| [`@behaviorchain/dashboard`](packages/dashboard) | Hono API server (legacy Vite dashboard) |

## Quickstart

```bash
git clone https://github.com/drewM33/BehaviorChain.git
cd BehaviorChain/packages/sdk
npm install
```

```typescript
import { BehaviorChainSDK } from '@behaviorchain/sdk';
import { ValironSDK } from '@valiron/sdk';

const sdk = new BehaviorChainSDK({
  rpcUrl: process.env.BEHAVIORCHAIN_RPC_URL!,       // https://mainnet.base.org or https://sepolia.base.org
  privateKey: process.env.BEHAVIORCHAIN_PRIVATE_KEY!,
  contractAddress: process.env.BEHAVIORCHAIN_CONTRACT_ADDRESS!,
  valiron: new ValironSDK({ chain: 'base' }),
});

// Commit only if behavior changed — zero gas if unchanged
const result = await sdk.commitIfChanged('42');
```

See the [full quickstart](docs/README.md) for a complete walkthrough.

## Deployments

| Network | Chain ID | Contract | `BEHAVIORCHAIN_CHAIN_ID` |
|---------|----------|----------|--------------------------|
| Base Sepolia | 84532 | `0xDe27DF9DA6BaD0b172F3F1b48CEe818dFE4487CD` | `84532` (default) |
| Base Mainnet | 8453 | `0x2Dd0946Be048e7B61E2995bdDE97860427e74562` | `8453` |

### Switching networks

Set these environment variables to target mainnet instead of testnet:

```bash
BEHAVIORCHAIN_CHAIN_ID=8453
BEHAVIORCHAIN_RPC_URL=https://mainnet.base.org
BEHAVIORCHAIN_CONTRACT_ADDRESS=0x2Dd0946Be048e7B61E2995bdDE97860427e74562
```

For frontend apps, also set:

```bash
NEXT_PUBLIC_CHAIN_ID=8453          # Next.js frontend
VITE_CHAIN_ID=8453                 # Dashboard (Vite)
```

## Documentation

- [Project Overview & Quickstart](docs/README.md)
- [EIP Draft — BehaviorSnapshot Extension](docs/eip-draft.md)
- [Operator Guide](docs/operator-guide.md) — maintaining behavioral chains
- [Verifier Guide](docs/verifier-guide.md) — checking integrity and interpreting drift
- [API Reference](docs/api-reference.md) — SDK methods, endpoints, types

## Architecture

```
Valiron (evaluation) ──► Pipeline (webhook) ──► SDK (commitIfChanged)
                                                     │
                                                     ▼
                                              On-chain contract
                                           (BehaviorSnapshotRegistry)
                                                     │
                                                     ▼
                                              Drift Engine
                                         (severity classification)
                                                     │
                                                     ▼
                                              Frontend (Next.js)
                                     Control Panel · Drift Feed · Stats
```

## License

MIT
