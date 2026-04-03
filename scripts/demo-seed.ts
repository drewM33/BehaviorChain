import path from 'path';
import { ethers } from 'ethers';
import { config as dotenvConfig } from 'dotenv';
import { ValironSDK } from '@valiron/sdk';
import { BehaviorChainSDK, type CommitResult } from '@behaviorchain/sdk';

// Load .env from root first; vars already set won't be overwritten by the fallback
dotenvConfig({ path: path.resolve(__dirname, '..', '.env') });
dotenvConfig({ path: path.resolve(__dirname, '..', 'packages', 'contracts', '.env') });

const AGENT_ID = process.env.AGENT_ID ?? '3458';

const ERC8004_IDENTITY_ABI = [
  'function ownerOf(uint256 agentId) view returns (address)',
] as const;

const BEHAVIOR_REGISTRY_ABI_MINI = [
  'function identityRegistry() view returns (address)',
] as const;

const REQUIRED_ENV = [
  'BEHAVIORCHAIN_RPC_URL',
  'BEHAVIORCHAIN_PRIVATE_KEY',
  'BEHAVIORCHAIN_CONTRACT_ADDRESS',
] as const;

function loadEnv() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`Missing env vars: ${missing.join(', ')}`);
    console.error('Set them in .env at the repo root or packages/contracts/.env');
    process.exit(1);
  }
  return {
    rpcUrl: process.env.BEHAVIORCHAIN_RPC_URL!,
    privateKey: process.env.BEHAVIORCHAIN_PRIVATE_KEY!,
    contractAddress: process.env.BEHAVIORCHAIN_CONTRACT_ADDRESS!,
  };
}

function basescanLink(txHash: string): string {
  return `https://sepolia.basescan.org/tx/${txHash}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function logCommit(label: string, result: CommitResult): void {
  if (result.committed) {
    const hash = result.tx!.hash;
    console.log(`  ✓ ${label}: committed`);
    console.log(`    tx:   ${hash}`);
    console.log(`    link: ${basescanLink(hash)}`);
    console.log(`    snapshotHash: ${result.snapshotHash}`);
  } else {
    console.log(`  ○ ${label}: hash unchanged — no commit needed`);
    console.log(`    snapshotHash: ${result.snapshotHash}`);
  }
}

async function main() {
  const env = loadEnv();

  console.log('═══════════════════════════════════════════════');
  console.log('  BehaviorChain Demo Seed');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Agent ID:  ${AGENT_ID}`);
  console.log(`  Contract:  ${env.contractAddress}`);
  console.log(`  RPC:       ${env.rpcUrl.replace(/\/[^/]{8,}$/, '/***')}`);
  console.log('');

  const valiron = new ValironSDK({ chain: 'base' });
  const sdk = new BehaviorChainSDK({
    rpcUrl: env.rpcUrl,
    privateKey: env.privateKey,
    contractAddress: env.contractAddress,
    valiron: valiron as any,
  });

  // ── Pre-flight: verify agent ownership ──────────────────────────────
  const provider = new ethers.JsonRpcProvider(env.rpcUrl);
  const signer = new ethers.Wallet(env.privateKey, provider);
  const signerAddr = await signer.getAddress();
  console.log(`  Wallet:    ${signerAddr}\n`);

  const registry = new ethers.Contract(env.contractAddress, BEHAVIOR_REGISTRY_ABI_MINI, provider);
  const identityAddr: string = await registry.identityRegistry();
  const identity = new ethers.Contract(identityAddr, ERC8004_IDENTITY_ABI, provider);

  try {
    const owner: string = await identity.ownerOf(BigInt(AGENT_ID));
    if (owner.toLowerCase() !== signerAddr.toLowerCase()) {
      console.error(`\n✗ Agent ${AGENT_ID} is owned by ${owner}, not your wallet ${signerAddr}`);
      console.error('  Change AGENT_ID in the script to an agent you own, or use that wallet\'s private key.');
      process.exit(1);
    }
    console.log(`  Ownership: ✓ agent ${AGENT_ID} owned by your wallet\n`);
  } catch {
    console.error(`\n✗ Agent ${AGENT_ID} does not exist in the identity registry at ${identityAddr}`);
    console.error('  The ERC-8004 registry on Base Sepolia has no token with that ID.');
    console.error('  Either:');
    console.error('    1. Register/mint agent 25459 in the identity registry first, or');
    console.error('    2. Change AGENT_ID in scripts/demo-seed.ts to an agent ID you own.');
    process.exit(1);
  }

  const txHashes: string[] = [];

  // ── Snapshot 1: genesis commit ──────────────────────────────────────
  console.log('[1/3] Committing genesis snapshot…');
  const r1 = await sdk.commitIfChanged(AGENT_ID);
  logCommit('Snapshot 1', r1);
  if (r1.committed) txHashes.push(r1.tx!.hash);

  // ── Wait, re-evaluate, snapshot 2 ──────────────────────────────────
  console.log('\n      Waiting 10 s before re-evaluation…');
  await sleep(10_000);

  console.log('[2/3] Triggering sandbox re-evaluation…');
  const sandbox1 = await valiron.triggerSandboxTest(AGENT_ID);
  console.log(`      Sandbox result: score=${sandbox1.valironScore}, tier=${sandbox1.tier}, risk=${sandbox1.riskLevel}`);

  console.log('      Waiting 5 s for evaluation to settle…');
  await sleep(5_000);

  console.log('      Committing snapshot 2…');
  const r2 = await sdk.commitIfChanged(AGENT_ID);
  logCommit('Snapshot 2', r2);
  if (r2.committed) txHashes.push(r2.tx!.hash);

  // ── Wait, re-evaluate, snapshot 3 ──────────────────────────────────
  console.log('\n      Waiting 10 s before re-evaluation…');
  await sleep(10_000);

  console.log('[3/3] Triggering sandbox re-evaluation…');
  const sandbox2 = await valiron.triggerSandboxTest(AGENT_ID);
  console.log(`      Sandbox result: score=${sandbox2.valironScore}, tier=${sandbox2.tier}, risk=${sandbox2.riskLevel}`);

  console.log('      Waiting 5 s for evaluation to settle…');
  await sleep(5_000);

  console.log('      Committing snapshot 3…');
  const r3 = await sdk.commitIfChanged(AGENT_ID);
  logCommit('Snapshot 3', r3);
  if (r3.committed) txHashes.push(r3.tx!.hash);

  // ── Verify chain integrity ─────────────────────────────────────────
  console.log('\n[✓] Verifying on-chain hash-chain integrity…');
  const verification = await sdk.verifyChain(AGENT_ID);
  console.log(`    valid:       ${verification.valid}`);
  console.log(`    chainLength: ${verification.chainLength}`);
  if (!verification.valid) {
    console.log(`    brokenAt:    ${verification.brokenAt}`);
  }

  // ── Summary ────────────────────────────────────────────────────────
  const snapshotCount = await sdk.getSnapshotCount(AGENT_ID);

  console.log('\n═══════════════════════════════════════════════');
  console.log('  Summary');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Contract:       ${env.contractAddress}`);
  console.log(`  Agent ID:       ${AGENT_ID}`);
  console.log(`  Snapshots:      ${snapshotCount}`);
  console.log(`  Txs committed:  ${txHashes.length}`);
  txHashes.forEach((h, i) => {
    console.log(`    [${i + 1}] ${basescanLink(h)}`);
  });
  console.log('═══════════════════════════════════════════════');

  await valiron.dispose();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
