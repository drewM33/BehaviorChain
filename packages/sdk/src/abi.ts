export const BEHAVIOR_SNAPSHOT_REGISTRY_ABI = [
  {
    inputs: [{ internalType: 'address', name: '_identityRegistry', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },

  // Errors
  {
    inputs: [
      { internalType: 'uint256', name: 'agentId', type: 'uint256' },
      { internalType: 'bytes32', name: 'expected', type: 'bytes32' },
      { internalType: 'bytes32', name: 'provided', type: 'bytes32' },
    ],
    name: 'ChainContinuityBroken',
    type: 'error',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'agentId', type: 'uint256' }],
    name: 'InvalidGenesis',
    type: 'error',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'agentId', type: 'uint256' },
      { internalType: 'uint256', name: 'provided', type: 'uint256' },
      { internalType: 'uint256', name: 'max', type: 'uint256' },
    ],
    name: 'InvalidSnapshotIndex',
    type: 'error',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'agentId', type: 'uint256' },
      { internalType: 'address', name: 'caller', type: 'address' },
    ],
    name: 'NotAgentOwner',
    type: 'error',
  },

  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'uint256', name: 'agentId', type: 'uint256' },
      { indexed: true, internalType: 'uint256', name: 'snapshotIndex', type: 'uint256' },
      { indexed: false, internalType: 'bytes32', name: 'snapshotHash', type: 'bytes32' },
      { indexed: false, internalType: 'bytes32', name: 'previousHash', type: 'bytes32' },
      { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' },
      { indexed: false, internalType: 'string', name: 'encryptedDataUri', type: 'string' },
    ],
    name: 'SnapshotCommitted',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'uint256', name: 'agentId', type: 'uint256' },
      { indexed: true, internalType: 'uint256', name: 'snapshotIndex', type: 'uint256' },
      { indexed: true, internalType: 'address', name: 'flagger', type: 'address' },
      { indexed: false, internalType: 'string', name: 'reason', type: 'string' },
    ],
    name: 'DriftFlagged',
    type: 'event',
  },

  // Functions
  {
    inputs: [{ internalType: 'uint256', name: 'agentId', type: 'uint256' }],
    name: 'chainHeads',
    outputs: [{ internalType: 'bytes32', name: 'headHash', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'agentId', type: 'uint256' },
      { internalType: 'bytes32', name: 'snapshotHash', type: 'bytes32' },
      { internalType: 'bytes32', name: 'previousHash', type: 'bytes32' },
      { internalType: 'string', name: 'encryptedDataUri', type: 'string' },
    ],
    name: 'commitSnapshot',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'agentId', type: 'uint256' },
      { internalType: 'uint256', name: 'snapshotIndex', type: 'uint256' },
      { internalType: 'string', name: 'reason', type: 'string' },
    ],
    name: 'flagDrift',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'agentId', type: 'uint256' }],
    name: 'getChainHead',
    outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'agentId', type: 'uint256' }],
    name: 'getLastCommitTimestamp',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'agentId', type: 'uint256' }],
    name: 'getSnapshotCount',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'identityRegistry',
    outputs: [
      { internalType: 'contract IERC8004IdentityRegistry', name: '', type: 'address' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'agentId', type: 'uint256' }],
    name: 'lastCommits',
    outputs: [{ internalType: 'uint256', name: 'lastCommitTimestamp', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'agentId', type: 'uint256' }],
    name: 'snapshotCounts',
    outputs: [{ internalType: 'uint256', name: 'snapshotCount', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'agentId', type: 'uint256' },
      { internalType: 'bytes32[]', name: 'hashes', type: 'bytes32[]' },
    ],
    name: 'verifyChainContinuity',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;
