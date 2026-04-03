---
eip: TBD
title: BehaviorSnapshot Extension to ERC-8004
description: Hash-chained behavioral state commitments for AI agents, enabling tamper-proof behavioral identity and real-time drift detection
author: Drew Mailen, Vatsa Shah (@vatsashah) (Valiron)
discussions-to: https://ethereum-magicians.org/
status: Draft
type: Standards Track
category: ERC
created: 2026-04-03
requires: 8004
---

## Abstract

An extension to ERC-8004 (Decentralized AI Agent Identity) that adds hash-chained behavioral state commitments for AI agents. Each behavioral snapshot commits to the hash of the previous snapshot, creating a tamper-proof, ordered history of every behavioral change an agent has undergone.

Commits only occur when the behavioral fingerprint actually changes. The on-chain event stream is a permissionless feed of every behavioral change across every agent — no polling, no API keys, no trust assumptions.

## Motivation

ERC-8004 establishes decentralized identity for AI agents via the Identity Registry, with reputation feedback captured in the Reputation Registry. However, reputation is reactive: by the time negative feedback arrives, damage is done — keys stolen, funds redirected, transactions rerouted.

The March 2026 Axios supply chain attack demonstrated that identity signals remain valid while agent behavior changes silently underneath. An agent can pass validation on day 1, build reputation over 200 clean interactions, and on interaction 201 begin exfiltrating wallet data. The identity is unchanged. The reputation is positive. The behavior is compromised.

Three gaps exist in the current standard:

1. **No behavioral diffing.** There is no way to compare an agent's behavior at time T versus time T-1. A verifier cannot ask "has this agent changed?" without re-running a full evaluation.

2. **No canonical snapshot format.** Behavioral evaluations produce scores, tiers, and risk levels, but there is no standard commitment format that makes these evaluations tamper-proof and independently verifiable.

3. **No chain integrity proof.** There is no hash chain that lets a verifier confirm an agent's behavioral history has never been forked, silently rewritten, or selectively omitted.

This EIP addresses all three by introducing a BehaviorSnapshotRegistry that hash-chains behavioral state commitments on-chain, with commit-on-change semantics that make every on-chain event a confirmed behavioral change.

## Specification

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in RFC 2119 and RFC 8174.

### BehaviorSnapshotRegistry Interface

```solidity
interface IBehaviorSnapshotRegistry {
    // Events
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

    // Errors
    error NotAgentOwner(uint256 agentId, address caller);
    error ChainContinuityBroken(uint256 agentId, bytes32 expected, bytes32 provided);
    error InvalidGenesis(uint256 agentId);
    error InvalidSnapshotIndex(uint256 agentId, uint256 provided, uint256 max);

    // State commitment
    function commitSnapshot(
        uint256 agentId,
        bytes32 snapshotHash,
        bytes32 previousHash,
        string calldata encryptedDataUri
    ) external;

    // Chain queries
    function getChainHead(uint256 agentId) external view returns (bytes32);
    function getSnapshotCount(uint256 agentId) external view returns (uint256);
    function getLastCommitTimestamp(uint256 agentId) external view returns (uint256);

    // Community flagging
    function flagDrift(
        uint256 agentId,
        uint256 snapshotIndex,
        string calldata reason
    ) external;

    // Batch verification
    function verifyChainContinuity(
        uint256 agentId,
        bytes32[] calldata hashes
    ) external view returns (bool);
}
```

### Chain Continuity Rules

1. **Genesis rule:** The first snapshot for any agent MUST have `previousHash == bytes32(0)`. If `snapshotCounts[agentId] == 0` and `previousHash != bytes32(0)`, the transaction MUST revert with `InvalidGenesis`.

2. **Continuity rule:** For all subsequent snapshots, `previousHash` MUST equal `chainHeads[agentId]`. If they differ, the transaction MUST revert with `ChainContinuityBroken`.

3. **State updates:** On successful commit, the contract MUST:
   - Set `chainHeads[agentId] = snapshotHash`
   - Increment `snapshotCounts[agentId]`
   - Set `lastCommits[agentId] = block.timestamp`
   - Emit `SnapshotCommitted` with all parameters

### Owner Authorization

The `commitSnapshot` function MUST verify that `msg.sender == identityRegistry.ownerOf(agentId)` where `identityRegistry` is the ERC-8004 Identity Registry. This ensures only the registered owner of an agent can commit behavioral snapshots.

### Commit-on-Change Semantics

Implementations SHOULD only call `commitSnapshot` when the behavioral fingerprint has actually changed. If an evaluation produces the same `snapshotHash` as the current `chainHeads[agentId]`, no transaction should be submitted.

This means:
- A `SnapshotCommitted` event IS the drift signal. Monitoring the event stream is sufficient to know when any agent's behavior changed.
- `snapshotCounts[agentId]` represents the number of behavioral changes, not the number of evaluations.
- An agent with 3 commits over a year is more stable than one with 50 commits in a month.

