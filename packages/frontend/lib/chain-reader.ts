import {
  publicClient,
  registryAbi,
  BEHAVIOR_SNAPSHOT_REGISTRY,
} from "./contract";

export interface SnapshotEvent {
  agentId: bigint;
  snapshotIndex: bigint;
  snapshotHash: string;
  previousHash: string;
  timestamp: bigint;
  encryptedDataUri: string;
}

export interface DriftFlagEvent {
  agentId: bigint;
  snapshotIndex: bigint;
  flagger: string;
  reason: string;
}

export interface AgentChainData {
  chainHead: string;
  snapshotCount: number;
  lastCommitTimestamp: number;
  snapshots: SnapshotEvent[];
  driftFlags: DriftFlagEvent[];
}

const DEPLOYMENT_BLOCK = BigInt(
  process.env.NEXT_PUBLIC_DEPLOYMENT_BLOCK ?? "0"
);

export async function getAgentChainData(
  agentId: bigint
): Promise<AgentChainData> {
  const [chainHead, snapshotCount, lastCommitTimestamp, snapshots, driftFlags] =
    await Promise.all([
      publicClient.readContract({
        address: BEHAVIOR_SNAPSHOT_REGISTRY as `0x${string}`,
        abi: registryAbi,
        functionName: "getChainHead",
        args: [agentId],
      }),
      publicClient.readContract({
        address: BEHAVIOR_SNAPSHOT_REGISTRY as `0x${string}`,
        abi: registryAbi,
        functionName: "getSnapshotCount",
        args: [agentId],
      }),
      publicClient.readContract({
        address: BEHAVIOR_SNAPSHOT_REGISTRY as `0x${string}`,
        abi: registryAbi,
        functionName: "getLastCommitTimestamp",
        args: [agentId],
      }),
      getSnapshotEvents(agentId),
      getDriftFlagEvents(agentId),
    ]);

  return {
    chainHead: chainHead as string,
    snapshotCount: Number(snapshotCount),
    lastCommitTimestamp: Number(lastCommitTimestamp),
    snapshots,
    driftFlags,
  };
}

export async function getSnapshotEvents(
  agentId: bigint
): Promise<SnapshotEvent[]> {
  const logs = await publicClient.getLogs({
    address: BEHAVIOR_SNAPSHOT_REGISTRY as `0x${string}`,
    event: {
      type: "event",
      name: "SnapshotCommitted",
      inputs: [
        { indexed: true, name: "agentId", type: "uint256" },
        { indexed: true, name: "snapshotIndex", type: "uint256" },
        { indexed: false, name: "snapshotHash", type: "bytes32" },
        { indexed: false, name: "previousHash", type: "bytes32" },
        { indexed: false, name: "timestamp", type: "uint256" },
        { indexed: false, name: "encryptedDataUri", type: "string" },
      ],
    },
    args: { agentId },
    fromBlock: DEPLOYMENT_BLOCK,
    toBlock: "latest",
  });

  return logs.map((log) => ({
    agentId: log.args.agentId!,
    snapshotIndex: log.args.snapshotIndex!,
    snapshotHash: log.args.snapshotHash as string,
    previousHash: log.args.previousHash as string,
    timestamp: log.args.timestamp!,
    encryptedDataUri: log.args.encryptedDataUri as string,
  }));
}

export async function getDriftFlagEvents(
  agentId: bigint
): Promise<DriftFlagEvent[]> {
  const logs = await publicClient.getLogs({
    address: BEHAVIOR_SNAPSHOT_REGISTRY as `0x${string}`,
    event: {
      type: "event",
      name: "DriftFlagged",
      inputs: [
        { indexed: true, name: "agentId", type: "uint256" },
        { indexed: true, name: "snapshotIndex", type: "uint256" },
        { indexed: true, name: "flagger", type: "address" },
        { indexed: false, name: "reason", type: "string" },
      ],
    },
    args: { agentId },
    fromBlock: DEPLOYMENT_BLOCK,
    toBlock: "latest",
  });

  return logs.map((log) => ({
    agentId: log.args.agentId!,
    snapshotIndex: log.args.snapshotIndex!,
    flagger: log.args.flagger as string,
    reason: log.args.reason as string,
  }));
}

export async function verifyChainIntegrity(
  agentId: bigint,
  hashes: `0x${string}`[]
): Promise<boolean> {
  if (hashes.length === 0) return true;
  const result = await publicClient.readContract({
    address: BEHAVIOR_SNAPSHOT_REGISTRY as `0x${string}`,
    abi: registryAbi,
    functionName: "verifyChainContinuity",
    args: [agentId, hashes],
  });
  return result as boolean;
}
