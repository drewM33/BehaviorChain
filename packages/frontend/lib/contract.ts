import { createPublicClient, http, type Hex } from "viem";
import { base, baseSepolia } from "viem/chains";
import { getNetworkConfig, BASE_SEPOLIA_CONTRACT, BASE_MAINNET_CONTRACT } from "@behaviorchain/sdk";

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "84532");
const networkConfig = getNetworkConfig(CHAIN_ID);
export const activeChain = CHAIN_ID === 8453 ? base : baseSepolia;

const SNAPSHOT_REGISTRY_FALLBACK: Record<number, string> = {
  84532: BASE_SEPOLIA_CONTRACT,
  8453: BASE_MAINNET_CONTRACT,
};

export const BEHAVIOR_SNAPSHOT_REGISTRY =
  (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as Hex) ??
  (SNAPSHOT_REGISTRY_FALLBACK[CHAIN_ID] || BASE_SEPOLIA_CONTRACT);

export const registryAbi = [
  {
    inputs: [{ name: "agentId", type: "uint256" }],
    name: "getChainHead",
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "agentId", type: "uint256" }],
    name: "getSnapshotCount",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "agentId", type: "uint256" }],
    name: "getLastCommitTimestamp",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "hashes", type: "bytes32[]" },
    ],
    name: "verifyChainContinuity",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "agentId", type: "uint256" }],
    name: "chainHeads",
    outputs: [{ name: "headHash", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "agentId", type: "uint256" }],
    name: "snapshotCounts",
    outputs: [{ name: "snapshotCount", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "agentId", type: "uint256" }],
    name: "lastCommits",
    outputs: [{ name: "lastCommitTimestamp", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "agentId", type: "uint256" },
      { indexed: true, name: "snapshotIndex", type: "uint256" },
      { indexed: false, name: "snapshotHash", type: "bytes32" },
      { indexed: false, name: "previousHash", type: "bytes32" },
      { indexed: false, name: "timestamp", type: "uint256" },
      { indexed: false, name: "encryptedDataUri", type: "string" },
    ],
    name: "SnapshotCommitted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "agentId", type: "uint256" },
      { indexed: true, name: "snapshotIndex", type: "uint256" },
      { indexed: true, name: "flagger", type: "address" },
      { indexed: false, name: "reason", type: "string" },
    ],
    name: "DriftFlagged",
    type: "event",
  },
] as const;

export { networkConfig, CHAIN_ID };

export const publicClient = createPublicClient({
  chain: activeChain,
  transport: http(
    process.env.NEXT_PUBLIC_RPC_URL ?? networkConfig.rpcUrl
  ),
});
