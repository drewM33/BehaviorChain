import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { networkConfig } from '../config/network';

const IDENTITY_REGISTRY = '0x8004A818BFB912233c491871b3d84c89A494BD9e';
const SNAPSHOT_REGISTRY = process.env.BEHAVIORCHAIN_CONTRACT_ADDRESS ?? '0xDe27DF9DA6BaD0b172F3F1b48CEe818dFE4487CD';
const BASESCAN_TX = `${networkConfig.explorerUrl}/tx/`;

const BALANCE_OF_ABI = ['function balanceOf(address owner) view returns (uint256)'];
const TOKEN_BY_INDEX_ABI = ['function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)'];

const IDENTITY_REGISTRY_ABI = [
  'function register(string agentURI) returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
];

const SNAPSHOT_REGISTRY_ABI = [
  'function commitSnapshot(uint256 agentId, bytes32 snapshotHash, bytes32 previousHash, string encryptedDataUri)',
  'function getChainHead(uint256 agentId) view returns (bytes32)',
  'event SnapshotCommitted(uint256 indexed agentId, uint256 indexed snapshotIndex, bytes32 snapshotHash, bytes32 previousHash, uint256 timestamp, string encryptedDataUri)',
];

const ZERO_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000';

type StepStatus = 'pending' | 'active' | 'complete' | 'error';

interface StepState {
  status: StepStatus;
  error?: string;
}

function getEthereum(): any {
  return (window as any).ethereum;
}

async function ensureCorrectChain(): Promise<void> {
  const ethereum = getEthereum();
  const chainId = await ethereum.request({ method: 'eth_chainId' });
  if (chainId === networkConfig.chainIdHex) return;

  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: networkConfig.chainIdHex }],
    });
  } catch (switchError: any) {
    if (switchError.code === 4902) {
      await ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: networkConfig.chainIdHex,
          chainName: networkConfig.name,
          nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
          rpcUrls: [networkConfig.rpcUrl],
          blockExplorerUrls: [networkConfig.explorerUrl],
        }],
      });
    } else {
      throw switchError;
    }
  }
}

async function callContract(address: string, abi: string[], method: string, args: any[]): Promise<any> {
  const ethereum = getEthereum();
  const { ethers } = await import('ethers');
  const provider = new ethers.BrowserProvider(ethereum);
  const signer = await provider.getSigner();
  const contract = new ethers.Contract(address, abi, signer);
  return contract[method](...args);
}

async function readContract(address: string, abi: string[], method: string, args: any[]): Promise<any> {
  const ethereum = getEthereum();
  const { ethers } = await import('ethers');
  const provider = new ethers.BrowserProvider(ethereum);
  const contract = new ethers.Contract(address, abi, provider);
  return contract[method](...args);
}

function friendlyError(err: any): string {
  const msg = err?.shortMessage ?? err?.reason ?? err?.message ?? '';
  if (msg.includes('user rejected') || msg.includes('ACTION_REJECTED'))
    return 'Transaction cancelled — you rejected the request in your wallet.';
  if (msg.includes('insufficient funds') || msg.includes('INSUFFICIENT_FUNDS'))
    return `Transaction failed — check your ${networkConfig.name} ETH balance.`;
  if (msg.includes('nonce'))
    return 'Transaction failed — nonce conflict. Try resetting your wallet activity.';
  if (msg.includes('CALL_EXCEPTION') || msg.includes('execution reverted'))
    return `Transaction failed — the contract reverted. Check your ${networkConfig.name} ETH balance.`;
  if (msg.includes('network') || msg.includes('could not detect'))
    return `Network error — make sure you are connected to ${networkConfig.name}.`;
  if (msg.length > 120)
    return msg.slice(0, 120) + '…';
  return msg || 'Something went wrong. Please try again.';
}

