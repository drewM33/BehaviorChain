import { createHash } from 'node:crypto';
import type { Severity, DriftAlert, DriftSignal } from '@behaviorchain/drift';

// ---------------------------------------------------------------------------
// Hash generation
// ---------------------------------------------------------------------------

function hash(seed: string): string {
  return '0x' + createHash('sha256').update(seed).digest('hex');
}

const ZERO_HASH =
  '0x0000000000000000000000000000000000000000000000000000000000000000';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChainNode {
  index: number;
  snapshotHash: string;
  previousHash: string;
  timestamp: number;
  encryptedDataUri: string;
  description: string;
}

export interface MockAgent {
  agentId: number;
  name: string;
  score: number;
  tier: string;
  riskLevel: string;
  route: string;
  chainLength: number;
  firstChangeDate: number;
  lastChangeDate: number;
  lastChangeDescription: string;
  driftFlagCount: number;
  highestSeverity: Severity | 'none';
  cleanLaps: number;
  chainIntact: boolean;
  delegation: { humanNullifierHash: string; delegationTimestamp: number } | null;
  chain: ChainNode[];
  driftAlerts: DriftAlert[];
}

// ---------------------------------------------------------------------------
// Chain builders
// ---------------------------------------------------------------------------

function buildChain(
  agentId: number,
  descriptions: { desc: string; daysAgo: number }[],
): ChainNode[] {
  const now = Date.now();
  const nodes: ChainNode[] = [];

  for (let i = 0; i < descriptions.length; i++) {
    const prevHash = i === 0 ? ZERO_HASH : nodes[i - 1].snapshotHash;
    const snapshotHash = hash(`agent-${agentId}-snapshot-${i}`);
    nodes.push({
      index: i,
      snapshotHash,
      previousHash: prevHash,
      timestamp: now - descriptions[i].daysAgo * 86_400_000,
      encryptedDataUri: `ipfs://Qm${hash(`ipfs-${agentId}-${i}`).slice(2, 48)}`,
      description: descriptions[i].desc,
    });
  }

  return nodes;
}

function buildTamperedChain(agentId: number): ChainNode[] {
  const chain = buildChain(agentId, [
    { desc: 'Genesis commit', daysAgo: 30 },
    { desc: 'Config update', daysAgo: 20 },
    { desc: 'Model swap', daysAgo: 10 },
  ]);
  chain[2] = {
    ...chain[2],
    previousHash: hash('tampered-link'),
  };
  return chain;
}

// ---------------------------------------------------------------------------
// Drift alert builders
// ---------------------------------------------------------------------------

function makeAlert(
  agentId: string,
  index: number,
  severity: Severity,
  signals: DriftSignal[],
  daysAgo: number,
  delegation?: { humanNullifierHash: string; delegationTimestamp: number },
): DriftAlert {
  const chain = AGENTS_MAP.get(Number(agentId))?.chain;
  return {
    agentId,
    chainId: 84532,
    snapshotIndex: index,
    previousSnapshotHash: chain?.[index - 1]?.snapshotHash ?? ZERO_HASH,
    currentSnapshotHash: chain?.[index]?.snapshotHash ?? hash(`alert-${agentId}-${index}`),
    driftSignals: signals,
    severity,
    timestamp: Date.now() - daysAgo * 86_400_000,
    ...(delegation && {
      humanNullifierHash: delegation.humanNullifierHash,
      delegationTimestamp: delegation.delegationTimestamp,
    }),
  };
}

// ---------------------------------------------------------------------------
// Agent definitions
// ---------------------------------------------------------------------------

const agent42: MockAgent = {
  agentId: 42,
  name: 'sentinel-alpha',
  score: 98,
  tier: 'AAA',
  riskLevel: 'GREEN',
  route: 'prod',
  chainLength: 3,
  firstChangeDate: Date.now() - 180 * 86_400_000,
  lastChangeDate: Date.now() - 12 * 86_400_000,
  lastChangeDescription: 'Prompt template minor revision',
  driftFlagCount: 0,
  highestSeverity: 'none',
  cleanLaps: 450,
  chainIntact: true,
  delegation: null,
  chain: buildChain(42, [
    { desc: 'Genesis commit — initial behavioral baseline', daysAgo: 180 },
    { desc: 'Response format standardized to JSON-LD', daysAgo: 95 },
    { desc: 'Prompt template minor revision', daysAgo: 12 },
  ]),
  driftAlerts: [],
};

