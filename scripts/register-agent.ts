import path from 'path';
import fs from 'fs';
import { ethers } from 'ethers';
import { config as dotenvConfig } from 'dotenv';
import { getNetworkConfig, explorerTxUrl } from '@behaviorchain/sdk';

dotenvConfig({ path: path.resolve(__dirname, '..', '.env') });
dotenvConfig({ path: path.resolve(__dirname, '..', 'packages', 'contracts', '.env') });

const chainId = Number(process.env.BEHAVIORCHAIN_CHAIN_ID ?? '84532');
const networkConfig = getNetworkConfig(chainId);

const IDENTITY_REGISTRY_BY_CHAIN: Record<number, string> = {
  84532: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
  8453: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
};
const IDENTITY_REGISTRY = IDENTITY_REGISTRY_BY_CHAIN[chainId];
if (!IDENTITY_REGISTRY) {
  console.error(`Unsupported chain ID ${chainId}. Supported: ${Object.keys(IDENTITY_REGISTRY_BY_CHAIN).join(', ')}`);
  process.exit(1);
}

const IDENTITY_REGISTRY_ABI = [
  'function register(string agentURI) returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'event Registered(uint256 indexed agentId, string agentURI, address indexed owner)',
];

const AGENT_CARD = {
  name: 'BehaviorChain Demo Agent',
  description: 'Demo agent for BehaviorChain hackathon — tamper-proof behavioral identity',
  image: '',
  endpoints: {},
  trustModels: ['behaviorchain'],
};

function buildTokenURI(): string {
  const json = JSON.stringify(AGENT_CARD);
  const b64 = Buffer.from(json).toString('base64');
  return `data:application/json;base64,${b64}`;
}

async function main() {
  const rpcUrl = process.env.BEHAVIORCHAIN_RPC_URL;
  const privateKey = process.env.BEHAVIORCHAIN_PRIVATE_KEY;

  if (!rpcUrl || !privateKey) {
    console.error('Missing BEHAVIORCHAIN_RPC_URL or BEHAVIORCHAIN_PRIVATE_KEY in .env');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const address = await wallet.getAddress();

  console.log('═══════════════════════════════════════════════');
  console.log('  ERC-8004 Agent Registration');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Registry: ${IDENTITY_REGISTRY}`);
  console.log(`  Wallet:   ${address}`);
  console.log('');

  const balance = await provider.getBalance(address);
  console.log(`  Balance:  ${ethers.formatEther(balance)} ETH`);
  if (balance === 0n) {
    console.error(`\n✗ Wallet has no ETH. Fund it with ${networkConfig.name} ETH first.`);
    process.exit(1);
  }

  const tokenURI = buildTokenURI();
  console.log(`  TokenURI: ${tokenURI.slice(0, 60)}…`);
  console.log('');

  const registry = new ethers.Contract(IDENTITY_REGISTRY, IDENTITY_REGISTRY_ABI, wallet);

  console.log('Sending register() transaction…');
  const tx = await registry.register(tokenURI);
  console.log(`  tx hash:  ${tx.hash}`);
  console.log('  Waiting for confirmation…');

  const receipt = await tx.wait();

  const transferTopic = ethers.id('Transfer(address,address,uint256)');
  const transferLog = receipt.logs.find(
    (log: ethers.Log) =>
      log.address.toLowerCase() === IDENTITY_REGISTRY.toLowerCase() &&
      log.topics[0] === transferTopic,
  );

  if (!transferLog) {
    console.error('✗ Could not find Transfer event in receipt');
    console.log('  Logs:', JSON.stringify(receipt.logs, null, 2));
    process.exit(1);
  }

  const agentId = BigInt(transferLog.topics[3]).toString();

  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('  Registration Complete');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Agent ID:  ${agentId}`);
  console.log(`  Tx Hash:   ${tx.hash}`);
  console.log(`  BaseScan:  ${explorerTxUrl(chainId, tx.hash)}`);
  console.log('═══════════════════════════════════════════════');

  const rootEnv = path.resolve(__dirname, '..', '.env');
  let envContent = '';
  if (fs.existsSync(rootEnv)) {
    envContent = fs.readFileSync(rootEnv, 'utf-8');
  }

  if (envContent.includes('AGENT_ID=')) {
    envContent = envContent.replace(/^AGENT_ID=.*$/m, `AGENT_ID=${agentId}`);
  } else {
    envContent = envContent.trimEnd() + (envContent ? '\n' : '') + `AGENT_ID=${agentId}\n`;
  }
  fs.writeFileSync(rootEnv, envContent, 'utf-8');
  console.log(`\n  Wrote AGENT_ID=${agentId} to ${rootEnv}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
