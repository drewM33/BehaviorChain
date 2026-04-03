import path from 'path';
import { ethers } from 'ethers';
import { config as dotenvConfig } from 'dotenv';

dotenvConfig({ path: path.resolve(__dirname, '..', '.env') });
dotenvConfig({ path: path.resolve(__dirname, '..', 'packages', 'contracts', '.env') });

const REQUIRED_ENV = [
  'BEHAVIORCHAIN_RPC_URL',
  'BEHAVIORCHAIN_PRIVATE_KEY',
  'BEHAVIORCHAIN_CONTRACT_ADDRESS',
] as const;

const REGISTRY_ABI = [
  'function commitSnapshot(uint256 agentId, bytes32 snapshotHash, bytes32 previousHash, string calldata encryptedDataUri) external',
  'function getChainHead(uint256 agentId) external view returns (bytes32)',
  'function getSnapshotCount(uint256 agentId) external view returns (uint256)',
  'event SnapshotCommitted(uint256 indexed agentId, uint256 indexed snapshotIndex, bytes32 snapshotHash, bytes32 previousHash, uint256 timestamp, string encryptedDataUri)',
];

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
    agentId: process.env.AGENT_ID ?? '3458',
  };
}

function basescanLink(txHash: string): string {
  return `https://sepolia.basescan.org/tx/${txHash}`;
}

function snapshotHash(index: number): string {
  return ethers.keccak256(ethers.toUtf8Bytes(`behaviorchain-demo-snapshot-${index}`));
}

async function main() {
  const env = loadEnv();
  const agentId = BigInt(env.agentId);

  console.log('═══════════════════════════════════════════════');
  console.log('  BehaviorChain Direct Seed (no SDK/Valiron)');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Agent ID:  ${env.agentId}`);
  console.log(`  Contract:  ${env.contractAddress}`);
  console.log(`  RPC:       ${env.rpcUrl.replace(/\/[^/]{8,}$/, '/***')}`);
  console.log('');

  const provider = new ethers.JsonRpcProvider(env.rpcUrl);
  const signer = new ethers.Wallet(env.privateKey, provider);
  const signerAddr = await signer.getAddress();
  console.log(`  Wallet:    ${signerAddr}`);
  console.log('');

  const registry = new ethers.Contract(env.contractAddress, REGISTRY_ABI, signer);

  const existingCount = Number(await registry.getSnapshotCount(agentId));
  console.log(`  Existing snapshots: ${existingCount}`);

  let previousHash: string;
  let startIndex: number;

  if (existingCount > 0) {
    previousHash = await registry.getChainHead(agentId);
    startIndex = existingCount + 1;
    console.log(`  Chain head: ${previousHash}`);
    console.log(`  Continuing from snapshot #${startIndex}\n`);
  } else {
    previousHash = ethers.ZeroHash;
    startIndex = 1;
    console.log('  No existing chain — starting from genesis\n');
  }

  const txHashes: string[] = [];

  for (let i = 0; i < 3; i++) {
    const idx = startIndex + i;
    const hash = snapshotHash(idx);
    const isGenesis = previousHash === ethers.ZeroHash;
    const label = isGenesis ? `Snapshot #${idx} (genesis)` : `Snapshot #${idx}`;

    console.log(`[${i + 1}/3] Committing ${label}…`);
    console.log(`        hash:         ${hash}`);
    console.log(`        previousHash: ${previousHash}`);

    const tx = await registry.commitSnapshot(agentId, hash, previousHash, '');
    console.log(`        tx sent:      ${tx.hash}`);
    console.log(`        waiting for confirmation…`);

    const receipt = await tx.wait();
    console.log(`        confirmed in block ${receipt.blockNumber}`);
    console.log(`        BaseScan:     ${basescanLink(tx.hash)}`);
    console.log('');

    txHashes.push(tx.hash);

    // The tx succeeded, so this committed hash is now the canonical chain head.
    previousHash = hash;
    console.log(`        next prev:    ${previousHash}`);

    if (i < 2) {
      console.log('        waiting 3 s before next commit…\n');
      await new Promise((r) => setTimeout(r, 3_000));
    } else {
      console.log('');
    }
  }

  // ── Verify chain via events ──────────────────────────────────────────
  console.log('[✓] Verifying chain via SnapshotCommitted events…');
  const filter = registry.filters.SnapshotCommitted(agentId);
  const latestBlock = await provider.getBlockNumber();
  const fromBlock = Math.max(0, latestBlock - 9_999);
  const events = await registry.queryFilter(filter, fromBlock, latestBlock);

  let chainValid = true;
  let expectedPrev = ethers.ZeroHash;

  for (let i = 0; i < events.length; i++) {
    const log = events[i] as ethers.EventLog;
    const evtHash: string = log.args.snapshotHash;
    const evtPrev: string = log.args.previousHash;
    const evtIdx: bigint = log.args.snapshotIndex;

    const linked = evtPrev === expectedPrev;
    const status = linked ? '✓' : '✗ BROKEN';
    console.log(`  [${evtIdx}] ${status}  hash=${evtHash.slice(0, 18)}…  prev=${evtPrev.slice(0, 18)}…`);

    if (!linked) chainValid = false;
    expectedPrev = evtHash;
  }

  console.log(`\n  Chain integrity: ${chainValid ? '✓ valid' : '✗ BROKEN'}`);
  console.log(`  Total snapshots on-chain: ${events.length}`);

  // ── Summary ──────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════');
  console.log('  Summary');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Contract:       ${env.contractAddress}`);
  console.log(`  Agent ID:       ${env.agentId}`);
  console.log(`  New commits:    ${txHashes.length}`);
  txHashes.forEach((h, i) => {
    console.log(`    [${i + 1}] ${basescanLink(h)}`);
  });
  console.log('═══════════════════════════════════════════════');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