const agent43: MockAgent = {
  agentId: 43,
  name: 'atlas-router',
  score: 82,
  tier: 'AA',
  riskLevel: 'GREEN',
  route: 'prod',
  chainLength: 8,
  firstChangeDate: Date.now() - 120 * 86_400_000,
  lastChangeDate: Date.now() - 5 * 86_400_000,
  lastChangeDescription: 'Routing logic updated for new API version',
  driftFlagCount: 2,
  highestSeverity: 'medium',
  cleanLaps: 280,
  chainIntact: true,
  delegation: null,
  chain: buildChain(43, [
    { desc: 'Genesis commit', daysAgo: 120 },
    { desc: 'Dependency update: axios 1.6 → 1.7', daysAgo: 105 },
    { desc: 'Error handling refactored', daysAgo: 88 },
    { desc: 'Rate limiter thresholds adjusted', daysAgo: 72 },
    { desc: 'Logging verbosity reduced', daysAgo: 55 },
    { desc: 'Cache TTL changed from 300s to 600s', daysAgo: 38 },
    { desc: 'Auth token refresh logic updated', daysAgo: 18 },
    { desc: 'Routing logic updated for new API version', daysAgo: 5 },
  ]),
  driftAlerts: [],
};

const agent44: MockAgent = {
  agentId: 44,
  name: 'nexus-handler',
  score: 55,
  tier: 'BA',
  riskLevel: 'YELLOW',
  route: 'prod_throttled',
  chainLength: 15,
  firstChangeDate: Date.now() - 45 * 86_400_000,
  lastChangeDate: Date.now() - 1 * 86_400_000,
  lastChangeDescription: 'Fallback model switched to GPT-4o-mini',
  driftFlagCount: 5,
  highestSeverity: 'high',
  cleanLaps: 120,
  chainIntact: true,
  delegation: null,
  chain: buildChain(44, [
    { desc: 'Genesis commit', daysAgo: 45 },
    { desc: 'Model version GPT-4 → GPT-4-turbo', daysAgo: 42 },
    { desc: 'System prompt rewritten', daysAgo: 38 },
    { desc: 'Temperature changed 0.7 → 0.3', daysAgo: 35 },
    { desc: 'Max tokens increased 2048 → 4096', daysAgo: 30 },
    { desc: 'Tool definitions expanded', daysAgo: 25 },
    { desc: 'Retry logic added for timeouts', daysAgo: 22 },
    { desc: 'Response parser overhauled', daysAgo: 18 },
    { desc: 'Streaming enabled for all routes', daysAgo: 15 },
    { desc: 'Context window management changed', daysAgo: 12 },
    { desc: 'Safety filter thresholds lowered', daysAgo: 9 },
    { desc: 'New tool: web_search added', daysAgo: 7 },
    { desc: 'Embedding model changed', daysAgo: 5 },
    { desc: 'Output schema v2 migration', daysAgo: 3 },
    { desc: 'Fallback model switched to GPT-4o-mini', daysAgo: 1 },
  ]),
  driftAlerts: [],
};

