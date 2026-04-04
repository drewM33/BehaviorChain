import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { IDKitRequestWidget, orbLegacy, type IDKitResult } from '@worldcoin/idkit';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EscalationStatus = 'quiet' | 'notified' | 'escalated' | 'war room' | 'contained';
type SignalSensitivity = 'low' | 'medium' | 'high';
type Network = 'Base Sepolia' | 'Base mainnet';

interface FleetAgent {
  id: number;
  name: string;
  chain: Network;
  worldId: { verified: boolean; nullifierHash?: string };
  chainLength: number;
  lastChange: number;
  activeSignals: number;
  escalationStatus: EscalationStatus;
}

interface SignalConfig {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  sensitivity: SignalSensitivity;
  triggered: boolean;
  triggeredDescription: string;
  sensitivities: { low: string; medium: string; high: string };
}

interface EscalationTier {
  tier: number;
  label: string;
  sublabel: string;
  signalCount: number;
  actions: string[];
  selectedAction: number;
  inputLabel: string;
  inputValue: string;
  active: boolean;
}

interface AuditEntry {
  timestamp: number;
  agentId: number;
  signal: string;
  tier: number;
  action: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SIGNAL_DEFAULTS: SignalConfig[] = [
  {
    id: 'dependency',
    name: 'Dependency graph mutation',
    description: 'Monitors lockfile and dependency tree hash',
    enabled: true,
    sensitivity: 'medium',
    triggered: false,
    triggeredDescription: 'plain-crypto-js@4.2.1 injected',
    sensitivities: {
      low: 'Alert on any new package',
      medium: 'Alert on new packages registered < 7 days ago',
      high: 'Alert on any dependency change at all',
    },
  },
  {
    id: 'outbound',
    name: 'Outbound destinations',
    description: 'Monitors network egress',
    enabled: true,
    sensitivity: 'medium',
    triggered: false,
    triggeredDescription: 'sfrclak.com:8000 — never seen before',
    sensitivities: {
      low: 'Alert on new IPs not seen in 30 days',
      medium: 'Alert on new IPs not seen in 7 days',
      high: 'Alert on ANY new outbound connection',
    },
  },
  {
    id: 'credential',
    name: 'Credential access',
    description: 'Monitors env var and file reads',
    enabled: true,
    sensitivity: 'low',
    triggered: false,
    triggeredDescription: 'AWS_SECRET_ACCESS_KEY, NPM_TOKEN accessed',
    sensitivities: {
      low: 'Alert on access to known sensitive vars (AWS keys, SSH, npm tokens)',
      medium: 'Alert on any new env var access',
      high: 'Alert on any file system read outside normal paths',
    },
  },
  {
    id: 'subprocess',
    name: 'Subprocess spawning',
    description: 'Monitors child process execution',
    enabled: true,
    sensitivity: 'medium',
    triggered: false,
    triggeredDescription: 'sh -c "curl -sS https://sfrclak.com:8000/…"',
    sensitivities: {
      low: 'Alert on shell execution (sh, bash, cmd)',
      medium: 'Alert on any new process type',
      high: 'Alert on ANY subprocess (zero tolerance)',
    },
  },
  {
    id: 'selfmod',
    name: 'Self-modification',
    description: "Monitors file changes to agent's own directory",
    enabled: true,
    sensitivity: 'low',
    triggered: false,
    triggeredDescription: 'Binary deleted: /tmp/rat-binary',
    sensitivities: {
      low: 'Alert on binary deletion',
      medium: 'Alert on any file deletion',
      high: 'Alert on any file modification',
    },
  },
];

const TIER_DEFAULTS: EscalationTier[] = [
  {
    tier: 1,
    label: 'Notify',
    sublabel: 'Single anomaly — could be benign',
    signalCount: 1,
    actions: ['SMS to on-call', 'Email to team', 'Slack DM', 'Webhook POST'],
    selectedAction: 0,
    inputLabel: 'Phone number',
    inputValue: '+1 (415) 555-0172',
    active: false,
  },
  {
    tier: 2,
    label: 'Escalate',
    sublabel: 'Correlated anomaly — likely compromise',
    signalCount: 2,
    actions: ['Phone call to admin', 'Page on-call', 'SMS + email'],
    selectedAction: 0,
    inputLabel: 'Admin phone',
    inputValue: '+1 (415) 555-0172',
    active: false,
  },
  {
    tier: 3,
    label: 'War room',
    sublabel: 'Active incident — coordinate response',
    signalCount: 3,
    actions: ['Slack war room', 'Teams incident channel', 'PagerDuty incident'],
    selectedAction: 0,
    inputLabel: 'Slack webhook URL',
    inputValue: 'https://hooks.slack.com/services/T00/B00/xxx',
    active: false,
  },
  {
    tier: 4,
    label: 'Contain',
    sublabel: 'Automated containment — stop the bleeding',
    signalCount: 4,
    actions: ['Revoke npm tokens', 'Rotate AWS credentials', 'Suspend agent', 'All of the above'],
    selectedAction: 3,
    inputLabel: '',
    inputValue: '',
    active: false,
  },
  {
    tier: 5,
    label: 'Kill switch',
    sublabel: 'Full lockdown — all credentials invalidated',
    signalCount: 5,
    actions: ['Revoke all credentials + suspend', 'Network isolation', 'Full account freeze'],
    selectedAction: 0,
    inputLabel: '',
    inputValue: '',
    active: false,
  },
];

const MOCK_FLEET: FleetAgent[] = [
  {
    id: 3458,
    name: 'prod-inference-v3',
    chain: 'Base Sepolia',
    worldId: { verified: true, nullifierHash: '0x2a8d…f91c' },
    chainLength: 4,
    lastChange: Date.now() - 18 * 24 * 60 * 60 * 1000,
    activeSignals: 0,
    escalationStatus: 'quiet',
  },
  {
    id: 7721,
    name: 'staging-qa-bot',
    chain: 'Base Sepolia',
    worldId: { verified: true, nullifierHash: '0x91bf…3c02' },
    chainLength: 12,
    lastChange: Date.now() - 3 * 24 * 60 * 60 * 1000,
    activeSignals: 0,
    escalationStatus: 'quiet',
  },
  {
    id: 8192,
    name: 'ci-deploy-agent',
    chain: 'Base mainnet',
    worldId: { verified: false },
    chainLength: 47,
    lastChange: Date.now() - 2 * 60 * 1000,
    activeSignals: 1,
    escalationStatus: 'notified',
  },
  {
    id: 9004,
    name: 'data-pipeline-alpha',
    chain: 'Base Sepolia',
    worldId: { verified: true, nullifierHash: '0xc4e1…8a37' },
    chainLength: 203,
    lastChange: Date.now() - 30 * 1000,
    activeSignals: 5,
    escalationStatus: 'contained',
  },
];

const SIGNAL_NAMES = [
  'Dependency graph changed',
  'New outbound destination',
  'Credential access detected',
  'Subprocess spawned',
  'Self-modification detected',
];

const ESCALATION_ACTIONS = [
  'SMS sent to +1 (415) 555-0172',
  'Phone call to admin',
  'Slack war room created',
  'npm tokens revoked, AWS credentials rotated',
  'Full lockdown — all credentials invalidated',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function escalationColor(status: EscalationStatus): string {
  switch (status) {
    case 'quiet': return 'text-status-green';
    case 'notified': return 'text-status-yellow';
    case 'escalated': return 'text-status-yellow';
    case 'war room': return 'text-status-red';
    case 'contained': return 'text-status-red';
  }
}

function escalationBg(status: EscalationStatus): string {
  switch (status) {
    case 'quiet': return 'bg-status-green/10 border-status-green/30';
    case 'notified': return 'bg-status-yellow/10 border-status-yellow/30';
    case 'escalated': return 'bg-status-yellow/10 border-status-yellow/30';
    case 'war room': return 'bg-status-red/10 border-status-red/30';
    case 'contained': return 'bg-status-red/10 border-status-red/30';
  }
}

function signalBadge(count: number): { text: string; cls: string } {
  if (count === 0) return { text: '0/5', cls: 'text-status-green bg-status-green/10 border-status-green/30' };
  if (count <= 2) return { text: `${count}/5`, cls: 'text-status-yellow bg-status-yellow/10 border-status-yellow/30' };
  return { text: `${count}/5`, cls: 'text-status-red bg-status-red/10 border-status-red/30' };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FleetTable({
  agents,
  selectedId,
  onSelect,
}: {
  agents: FleetAgent[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const navigate = useNavigate();

  return (
    <div className="bg-surface border border-surface-border rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">Agent Fleet</h2>
        <span className="text-xs font-mono text-neutral-600">{agents.length} agents</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-bg">
              <th className="text-left py-3 px-4 text-neutral-500 font-medium text-xs uppercase tracking-wider">Agent</th>
              <th className="text-left py-3 px-4 text-neutral-500 font-medium text-xs uppercase tracking-wider">Chain</th>
              <th className="text-left py-3 px-4 text-neutral-500 font-medium text-xs uppercase tracking-wider">World ID</th>
              <th className="text-left py-3 px-4 text-neutral-500 font-medium text-xs uppercase tracking-wider">Changes</th>
              <th className="text-left py-3 px-4 text-neutral-500 font-medium text-xs uppercase tracking-wider">Last Change</th>
              <th className="text-left py-3 px-4 text-neutral-500 font-medium text-xs uppercase tracking-wider">Signals</th>
              <th className="text-left py-3 px-4 text-neutral-500 font-medium text-xs uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent, i) => {
              const sig = signalBadge(agent.activeSignals);
              const isSelected = selectedId === agent.id;
              return (
                <tr
                  key={agent.id}
                  onClick={() => onSelect(agent.id)}
                  className={`border-b border-surface-border/50 last:border-0 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-chain/5 hover:bg-chain/10'
                      : i % 2 === 0
                        ? 'bg-surface hover:bg-surface-hover'
                        : 'bg-bg hover:bg-surface-hover'
                  }`}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-chain text-xs">#{agent.id}</span>
                      <span className="text-neutral-300">{agent.name}</span>
                      {agent.id === 3458 && (
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-xs font-mono text-neutral-400">{agent.chain}</span>
                  </td>
                  <td className="py-3 px-4">
                    {agent.worldId.verified ? (
                      <span className="inline-flex items-center gap-1 text-xs text-status-green font-mono">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        verified
                      </span>
                    ) : (
                      <span className="text-xs text-neutral-600">not linked</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-mono text-xs text-neutral-300">{agent.chainLength}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-xs text-neutral-400">{timeAgo(agent.lastChange)}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-mono font-medium border ${sig.cls}`}>
                      {sig.text}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-mono font-medium border ${escalationBg(agent.escalationStatus)} ${escalationColor(agent.escalationStatus)}`}>
                      {agent.escalationStatus}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-5 py-2 border-t border-surface-border">
        <p className="text-[10px] text-neutral-600">Click a row to configure · Double-click to open Telemetry</p>
      </div>
    </div>
  );
}

function CreateAgentPanel({
  onCreated,
}: {
  onCreated: (agent: FleetAgent) => void;
}) {
  const { address } = useWallet();
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState('');
  const [network, setNetwork] = useState<Network>('Base Sepolia');
  const [worldIdOpen, setWorldIdOpen] = useState(false);
  const [worldIdResult, setWorldIdResult] = useState<{ nullifier: string } | null>(null);
  const [worldIdError, setWorldIdError] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [regStep, setRegStep] = useState(0);

  const handleWorldIdSuccess = useCallback((result: IDKitResult) => {
    const resp = result.responses?.[0];
    const nullifier =
      (resp && 'nullifier' in resp ? resp.nullifier : null)
      ?? (resp && 'session_nullifier' in resp ? resp.session_nullifier[0] : null)
      ?? (result as any).nullifier_hash
      ?? null;
    if (nullifier) {
      const short = `${nullifier.slice(0, 6)}…${nullifier.slice(-4)}`;
      setWorldIdResult({ nullifier: short });
      setWorldIdError(null);
    }
  }, []);

  const handleRegister = useCallback(() => {
    if (!name.trim()) return;
    setRegistering(true);
    setRegStep(1);

    setTimeout(() => {
      setRegStep(2);
      setTimeout(() => {
        const newAgent: FleetAgent = {
          id: 1000 + Math.floor(Math.random() * 9000),
          name: name.trim(),
          chain: network,
          worldId: worldIdResult
            ? { verified: true, nullifierHash: worldIdResult.nullifier }
            : { verified: false },
          chainLength: 0,
          lastChange: Date.now(),
          activeSignals: 0,
          escalationStatus: 'quiet',
        };
        onCreated(newAgent);
        setRegistering(false);
        setRegStep(0);
        setName('');
        setExpanded(false);
        setWorldIdResult(null);
      }, 1200);
    }, 1200);
  }, [name, network, worldIdResult, onCreated]);

  return (
    <div className="bg-surface border border-surface-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-surface-hover transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={`text-chain text-xl font-light transition-transform duration-200 ${expanded ? 'rotate-45' : ''}`}>+</span>
          <span className="text-sm font-semibold text-white">Create agent</span>
        </div>
        <svg
          className={`w-4 h-4 text-neutral-500 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M3 5l3 3 3-3" />
        </svg>
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-surface-border pt-4 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-xs text-neutral-500 uppercase tracking-wider mb-2">Agent name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. prod-inference-v3"
                className="w-full bg-bg border border-surface-border rounded-lg px-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-chain/50 transition-colors font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 uppercase tracking-wider mb-2">Network</label>
              <select
                value={network}
                onChange={(e) => setNetwork(e.target.value as Network)}
                className="w-full bg-bg border border-surface-border rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-chain/50 transition-colors appearance-none cursor-pointer"
              >
                <option value="Base Sepolia">Base Sepolia</option>
                <option value="Base mainnet">Base mainnet</option>
              </select>
            </div>
          </div>

          <div className="mb-5">
            <label className="block text-xs text-neutral-500 uppercase tracking-wider mb-2">World ID verification</label>
            {worldIdResult ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-status-green/10 border border-status-green/30 text-status-green text-sm font-medium">
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  World ID verified
                </div>
                <span className="text-xs text-neutral-500 font-mono">
                  Nullifier: {worldIdResult.nullifier}
                </span>
                <button
                  onClick={() => setWorldIdResult(null)}
                  className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors"
                >
                  clear
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => setWorldIdOpen(true)}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium transition-all border bg-surface-hover border-surface-border text-neutral-300 hover:border-chain/40 hover:text-white flex items-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="4" />
                    <line x1="12" y1="2" x2="12" y2="6" />
                    <line x1="12" y1="18" x2="12" y2="22" />
                    <line x1="2" y1="12" x2="6" y2="12" />
                    <line x1="18" y1="12" x2="22" y2="12" />
                  </svg>
                  Connect World ID
                </button>
                <span className="text-xs text-neutral-600">
                  Verify with World App to prove human backing
                </span>
              </div>
            )}
            {worldIdError && (
              <p className="text-xs text-status-red mt-2">{worldIdError}</p>
            )}
          </div>

          <IDKitRequestWidget
            open={worldIdOpen}
            onOpenChange={setWorldIdOpen}
            app_id={import.meta.env.VITE_WORLDCOIN_APP_ID ?? 'app_staging_7550e7fa7a8aaab72b3532e2cef26940'}
            action="register-behaviorchain-agent"
            rp_context={{
              rp_id: import.meta.env.VITE_WORLDCOIN_RP_ID ?? 'rp_staging_example',
              nonce: crypto.randomUUID(),
              created_at: Math.floor(Date.now() / 1000),
              expires_at: Math.floor(Date.now() / 1000) + 300,
              signature: 'demo-signature',
            }}
            allow_legacy_proofs={true}
            environment="staging"
            preset={orbLegacy({ signal: address ?? '0x0' })}
            onSuccess={handleWorldIdSuccess}
            onError={(code) => {
              setWorldIdError(`World ID verification failed (${code})`);
            }}
          />

          {registering ? (
            <div className="space-y-3 animate-fade-in">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  regStep >= 1
                    ? regStep > 1
                      ? 'border-status-green bg-status-green/20 text-status-green'
                      : 'border-chain bg-chain/20 text-chain animate-pulse'
                    : 'border-neutral-700 bg-bg text-neutral-600'
                }`}>
                  {regStep > 1 ? '✓' : '1'}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-neutral-300">Register in ERC-8004 Identity Registry</p>
                </div>
                {regStep === 1 && <div className="w-4 h-4 border-2 border-chain border-t-transparent rounded-full animate-spin" />}
              </div>
              <div className="ml-4 w-0.5 h-4 bg-surface-border" />
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  regStep >= 2
                    ? 'border-chain bg-chain/20 text-chain animate-pulse'
                    : 'border-neutral-700 bg-bg text-neutral-600'
                }`}>
                  2
                </div>
                <div className="flex-1">
                  <p className="text-sm text-neutral-300">Commit genesis snapshot to BehaviorSnapshotRegistry</p>
                </div>
                {regStep === 2 && <div className="w-4 h-4 border-2 border-chain border-t-transparent rounded-full animate-spin" />}
              </div>
            </div>
          ) : (
            <button
              onClick={handleRegister}
              disabled={!name.trim()}
              className="px-6 py-2.5 bg-chain hover:bg-chain/80 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-lg transition-colors"
            >
              Register on-chain
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SignalPanel({
  signals,
  onToggle,
  onSensitivity,
}: {
  signals: SignalConfig[];
  onToggle: (id: string) => void;
  onSensitivity: (id: string, s: SignalSensitivity) => void;
}) {
  return (
    <div className="bg-surface border border-surface-border rounded-lg p-5">
      <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-4">Signal monitoring</h3>
      <div className="space-y-3">
        {signals.map((sig) => (
          <div
            key={sig.id}
            className={`rounded-lg border p-4 transition-all ${
              sig.triggered
                ? 'border-status-red/40 bg-status-red/5'
                : sig.enabled
                  ? 'border-surface-border bg-bg'
                  : 'border-surface-border/50 bg-bg/50 opacity-60'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={() => onToggle(sig.id)}
                className={`w-9 h-5 rounded-full relative transition-colors ${
                  sig.enabled ? 'bg-status-red' : 'bg-neutral-700'
                }`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    sig.enabled ? 'left-[18px]' : 'left-0.5'
                  }`}
                />
              </button>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-white">{sig.name}</span>
                <p className="text-xs text-neutral-500">{sig.description}</p>
              </div>
              <div className="flex items-center gap-1.5">
                {sig.triggered ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-status-red animate-pulse" />
                    <span className="text-xs text-status-red font-mono">{sig.triggeredDescription}</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-status-green" />
                    <span className="text-xs text-status-green font-mono">stable</span>
                  </span>
                )}
              </div>
            </div>
            {sig.enabled && (
              <div className="flex items-center gap-1 mt-2">
                {(['low', 'medium', 'high'] as SignalSensitivity[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => onSensitivity(sig.id, s)}
                    className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                      sig.sensitivity === s
                        ? s === 'high'
                          ? 'bg-status-red/20 text-status-red border border-status-red/30'
                          : s === 'medium'
                            ? 'bg-status-yellow/20 text-status-yellow border border-status-yellow/30'
                            : 'bg-status-green/20 text-status-green border border-status-green/30'
                        : 'bg-bg text-neutral-500 border border-surface-border hover:text-neutral-300'
                    }`}
                  >
                    {s}
                  </button>
                ))}
                <span className="text-[10px] text-neutral-600 ml-2 hidden lg:inline">{sig.sensitivities[sig.sensitivity]}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const TIER_ICONS = ['1', '2', '3', '4', '5'];

function EscalationPanel({
  tiers,
  activeSignalCount,
  onActionChange,
  onInputChange,
  onSimulate,
  onReset,
  onSave,
  simulating,
}: {
  tiers: EscalationTier[];
  activeSignalCount: number;
  onActionChange: (tier: number, actionIdx: number) => void;
  onInputChange: (tier: number, value: string) => void;
  onSimulate: () => void;
  onReset: () => void;
  onSave: () => void;
  simulating: boolean;
}) {
  return (
    <div className="bg-surface border border-surface-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">Escalation Policy</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500 font-mono">
            {activeSignalCount}/5 signals active
          </span>
          {activeSignalCount > 0 && (
            <span className={`text-xs font-bold font-mono animate-pulse ${activeSignalCount <= 2 ? 'text-status-yellow' : 'text-status-red'}`}>
              LEVEL {activeSignalCount}
            </span>
          )}
        </div>
      </div>

      {/* Progress meter — large, prominent */}
      <div className="flex items-center gap-1.5 mb-6">
        {[1, 2, 3, 4, 5].map((n) => {
          const isLit = n <= activeSignalCount;
          const color = n <= 2 ? 'yellow' : 'red';
          return (
            <div key={n} className="flex-1 relative group">
              <div
                className={`h-4 rounded transition-all duration-700 ${
                  isLit
                    ? color === 'yellow'
                      ? 'bg-status-yellow shadow-md shadow-status-yellow/40'
                      : 'bg-status-red shadow-md shadow-status-red/40'
                    : 'bg-neutral-800'
                }`}
              />
              <span className={`absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-mono ${
                isLit
                  ? color === 'yellow' ? 'text-status-yellow' : 'text-status-red'
                  : 'text-neutral-700'
              }`}>
                L{n}
              </span>
            </div>
          );
        })}
      </div>

      {/* Tier cards */}
      <div className="space-y-3 mt-8">
        {tiers.map((tier) => {
          const isActive = tier.tier <= activeSignalCount;
          const color = tier.tier <= 2 ? 'yellow' : 'red';
          return (
            <div
              key={tier.tier}
              className={`rounded-xl border transition-all duration-500 overflow-hidden ${
                isActive
                  ? color === 'yellow'
                    ? 'border-l-4 border-l-status-yellow border-status-yellow/30 bg-status-yellow/5'
                    : 'border-l-4 border-l-status-red border-status-red/30 bg-status-red/5'
                  : 'border-surface-border bg-bg hover:bg-surface-hover/30'
              }`}
            >
              {/* Tier header */}
              <div className="px-5 py-4 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold font-mono shrink-0 ${
                  isActive
                    ? color === 'yellow'
                      ? 'bg-status-yellow/20 text-status-yellow'
                      : 'bg-status-red/20 text-status-red'
                    : 'bg-neutral-800/50 text-neutral-600'
                }`}>
                  L{TIER_ICONS[tier.tier - 1]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-base font-bold ${isActive ? 'text-white' : 'text-neutral-400'}`}>
                      Level {tier.tier}: {tier.label}
                    </span>
                    {isActive && (
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded animate-fade-in ${
                        color === 'yellow'
                          ? 'bg-status-yellow/20 text-status-yellow'
                          : 'bg-status-red/20 text-status-red'
                      }`}>
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5">{tier.sublabel}</p>
                </div>
                <div className={`text-xs font-mono shrink-0 ${
                  isActive
                    ? color === 'yellow' ? 'text-status-yellow' : 'text-status-red'
                    : 'text-neutral-700'
                }`}>
                  {tier.signalCount} signal{tier.signalCount > 1 ? 's' : ''}
                </div>
              </div>

              {/* Action configuration */}
              <div className={`px-5 pb-4 pt-0 ${isActive ? '' : 'opacity-60'}`}>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-[10px] text-neutral-500 uppercase tracking-wider shrink-0">Action:</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {tier.actions.map((action, i) => (
                      <button
                        key={i}
                        onClick={() => onActionChange(tier.tier, i)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                          tier.selectedAction === i
                            ? isActive
                              ? color === 'yellow'
                                ? 'bg-status-yellow/20 border-status-yellow/40 text-status-yellow'
                                : 'bg-status-red/20 border-status-red/40 text-status-red'
                              : 'bg-chain/15 border-chain/30 text-chain'
                            : 'bg-bg border-surface-border text-neutral-500 hover:text-neutral-300 hover:border-neutral-600'
                        }`}
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                </div>
                {tier.inputLabel && (
                  <div className="mt-2.5 flex items-center gap-2">
                    <span className="text-[10px] text-neutral-500 uppercase tracking-wider shrink-0">{tier.inputLabel}:</span>
                    <input
                      type="text"
                      value={tier.inputValue}
                      onChange={(e) => onInputChange(tier.tier, e.target.value)}
                      placeholder={tier.inputLabel}
                      className="bg-bg border border-surface-border rounded-lg px-3 py-1.5 text-xs text-neutral-300 font-mono focus:outline-none focus:border-chain/50 transition-colors flex-1"
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mt-6 pt-5 border-t border-surface-border flex-wrap">
        <button
          onClick={onSave}
          className="px-6 py-3 bg-chain hover:bg-chain/80 text-white text-sm font-bold rounded-lg transition-colors"
        >
          Save policy
        </button>
        <button
          onClick={onReset}
          className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          Reset to defaults
        </button>
      </div>
    </div>
  );
}

function AuditLog({ entries }: { entries: AuditEntry[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length]);

  return (
    <div className="bg-surface border border-surface-border rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">Audit Log</h2>
        <span className="text-xs font-mono text-neutral-600">{entries.length} events</span>
      </div>
      {entries.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-xs text-neutral-600 font-mono">No escalation events recorded</p>
          <p className="text-[10px] text-neutral-700 mt-1">Run a simulation to generate audit trail</p>
        </div>
      ) : (
        <div className="max-h-[320px] overflow-y-auto">
          {entries.map((entry, i) => (
            <div
              key={i}
              className={`px-5 py-3 border-b border-surface-border/50 last:border-0 animate-fade-in ${
                i % 2 === 0 ? 'bg-surface' : 'bg-bg'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold font-mono shrink-0 ${
                  entry.tier <= 2
                    ? 'bg-status-yellow/20 text-status-yellow'
                    : 'bg-status-red/20 text-status-red'
                }`}>
                  T{entry.tier}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-neutral-500">{timeAgo(entry.timestamp)}</span>
                    <span className="text-neutral-700">—</span>
                    <span className="text-xs font-mono text-chain">Agent #{entry.agentId}</span>
                    <span className="text-neutral-700">—</span>
                    <span className="text-xs text-neutral-300">{entry.signal}</span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    → Tier {entry.tier}: {entry.action}
                  </p>
                </div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function Admin() {
  const navigate = useNavigate();
  const { address } = useWallet();

  const [fleet, setFleet] = useState<FleetAgent[]>(MOCK_FLEET);
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(MOCK_FLEET[0]?.id ?? null);
  const [signals, setSignals] = useState<SignalConfig[]>(SIGNAL_DEFAULTS);
  const [tiers, setTiers] = useState<EscalationTier[]>(TIER_DEFAULTS);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [simulating, setSimulating] = useState(false);
  const [saved, setSaved] = useState(false);
  const simTimeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('bc-escalation-policy');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.tiers) setTiers(parsed.tiers);
      } catch { /* ignore */ }
    }
  }, []);

  const selectedAgent = fleet.find((a) => a.id === selectedAgentId) ?? null;

  const activeSignalCount = signals.filter((s) => s.triggered).length;

  const handleSelectAgent = useCallback((id: number) => {
    setSelectedAgentId((prev) => (prev === id ? null : id));
  }, []);

  const handleDoubleClickAgent = useCallback(
    (id: number) => {
      navigate(`/agent/${id}`);
    },
    [navigate],
  );

  const handleToggleSignal = useCallback((id: string) => {
    setSignals((prev) => prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)));
  }, []);

  const handleSensitivity = useCallback((id: string, sensitivity: SignalSensitivity) => {
    setSignals((prev) => prev.map((s) => (s.id === id ? { ...s, sensitivity } : s)));
  }, []);

  const handleActionChange = useCallback((tier: number, actionIdx: number) => {
    setTiers((prev) => prev.map((t) => (t.tier === tier ? { ...t, selectedAction: actionIdx } : t)));
  }, []);

  const handleInputChange = useCallback((tier: number, value: string) => {
    setTiers((prev) => prev.map((t) => (t.tier === tier ? { ...t, inputValue: value } : t)));
  }, []);

  const handleReset = useCallback(() => {
    simTimeoutsRef.current.forEach(clearTimeout);
    simTimeoutsRef.current = [];
    setSimulating(false);
    setSignals(SIGNAL_DEFAULTS);
    setFleet((prev) =>
      prev.map((a) =>
        a.id === (selectedAgentId ?? 8192)
          ? { ...a, activeSignals: 0, escalationStatus: 'quiet' as EscalationStatus }
          : a,
      ),
    );
  }, [selectedAgentId]);

  const handleSimulate = useCallback(() => {
    if (simulating) return;
    handleReset();
    setSimulating(true);

    const targetAgent = selectedAgentId ?? 8192;
    const signalIds = ['dependency', 'outbound', 'credential', 'subprocess', 'selfmod'];
    const escalationStatuses: EscalationStatus[] = ['notified', 'escalated', 'war room', 'contained', 'contained'];

    signalIds.forEach((sigId, idx) => {
      const timeout = window.setTimeout(() => {
        setSignals((prev) =>
          prev.map((s) => (s.id === sigId ? { ...s, triggered: true } : s)),
        );

        setFleet((prev) =>
          prev.map((a) =>
            a.id === targetAgent
              ? {
                  ...a,
                  activeSignals: idx + 1,
                  escalationStatus: escalationStatuses[idx],
                  lastChange: Date.now(),
                }
              : a,
          ),
        );

        setAuditLog((prev) => [
          ...prev,
          {
            timestamp: Date.now(),
            agentId: targetAgent,
            signal: SIGNAL_NAMES[idx],
            tier: idx + 1,
            action: ESCALATION_ACTIONS[idx],
          },
        ]);

        if (idx === signalIds.length - 1) {
          setSimulating(false);
        }
      }, (idx + 1) * 1200);

      simTimeoutsRef.current.push(timeout);
    });
  }, [simulating, selectedAgentId, handleReset]);

  const handleSave = useCallback(() => {
    localStorage.setItem('bc-escalation-policy', JSON.stringify({ tiers }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [tiers]);

  const handleAgentCreated = useCallback((agent: FleetAgent) => {
    setFleet((prev) => [agent, ...prev]);
  }, []);

  useEffect(() => {
    return () => {
      simTimeoutsRef.current.forEach(clearTimeout);
    };
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">Control Center</h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded border bg-chain/10 text-chain border-chain/30">
              ADMIN
            </span>
          </div>
          <p className="text-sm text-neutral-500 mt-1">
            Manage your agent fleet, configure monitoring, and set escalation policies
          </p>
        </div>
        {address && (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-status-green" />
            <span className="text-xs font-mono text-neutral-400">{address.slice(0, 6)}…{address.slice(-4)}</span>
          </div>
        )}
      </div>

      {/* Section 1: Fleet overview */}
      <FleetTable
        agents={fleet}
        selectedId={selectedAgentId}
        onSelect={handleSelectAgent}
      />

      {/* Section 2: Create new agent */}
      <CreateAgentPanel onCreated={handleAgentCreated} />

      {/* Section 3: Agent configuration — always visible */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-lg font-semibold text-white">
            {selectedAgent ? `Agent #${selectedAgent.id}` : 'Agent Configuration'}
          </h2>
          {selectedAgent && (
            <>
              <span className="text-sm text-neutral-500">{selectedAgent.name}</span>
              <span className={`text-xs font-mono px-2 py-0.5 rounded border ${escalationBg(selectedAgent.escalationStatus)} ${escalationColor(selectedAgent.escalationStatus)}`}>
                {selectedAgent.escalationStatus}
              </span>
              <button
                onClick={() => navigate(`/agent/${selectedAgent.id}`)}
                className="ml-auto text-xs text-chain hover:underline font-mono"
              >
                Open Telemetry →
              </button>
            </>
          )}
        </div>

        {/* Agent selector tabs */}
        <div className="flex items-center gap-1 mb-4 flex-wrap">
          {fleet.map((a) => {
            const active = selectedAgentId === a.id;
            return (
              <button
                key={a.id}
                onClick={() => setSelectedAgentId(a.id)}
                className={`px-3 py-1.5 rounded text-xs font-mono transition-colors flex items-center gap-1.5 ${
                  active
                    ? 'bg-chain text-white'
                    : 'bg-surface border border-surface-border text-neutral-400 hover:text-white hover:bg-surface-hover'
                }`}
              >
                #{a.id}
                {a.activeSignals > 0 && (
                  <span className={`w-1.5 h-1.5 rounded-full ${a.activeSignals >= 3 ? 'bg-status-red' : 'bg-status-yellow'} animate-pulse`} />
                )}
              </button>
            );
          })}
        </div>

        {/* Escalation policy — top, most prominent */}
        <EscalationPanel
          tiers={tiers}
          activeSignalCount={activeSignalCount}
          onActionChange={handleActionChange}
          onInputChange={handleInputChange}
          onSimulate={handleSimulate}
          onReset={handleReset}
          onSave={handleSave}
          simulating={simulating}
        />
        {saved && (
          <div className="mt-3 p-3 bg-status-green/10 border border-status-green/30 rounded-lg text-center animate-fade-in">
            <span className="text-sm text-status-green font-medium">Policy saved to localStorage</span>
          </div>
        )}

        {/* Signal monitoring — below escalation */}
        <div className="mt-6">
          <SignalPanel
            signals={signals}
            onToggle={handleToggleSignal}
            onSensitivity={handleSensitivity}
          />
        </div>
      </div>

      {/* Section 4: Audit log */}
      <AuditLog entries={auditLog} />
    </div>
  );
}