function StepDot({ status }: { status: StepStatus }) {
  const base = 'w-3 h-3 rounded-full transition-all duration-300';
  if (status === 'complete') return <div className={`${base} bg-status-green scale-110`} />;
  if (status === 'active') return <div className={`${base} bg-chain ring-4 ring-chain/20 scale-125`} />;
  if (status === 'error') return <div className={`${base} bg-status-red ring-4 ring-status-red/20`} />;
  return <div className={`${base} bg-surface-border`} />;
}

function StepConnector({ complete }: { complete: boolean }) {
  return (
    <div className={`h-0.5 w-8 transition-colors duration-300 ${complete ? 'bg-status-green' : 'bg-surface-border'}`} />
  );
}

function Checkmark() {
  return (
    <svg className="w-5 h-5 text-status-green" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );
}

function Spinner() {
  return <div className="w-5 h-5 border-2 border-chain border-t-transparent rounded-full animate-spin" />;
}

function StepCard({
  step,
  title,
  status,
  error,
  children,
  onRetry,
}: {
  step: number;
  title: string;
  status: StepStatus;
  error?: string;
  children: React.ReactNode;
  onRetry?: () => void;
}) {
  const isExpanded = status === 'active' || status === 'error';

  return (
    <div
      className={`rounded-xl border transition-all duration-300 overflow-hidden ${
        status === 'complete'
          ? 'border-status-green/30 bg-status-green/5'
          : status === 'active'
            ? 'border-chain/40 bg-surface'
            : status === 'error'
              ? 'border-status-red/40 bg-surface'
              : 'border-surface-border bg-surface/50 opacity-50'
      }`}
    >
      <div className="px-6 py-4 flex items-center gap-4">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold font-mono ${
          status === 'complete'
            ? 'bg-status-green/15 text-status-green'
            : status === 'active'
              ? 'bg-chain/15 text-chain'
              : status === 'error'
                ? 'bg-status-red/15 text-status-red'
                : 'bg-surface-border/50 text-neutral-600'
        }`}>
          {status === 'complete' ? <Checkmark /> : step}
        </div>
        <h3 className={`font-semibold text-lg ${
          status === 'complete' ? 'text-status-green' : status === 'pending' ? 'text-neutral-600' : 'text-white'
        }`}>
          {title}
        </h3>
        {status === 'complete' && <span className="text-xs text-status-green font-mono ml-auto">DONE</span>}
      </div>

      {isExpanded && (
        <div className="px-6 pb-6 animate-fade-in">
          <div className="border-t border-surface-border pt-4">
            {children}
            {error && (
              <div className="mt-4 p-3 rounded-lg bg-status-red/10 border border-status-red/30">
                <p className="text-sm text-status-red">{error}</p>
                {error.includes('ETH balance') && (
                  <a
                    href="https://www.alchemy.com/faucets/base-sepolia"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-chain underline hover:text-white mt-1 inline-block"
                  >
                    Get Base Sepolia testnet ETH →
                  </a>
                )}
                {onRetry && (
                  <button
                    onClick={onRetry}
                    className="mt-2 px-3 py-1 text-xs font-medium text-white bg-status-red/20 hover:bg-status-red/30 border border-status-red/40 rounded transition-colors block"
                  >
                    Retry
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function GetStarted() {
  const navigate = useNavigate();
  const wallet = useWallet();

  const [steps, setSteps] = useState<StepState[]>([
    { status: 'active' },
    { status: 'pending' },
    { status: 'pending' },
    { status: 'pending' },
  ]);

  const [agentId, setAgentId] = useState<number | null>(null);
  const [registerTxHash, setRegisterTxHash] = useState<string | null>(null);
  const [snapshotTxHash, setSnapshotTxHash] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const walletAddress = wallet.address;
  const balance = wallet.balance;

  const updateStep = useCallback((index: number, update: Partial<StepState>) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...update } : s)));
  }, []);

  const activateStep = useCallback((index: number) => {
    setSteps((prev) =>
      prev.map((s, i) => {
        if (i === index) return { status: 'active' as StepStatus };
        if (i < index) return { ...s, status: 'complete' as StepStatus };
        return s;
      }),
    );
  }, []);

  const resetFlow = useCallback(() => {
    setAgentId(null);
    setRegisterTxHash(null);
    setSnapshotTxHash(null);
    setLoading(false);
    setSteps([
      { status: 'active' },
      { status: 'pending' },
      { status: 'pending' },
      { status: 'pending' },
    ]);
  }, []);

  const handleDisconnect = useCallback(() => {
    wallet.disconnect();
    resetFlow();
  }, [wallet, resetFlow]);

  const handleSwitchWallet = useCallback(async () => {
    wallet.disconnect();
    resetFlow();
    try {
      await wallet.connect();
    } catch {
      // User cancelled the new connection prompt
    }
  }, [wallet, resetFlow]);

  useEffect(() => {
    if (!walletAddress && steps[0].status === 'complete') {
      resetFlow();
    }
  }, [walletAddress, steps, resetFlow]);

  const connectWallet = useCallback(async () => {
    try {
      setLoading(true);
      updateStep(0, { error: undefined });

      await wallet.connect();

      const ethereum = getEthereum();
      const accounts: string[] = await ethereum.request({ method: 'eth_accounts' });
      if (accounts.length === 0) throw new Error('No account connected.');
      const connectedAddr = accounts[0];

      try {
        const balResult = await readContract(IDENTITY_REGISTRY, BALANCE_OF_ABI, 'balanceOf', [connectedAddr]);
        if (Number(balResult) > 0) {
          const existingId = await readContract(IDENTITY_REGISTRY, TOKEN_BY_INDEX_ABI, 'tokenOfOwnerByIndex', [connectedAddr, 0]);
          const id = Number(existingId);
          setAgentId(id);
          setSteps([
            { status: 'complete' },
            { status: 'complete' },
            { status: 'active' },
            { status: 'pending' },
          ]);
          return;
        }
      } catch {
        // Registry call failed — proceed to register a new agent
      }

      activateStep(1);
    } catch (err: any) {
      updateStep(0, { status: 'error', error: friendlyError(err) });
    } finally {
      setLoading(false);
    }
  }, [wallet, updateStep, activateStep]);

  const registerAgent = useCallback(async () => {
    try {
      setLoading(true);
      updateStep(1, { error: undefined });
      await ensureCorrectChain();

      const agentCard = {
        name: 'BehaviorChain Agent',
        description: 'Registered via BehaviorChain dashboard',
      };
      const tokenURI = `data:application/json;base64,${btoa(JSON.stringify(agentCard))}`;

      const tx = await callContract(IDENTITY_REGISTRY, IDENTITY_REGISTRY_ABI, 'register', [tokenURI]);
      setRegisterTxHash(tx.hash);

      const receipt = await tx.wait();
      const { ethers } = await import('ethers');
      const transferTopic = ethers.id('Transfer(address,address,uint256)');
      const transferLog = receipt.logs.find(
        (log: any) =>
          log.address.toLowerCase() === IDENTITY_REGISTRY.toLowerCase() &&
          log.topics[0] === transferTopic,
      );

      if (!transferLog) throw new Error('Registration succeeded but could not read the agent ID from the transaction. Check BaseScan for details.');

      const newAgentId = Number(BigInt(transferLog.topics[3]));
      setAgentId(newAgentId);
      activateStep(2);
    } catch (err: any) {
      updateStep(1, { status: 'error', error: friendlyError(err) });
    } finally {
      setLoading(false);
    }
  }, [updateStep, activateStep]);

  const skipWorldId = useCallback(() => {
    activateStep(3);
  }, [activateStep]);

  const commitGenesis = useCallback(async () => {
    if (agentId === null) return;
    try {
      setLoading(true);
      updateStep(3, { error: undefined });
      await ensureCorrectChain();

      const { ethers } = await import('ethers');
      const timestamp = Math.floor(Date.now() / 1000);
      const hashInput = ethers.solidityPacked(['address', 'uint256'], [walletAddress, timestamp]);
      const snapshotHash = ethers.keccak256(hashInput);

      const tx = await callContract(
        SNAPSHOT_REGISTRY,
        SNAPSHOT_REGISTRY_ABI,
        'commitSnapshot',
        [agentId, snapshotHash, ZERO_HASH, `genesis:${walletAddress}:${timestamp}`],
      );
      setSnapshotTxHash(tx.hash);
      await tx.wait();

      updateStep(3, { status: 'complete' });
    } catch (err: any) {
      updateStep(3, { status: 'error', error: friendlyError(err) });
    } finally {
      setLoading(false);
    }
  }, [agentId, walletAddress, updateStep]);

  const allComplete = steps.every((s) => s.status === 'complete');

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold text-white tracking-tight">Get Started</h1>
        <p className="text-neutral-400 text-sm max-w-md mx-auto">
          Register an agent, link your World ID, and commit your first behavioral snapshot — all on-chain.
        </p>
      </div>

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-0">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center">
            {i > 0 && <StepConnector complete={s.status === 'complete' || s.status === 'active'} />}
            <StepDot status={s.status} />
          </div>
        ))}
      </div>

      {/* Step 1: Connect wallet */}
      <StepCard
        step={1}
        title="Connect wallet"
        status={steps[0].status}
        error={steps[0].error}
        onRetry={connectWallet}
      >
        {!wallet.hasProvider ? (
          <div className="p-4 rounded-lg bg-status-yellow/10 border border-status-yellow/30">
            <p className="text-sm text-status-yellow">
              No wallet detected. Install{' '}
              <a href="https://metamask.io" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
                MetaMask
              </a>{' '}
              to continue.
            </p>
          </div>
        ) : walletAddress ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-status-green animate-pulse" />
                <span className="text-sm text-neutral-400">Connected</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSwitchWallet}
                  className="px-2.5 py-1 text-xs font-medium text-chain hover:text-white border border-chain/30 hover:bg-chain/10 rounded-md transition-colors"
                >
                  Switch
                </button>
                <button
                  onClick={handleDisconnect}
                  className="px-2.5 py-1 text-xs font-medium text-status-red/70 hover:text-status-red border border-status-red/20 hover:bg-status-red/5 rounded-md transition-colors"
                >
                  Disconnect
                </button>
              </div>
            </div>
            <p className="text-xs text-chain font-mono break-all select-all bg-bg rounded border border-surface-border p-3">
              {walletAddress}
            </p>
          </div>
        ) : (
          <button
            onClick={connectWallet}
            disabled={loading}
            className="px-6 py-3 bg-chain hover:bg-chain/80 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
          >
            {loading ? <Spinner /> : null}
            Connect wallet
          </button>
        )}
      </StepCard>

      {/* Balance warning */}
      {walletAddress && balance !== null && balance === 0n && (
        <div className="p-4 rounded-xl bg-status-yellow/10 border border-status-yellow/30 flex items-start gap-3">
          <span className="text-status-yellow text-lg mt-0.5">⚠</span>
          <div>
            <p className="text-sm font-medium text-status-yellow">No {networkConfig.name} ETH</p>
            <p className="text-xs text-neutral-400 mt-1">
              You need ETH on {networkConfig.name} to register and commit snapshots.{' '}
              <a
                href="https://www.alchemy.com/faucets/base-sepolia"
                target="_blank"
                rel="noopener noreferrer"
                className="text-chain underline hover:text-white"
              >
                Get testnet ETH →
              </a>
            </p>
          </div>
        </div>
      )}

      {/* Step 2: Register agent */}
      <StepCard
        step={2}
        title="Register agent"
        status={steps[1].status}
        error={steps[1].error}
        onRetry={registerAgent}
      >
        {agentId !== null && steps[1].status === 'complete' ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkmark />
              <span className="text-sm text-status-green font-semibold">
                {registerTxHash ? `Agent #${agentId} registered` : `You already have Agent #${agentId} registered`}
              </span>
            </div>
            {registerTxHash && (
              <a
                href={`${BASESCAN_TX}${registerTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-chain hover:underline font-mono inline-block"
              >
                View on BaseScan →
              </a>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-neutral-400">
              Mint your ERC-8004 agent identity on {networkConfig.name}. This creates your on-chain agent NFT.
            </p>
            <button
              onClick={registerAgent}
              disabled={loading}
              className="px-6 py-3 bg-chain hover:bg-chain/80 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
            >
              {loading ? <Spinner /> : null}
              Register agent on {networkConfig.name}
            </button>
            {registerTxHash && (
              <p className="text-xs text-neutral-500 font-mono">
                tx: {registerTxHash.slice(0, 10)}… waiting for confirmation…
              </p>
            )}
          </div>
        )}
      </StepCard>

      {/* Step 3: Link World ID */}
      <StepCard
        step={3}
        title="Link World ID"
        status={steps[2].status}
        error={steps[2].error}
      >
        <div className="space-y-4">
          <p className="text-sm text-neutral-400">
            Link a World ID to prove your agent is backed by a real human. This uses Worldcoin's AgentKit to create a privacy-preserving delegation.
          </p>

          <div className="p-4 rounded-lg bg-surface-hover border border-surface-border space-y-3">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500">Register via AgentKit CLI</p>
            <code className="text-xs text-chain font-mono block bg-bg rounded p-2.5 select-all border border-surface-border leading-relaxed">
              npx @worldcoin/agentkit-cli register {walletAddress ?? '0x…'}
            </code>
            <p className="text-xs text-neutral-500">
              Run this in your terminal with the World App open on your phone. It will generate a nullifier hash linking your World ID to this agent.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-surface-hover border border-surface-border space-y-3">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500">Or verify in World App</p>
            <a
              href="https://worldcoin.org/download"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-chain/10 hover:bg-chain/20 border border-chain/30 text-chain font-medium text-sm rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              Open World App
            </a>
            <p className="text-xs text-neutral-500">
              Download the World App and verify your identity with Orb or Device verification, then run the CLI command above.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={skipWorldId}
              className="px-5 py-2.5 text-neutral-400 hover:text-white hover:bg-surface-hover text-sm rounded-lg border border-surface-border transition-colors"
            >
              Skip — continue without World ID
            </button>
          </div>
        </div>
      </StepCard>

      {/* Step 4: Commit genesis snapshot */}
      <StepCard
        step={4}
        title="Commit genesis snapshot"
        status={steps[3].status}
        error={steps[3].error}
        onRetry={commitGenesis}
      >
        {steps[3].status === 'complete' ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Checkmark />
              <span className="text-sm text-status-green font-semibold">Genesis committed</span>
            </div>
            {snapshotTxHash && (
              <a
                href={`${BASESCAN_TX}${snapshotTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-chain hover:underline font-mono inline-block"
              >
                View on BaseScan →
              </a>
            )}
            <button
              onClick={() => navigate(`/agent/${agentId}`)}
              className="w-full px-6 py-3 bg-status-green hover:bg-status-green/80 text-white font-semibold rounded-lg transition-colors"
            >
              View your agent →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-neutral-400">
              Commit the genesis snapshot to start your agent's behavioral chain. This is the first link in your tamper-proof history.
            </p>
            <button
              onClick={commitGenesis}
              disabled={loading}
              className="px-6 py-3 bg-chain hover:bg-chain/80 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
            >
              {loading ? <Spinner /> : null}
              Commit genesis snapshot
            </button>
            {snapshotTxHash && (
              <p className="text-xs text-neutral-500 font-mono">
                tx: {snapshotTxHash.slice(0, 10)}… waiting for confirmation…
              </p>
            )}
          </div>
        )}
      </StepCard>

      {/* Completion celebration */}
      {allComplete && (
        <div className="text-center p-8 rounded-xl border border-status-green/30 bg-status-green/5 animate-fade-in space-y-3">
          <div className="text-4xl">◈</div>
          <h2 className="text-xl font-bold text-white">You're on-chain</h2>
          <p className="text-sm text-neutral-400">
            Agent #{agentId} is registered with a genesis snapshot. Your behavioral integrity chain has begun.
          </p>
        </div>
      )}
    </div>
  );
}