const agent45: MockAgent = {
  agentId: 45,
  name: 'rogue-proxy',
  score: 18,
  tier: 'C',
  riskLevel: 'RED',
  route: 'sandbox_only',
  chainLength: 22,
  firstChangeDate: Date.now() - 14 * 86_400_000,
  lastChangeDate: Date.now() - 3600_000,
  lastChangeDescription: 'Subprocess spawned: sh -c curl',
  driftFlagCount: 8,
  highestSeverity: 'critical',
  cleanLaps: 40,
  chainIntact: true,
  delegation: null,
  chain: buildChain(45, [
    { desc: 'Genesis commit', daysAgo: 14 },
    ...Array.from({ length: 17 }, (_, i) => ({
      desc: `Behavioral shift #${i + 1}`,
      daysAgo: 13 - Math.floor(i * 0.7),
    })),
    { desc: 'Dependency graph hash changed. New package: plain-crypto-js@4.2.1', daysAgo: 1 },
    { desc: 'Sensitive env var access: AWS_SECRET_ACCESS_KEY, NPM_TOKEN (first time in 200 snapshots)', daysAgo: 0.5 },
    { desc: 'Subprocess spawned: sh -c curl (agent never spawned processes before)', daysAgo: 0.04 },
  ]),
  driftAlerts: [],
};

const agent46: MockAgent = {
  agentId: 46,
  name: 'forge-validator',
  score: 90,
  tier: 'A',
  riskLevel: 'GREEN',
  route: 'prod',
  chainLength: 1,
  firstChangeDate: Date.now() - 7 * 86_400_000,
  lastChangeDate: Date.now() - 7 * 86_400_000,
  lastChangeDescription: 'Genesis commit — initial behavioral baseline',
  driftFlagCount: 0,
  highestSeverity: 'none',
  cleanLaps: 50,
  chainIntact: true,
  delegation: null,
  chain: buildChain(46, [
    { desc: 'Genesis commit — initial behavioral baseline', daysAgo: 7 },
  ]),
  driftAlerts: [],
};

const agent47: MockAgent = {
  agentId: 47,
  name: 'delegate-prime',
  score: 95,
  tier: 'AAA',
  riskLevel: 'GREEN',
  route: 'prod',
  chainLength: 2,
  firstChangeDate: Date.now() - 365 * 86_400_000,
  lastChangeDate: Date.now() - 90 * 86_400_000,
  lastChangeDescription: 'Certificate rotation — annual key update',
  driftFlagCount: 0,
  highestSeverity: 'none',
  cleanLaps: 600,
  chainIntact: true,
  delegation: {
    humanNullifierHash: hash('world-id-nullifier-agent-47'),
    delegationTimestamp: Date.now() - 400 * 86_400_000,
  },
  chain: buildChain(47, [
    { desc: 'Genesis commit — initial behavioral baseline', daysAgo: 365 },
    { desc: 'Certificate rotation — annual key update', daysAgo: 90 },
  ]),
  driftAlerts: [],
};

const agent99: MockAgent = {
  agentId: 99,
  name: 'tampered-test',
  score: 60,
  tier: 'B',
  riskLevel: 'YELLOW',
  route: 'sandbox',
  chainLength: 3,
  firstChangeDate: Date.now() - 30 * 86_400_000,
  lastChangeDate: Date.now() - 10 * 86_400_000,
  lastChangeDescription: 'Model swap',
  driftFlagCount: 1,
  highestSeverity: 'high',
  cleanLaps: 30,
  chainIntact: false,
  delegation: null,
  chain: buildTamperedChain(99),
  driftAlerts: [],
};

// ---------------------------------------------------------------------------
// Build cross-references (alerts depend on chains)
// ---------------------------------------------------------------------------

const AGENTS_MAP = new Map<number, MockAgent>();
[agent42, agent43, agent44, agent45, agent46, agent47, agent99].forEach((a) =>
  AGENTS_MAP.set(a.agentId, a),
);

// Populate drift alerts after chains are built
agent43.driftAlerts = [
  makeAlert('43', 5, 'medium', [
    { dimension: 'score_drop', previous: 98, current: 82, description: 'Score dropped by 16 points (threshold: 15)' },
  ], 38),
  makeAlert('43', 7, 'medium', [
    { dimension: 'hash_change', previous: 'n/a', current: 'n/a', description: 'Behavioral snapshot hash changed (confirmed by on-chain commit)' },
  ], 5),
];