### Encrypted Storage with Public Hashes

The `snapshotHash` MUST be a deterministic hash (SHA-256 RECOMMENDED) of the behavioral evaluation data. The raw data itself SHOULD be encrypted and stored off-chain (IPFS RECOMMENDED), with the CID passed as `encryptedDataUri`.

A verifier can confirm chain integrity without reading the underlying data. The hash proves the data existed at commit time; the chain proves the ordering was never altered.

### Community Drift Flagging

Any address MAY call `flagDrift` to annotate a specific snapshot index with a reason string. The contract MUST verify the `snapshotIndex` is valid (less than `snapshotCounts[agentId]`). This creates a public, permissionless annotation layer on top of the behavioral chain.

## Rationale

### Why hash chaining?

A simple mapping of `agentId → latestHash` would prove current state but not history. Hash chaining provides:

- **Tamper-proof ordering:** Altering any historical snapshot invalidates all subsequent hashes.
- **Incremental verification:** A verifier only needs to check that hash N-1 matches, then inspect hash N.
- **Full reconstructability:** The complete behavioral history can be reconstructed from events alone.

### Why commit-on-change, not commit-on-schedule?

Scheduled commits (e.g., every hour) waste gas when behavior hasn't changed and create noise in the event stream. Commit-on-change means:

- **Gas efficiency:** No change = no commit = no gas.
- **Event = signal:** Every `SnapshotCommitted` event is a confirmed behavioral change. The event stream is a clean signal, not periodic noise.
- **Chain length = volatility:** `snapshotCounts` is a free volatility metric. Shorter chains indicate greater stability.

### Why encrypted data with public hashes?

Raw behavioral metrics (request timing, error rates, model parameters) are sensitive. Publishing them on-chain would expose competitive intelligence and attack surfaces. Hashing provides proof of existence and ordering without revealing contents. Verifiers can confirm chain integrity without reading the evaluation data.

### Why ERC-8004 owner authorization?

Anchoring to `ownerOf(agentId)` from the ERC-8004 Identity Registry ensures that only the registered agent owner can commit snapshots. This prevents:

- Unauthorized parties from polluting an agent's behavioral chain.
- Fork attacks where a third party creates a competing chain for an agent they don't own.

### Why community drift flagging?

`flagDrift` is permissionless to enable decentralized monitoring. Any observer who detects suspicious behavior (via the public event stream) can flag it without needing special permissions. Flags are annotations, not state changes — they don't affect the chain itself.

## Backwards Compatibility

This EIP is fully composable with ERC-8004. It does not modify the Identity Registry, Reputation Registry, or Validation Registry. Agents without behavioral chains continue to function normally — the BehaviorSnapshotRegistry is opt-in.

The extension reads from the ERC-8004 Identity Registry (`ownerOf`) but never writes to it. No changes to existing ERC-8004 contracts are required.

## Reference Implementation

A complete reference implementation is available at [github.com/drewM33/BehaviorChain](https://github.com/drewM33/BehaviorChain) consisting of:

- `@behaviorchain/contracts` — Solidity implementation deployed to Base Sepolia and Base mainnet
- `@behaviorchain/sdk` — TypeScript SDK with commit-on-change logic and chain verification
- `@behaviorchain/drift` — Real-time drift detection engine with severity classification
- `@behaviorchain/pipeline` — Valiron integration pipeline with webhook listener and trust signal endpoint
- `@behaviorchain/dashboard` — React dashboard with API server for chain visualization and drift monitoring

## Security Considerations

### Chain fork attacks

The `previousHash` enforcement prevents chain forking. An attacker who controls the agent owner address could theoretically create a new chain by resetting the agent's identity, but this would be visible as a new genesis event and would not erase the historical chain (events are immutable).

### Snapshot hash manipulation

If the behavioral evaluation system is compromised, it could produce incorrect `snapshotHash` values. This EIP does not validate the contents of snapshots — it only guarantees ordering and continuity. Verifiers should use the hash chain in conjunction with the ERC-8004 Reputation Registry for complete trust assessment.

### Gas griefing

An agent owner could spam `commitSnapshot` to inflate `snapshotCounts`. However, commit-on-change semantics make this self-defeating: high chain length is a negative stability signal. Verifiers should interpret high commit frequency as a warning indicator.

### Privacy of encrypted data

The `encryptedDataUri` field points to encrypted off-chain data. If the encryption key is compromised, the behavioral evaluation data becomes public. Implementations SHOULD use agent-specific encryption keys and SHOULD rotate keys periodically.

### Stale chains

An agent that stops being evaluated will have a stale chain — the `lastCommits` timestamp will fall behind. Off-chain monitoring systems SHOULD flag agents whose chains have not been updated within a configurable threshold.

## Copyright

Copyright and related rights waived via [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
