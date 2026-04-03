/**
 * Integration tests against the deployed BehaviorSnapshotRegistry on Base Sepolia.
 *
 * These tests exercise read-only contract calls and event queries against the
 * live deployment at 0xDe27DF9DA6BaD0b172F3F1b48CEe818dFE4487CD.
 *
 * To run write tests (commitIfChanged), the signer must be the owner of the
 * target agentId in the ERC-8004 Identity Registry.
 *
 * Environment variables (loaded from packages/contracts/.env):
 *   BEHAVIORCHAIN_RPC_URL
 *   BEHAVIORCHAIN_PRIVATE_KEY
 *   BEHAVIORCHAIN_CONTRACT_ADDRESS
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { ethers } from 'ethers';
import { BehaviorChainSDK } from '../src/sdk.js';
import { BEHAVIOR_SNAPSHOT_REGISTRY_ABI } from '../src/abi.js';
import { ZERO_BYTES32 } from '../src/types.js';
import type { IValironSDK } from '../src/types.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

const CONTRACT_ADDRESS = '0xDe27DF9DA6BaD0b172F3F1b48CEe818dFE4487CD';
const RPC_URL = 'https://sepolia.base.org';

async function getRecentFromBlock(provider: ethers.JsonRpcProvider): Promise<number> {
  const current = await provider.getBlockNumber();
  return Math.max(0, current - 5_000);
}

function loadEnv(): Record<string, string> {
  const envPath = path.resolve(__dirname, '../../contracts/.env');
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf-8');
  const vars: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    vars[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
  }
  return vars;
}

const env = loadEnv();
const rpcUrl = env.BEHAVIORCHAIN_RPC_URL || RPC_URL;
const privateKey = env.BEHAVIORCHAIN_PRIVATE_KEY;
const contractAddress = env.BEHAVIORCHAIN_CONTRACT_ADDRESS || CONTRACT_ADDRESS;

const stubValiron: IValironSDK = {
  getAgentSnapshot: async () => {
    throw new Error('stub: not used in integration read tests');
  },
  getAgentProfile: async () => {
    throw new Error('stub: not used in integration read tests');
  },
};

describe('Integration — Base Sepolia read-only', () => {
  let provider: ethers.JsonRpcProvider;
  let contract: ethers.Contract;

  beforeAll(() => {
    provider = new ethers.JsonRpcProvider(rpcUrl);
    contract = new ethers.Contract(
      contractAddress,
      BEHAVIOR_SNAPSHOT_REGISTRY_ABI,
      provider,
    );
  });

  it('connects to the deployed contract', async () => {
    const code = await provider.getCode(contractAddress);
    expect(code).not.toBe('0x');
    expect(code.length).toBeGreaterThan(10);
  });

  it('reads identityRegistry address', async () => {
    const registry = await contract.identityRegistry();
    expect(registry).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it('getChainHead returns bytes32 for uninitialized agent', async () => {
    const head = await contract.getChainHead(999999);
    expect(head).toBe(ZERO_BYTES32);
  });

  it('getSnapshotCount returns 0 for uninitialized agent', async () => {
    const count = await contract.getSnapshotCount(999999);
    expect(Number(count)).toBe(0);
  });
});

describe.skipIf(!privateKey)('Integration — Base Sepolia SDK write operations', () => {
  let sdk: BehaviorChainSDK;
  const testAgentId = '99999';

  beforeAll(async () => {
    const tempProvider = new ethers.JsonRpcProvider(rpcUrl);
    const fromBlock = await getRecentFromBlock(tempProvider);
    sdk = new BehaviorChainSDK({
      rpcUrl,
      privateKey: privateKey!,
      contractAddress,
      valiron: stubValiron,
      fromBlock,
    });
  });

  it('getChainHead returns ZERO_BYTES32 for fresh agent via SDK', async () => {
    const head = await sdk.getChainHead(testAgentId);
    expect(head).toBe(ZERO_BYTES32);
  });

  it('getSnapshotCount returns 0 for fresh agent via SDK', async () => {
    const count = await sdk.getSnapshotCount(testAgentId);
    expect(count).toBe(0);
  });

  it('verifyChain returns valid for an agent with no commits', async () => {
    const result = await sdk.verifyChain(testAgentId);
    expect(result.valid).toBe(true);
    expect(result.chainLength).toBe(0);
  });

  it('getSnapshotEvents returns empty array for fresh agent', async () => {
    const events = await sdk.getSnapshotEvents(testAgentId);
    expect(events).toEqual([]);
  });
});