agent44.driftAlerts = [
  makeAlert('44', 2, 'medium', [
    { dimension: 'hash_change', previous: 'n/a', current: 'n/a', description: 'Behavioral snapshot hash changed (confirmed by on-chain commit)' },
    { dimension: 'score_drop', previous: 73, current: 55, description: 'Score dropped by 18 points (threshold: 15)' },
  ], 38),
  makeAlert('44', 10, 'medium', [
    { dimension: 'tier_downgrade', previous: 'A', current: 'BA', description: 'Tier downgraded from A to BA' },
  ], 9),
  makeAlert('44', 11, 'high', [
    { dimension: 'route_change', previous: 'prod', current: 'prod_throttled', description: 'Route changed from prod to prod_throttled' },
  ], 7),
  makeAlert('44', 12, 'medium', [
    { dimension: 'risk_escalation', previous: 'GREEN', current: 'YELLOW', description: 'Risk level escalated from GREEN to YELLOW' },
  ], 5),
  makeAlert('44', 14, 'medium', [
    { dimension: 'score_drop', previous: 62, current: 55, description: 'Score dropped by 7 points after model swap' },
  ], 1),
];

agent45.driftAlerts = [
  makeAlert('45', 5, 'medium', [
    { dimension: 'score_drop', previous: 85, current: 68, description: 'Score dropped by 17 points (threshold: 15)' },
  ], 10),
  makeAlert('45', 8, 'medium', [
    { dimension: 'tier_downgrade', previous: 'A', current: 'BA', description: 'Tier downgraded from A to BA' },
  ], 8),
  makeAlert('45', 12, 'high', [
    { dimension: 'score_drop', previous: 68, current: 40, description: 'Score dropped by 28 points (threshold: 15)' },
    { dimension: 'route_change', previous: 'prod', current: 'prod_throttled', description: 'Route changed from prod to prod_throttled' },
  ], 5),
  makeAlert('45', 15, 'high', [
    { dimension: 'tier_downgrade', previous: 'BA', current: 'CA', description: 'Tier downgraded from BA to CA' },
  ], 3),
  makeAlert('45', 18, 'critical', [
    { dimension: 'hash_change', previous: 'n/a', current: 'n/a', description: 'Behavioral snapshot hash changed (confirmed by on-chain commit)' },
    { dimension: 'score_cliff', previous: 'GREEN', current: 'RED', description: 'Risk level jumped from GREEN to RED in one evaluation' },
  ], 2),
  makeAlert('45', 19, 'critical', [
    { dimension: 'dependency_change', previous: 'n/a', current: 'plain-crypto-js@4.2.1', description: 'Dependency graph hash changed. New package: plain-crypto-js@4.2.1' },
  ], 1),
  makeAlert('45', 20, 'critical', [
    { dimension: 'env_access', previous: 0, current: 2, description: 'Sensitive env var access: AWS_SECRET_ACCESS_KEY, NPM_TOKEN (first time in 200 snapshots)' },
    { dimension: 'route_change', previous: 'prod_throttled', current: 'sandbox_only', description: 'Route changed from prod_throttled to sandbox_only' },
  ], 0.5),
  makeAlert('45', 21, 'critical', [
    { dimension: 'subprocess_spawn', previous: 0, current: 1, description: 'Subprocess spawned: sh -c curl (agent never spawned processes before)' },
    { dimension: 'tier_downgrade', previous: 'CA', current: 'C', description: 'Tier downgraded from CA to C' },
  ], 0.04),
];

agent99.driftAlerts = [
  makeAlert('99', 2, 'high', [
    { dimension: 'hash_change', previous: 'n/a', current: 'n/a', description: 'Chain integrity broken at index 2' },
  ], 10),
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const AGENTS: MockAgent[] = [agent42, agent43, agent44, agent45, agent46, agent47, agent99];

export function getAgent(agentId: number): MockAgent | undefined {
  return AGENTS_MAP.get(agentId);
}

export function getAllAlerts(): DriftAlert[] {
  return AGENTS.flatMap((a) => a.driftAlerts).sort((a, b) => b.timestamp - a.timestamp);
}

export function getLeaderboard(): MockAgent[] {
  return [...AGENTS]
    .filter((a) => a.agentId !== 99)
    .sort((a, b) => {
      const aDays = Math.max(1, (Date.now() - a.firstChangeDate) / 86_400_000);
      const bDays = Math.max(1, (Date.now() - b.firstChangeDate) / 86_400_000);
      const aRate = a.chainLength / aDays * 30;
      const bRate = b.chainLength / bDays * 30;
      return aRate - bRate;
    });
}

export function getStats() {
  const realAgents = AGENTS.filter((a) => a.agentId !== 99);
  const totalChanges = realAgents.reduce((s, a) => s + a.chainLength, 0);
  const totalAlerts = realAgents.reduce((s, a) => s + a.driftAlerts.length, 0);
  const totalLaps = realAgents.reduce((s, a) => s + a.cleanLaps, 0);
  const intactCount = realAgents.filter((a) => a.chainIntact).length;

  return {
    totalAgents: realAgents.length,
    totalBehavioralChanges: totalChanges,
    totalDriftAlerts: totalAlerts,
    driftDetectionRate: totalAlerts > 0 ? '100%' : '0%',
    averageCleanLaps: Math.round(totalLaps / realAgents.length),
    chainIntegrityRate: `${Math.round((intactCount / realAgents.length) * 100)}%`,
    industryAvgDetectionDays: 267,
    behaviorChainDetectionSeconds: 5,
  };
}

export function verifyChain(chain: ChainNode[]): { valid: boolean; brokenAt?: number } {
  if (chain.length === 0) return { valid: true };

  if (chain[0].previousHash !== ZERO_HASH) {
    return { valid: false, brokenAt: 0 };
  }

  for (let i = 1; i < chain.length; i++) {
    if (chain[i].previousHash !== chain[i - 1].snapshotHash) {
      return { valid: false, brokenAt: i };
    }
  }

  return { valid: true };
}

// Rotating mock alerts for SSE simulation
const LIVE_ALERT_TEMPLATES: Array<{
  agentId: string;
  severity: Severity;
  signals: DriftSignal[];
}> = [
  {
    agentId: '45',
    severity: 'critical',
    signals: [
      { dimension: 'subprocess_spawn', previous: 0, current: 1, description: 'Subprocess spawned: sh -c curl (agent never spawned processes before)' },
    ],
  },
  {
    agentId: '44',
    severity: 'medium',
    signals: [
      { dimension: 'score_drop', previous: 62, current: 55, description: 'Score dropped by 7 points after model swap' },
    ],
  },
  {
    agentId: '45',
    severity: 'critical',
    signals: [
      { dimension: 'env_access', previous: 0, current: 2, description: 'Sensitive env var access: AWS_SECRET_ACCESS_KEY, NPM_TOKEN (first time in 200 snapshots)' },
    ],
  },
  {
    agentId: '43',
    severity: 'low',
    signals: [
      { dimension: 'hash_change', previous: 'n/a', current: 'n/a', description: 'Behavioral snapshot hash changed (confirmed by on-chain commit)' },
    ],
  },
  {
    agentId: '45',
    severity: 'critical',
    signals: [
      { dimension: 'dependency_change', previous: 'n/a', current: 'plain-crypto-js@4.2.1', description: 'Dependency graph hash changed. New package: plain-crypto-js@4.2.1' },
    ],
  },
];

let alertCounter = 100;

export function generateLiveAlert(): DriftAlert {
  const template = LIVE_ALERT_TEMPLATES[alertCounter % LIVE_ALERT_TEMPLATES.length];
  alertCounter++;
  return {
    agentId: template.agentId,
    chainId: 84532,
    snapshotIndex: alertCounter,
    previousSnapshotHash: hash(`live-prev-${alertCounter}`),
    currentSnapshotHash: hash(`live-curr-${alertCounter}`),
    driftSignals: template.signals,
    severity: template.severity,
    timestamp: Date.now(),
  };
}

export function formatHash(h: string): string {
  if (h.length <= 14) return h;
  return `${h.slice(0, 8)}…${h.slice(-4)}`;
}
