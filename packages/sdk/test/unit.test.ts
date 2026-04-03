import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import { BehaviorChainSDK } from '../src/sdk.js';
import { fallbackSnapshot } from '../src/fallback.js';
import type { IValironSDK, CommitResult } from '../src/types.js';
import { ZERO_BYTES32 } from '../src/types.js';

const HASH_A = '0x' + 'aa'.repeat(32);
const HASH_B = '0x' + 'bb'.repeat(32);
const HASH_C = '0x' + 'cc'.repeat(32);

function mockReceipt(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    hash: '0x' + 'ff'.repeat(32),
    blockNumber: 100,
    status: 1,
    ...overrides,
  };
}

function createMockContract() {
  const receipt = mockReceipt();
  return {
    getChainHead: vi.fn<(id: bigint) => Promise<string>>(),
    getSnapshotCount: vi.fn<(id: bigint) => Promise<bigint>>(),
    commitSnapshot: vi.fn().mockResolvedValue({
      wait: vi.fn().mockResolvedValue(receipt),
    }),
    queryFilter: vi.fn().mockResolvedValue([]),
    filters: {
      SnapshotCommitted: vi.fn().mockReturnValue('mock-filter'),
    },
  };
}

function createMockValiron() {
  return {
    getAgentSnapshot: vi.fn(),
    getAgentProfile: vi.fn(),
  } satisfies IValironSDK;
}

function buildSDK(
  contract: ReturnType<typeof createMockContract>,
  valiron: ReturnType<typeof createMockValiron>,
) {
  return new BehaviorChainSDK({
    rpcUrl: 'http://unused',
    privateKey: '0x' + '11'.repeat(32),
    contractAddress: '0x' + '22'.repeat(20),
    valiron,
    _contractOverride: contract,
  });
}

// ==========================================================================
// Milestone 1: @behaviorchain/sdk installs with @valiron/sdk as dependency
// ==========================================================================

describe('Milestone 1 — Package dependency', () => {
  it('package.json lists @valiron/sdk@^0.10.0 as a dependency', async () => {
    // Dynamic import of the package manifest
    const fs = await import('node:fs');
    const path = await import('node:path');
    const pkgPath = path.resolve(__dirname, '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    expect(pkg.dependencies['@valiron/sdk']).toBe('^0.10.0');
  });
});

// ==========================================================================
// Milestone 2: commitIfChanged returns { committed: false } when hash matches
// ==========================================================================

describe('Milestone 2 — No commit when hash matches chain head (zero gas)', () => {
  let contract: ReturnType<typeof createMockContract>;
  let valiron: ReturnType<typeof createMockValiron>;
  let sdk: BehaviorChainSDK;

  beforeEach(() => {
    contract = createMockContract();
    valiron = createMockValiron();
    sdk = buildSDK(contract, valiron);
  });

  it('returns { committed: false } and does NOT call commitSnapshot', async () => {
    valiron.getAgentSnapshot.mockResolvedValue({
      agentId: '42',
      snapshotHash: HASH_A,
      previousHash: ZERO_BYTES32,
      encryptedDataUri: null,
      timestamp: null,
      interactionCount: 10,
    });
    contract.getChainHead.mockResolvedValue(HASH_A);

    const result = await sdk.commitIfChanged('42');

    expect(result.committed).toBe(false);
    expect(result.snapshotHash).toBe(HASH_A);
    expect(result.tx).toBeUndefined();
    expect(contract.commitSnapshot).not.toHaveBeenCalled();
  });

  it('handles case-insensitive hash comparison', async () => {
    const upper = '0x' + 'AA'.repeat(32);
    const lower = '0x' + 'aa'.repeat(32);
    valiron.getAgentSnapshot.mockResolvedValue({
      agentId: '42',
      snapshotHash: upper,
      previousHash: ZERO_BYTES32,
      encryptedDataUri: null,
      timestamp: null,
      interactionCount: 5,
    });
    contract.getChainHead.mockResolvedValue(lower);

    const result = await sdk.commitIfChanged('42');
    expect(result.committed).toBe(false);
    expect(contract.commitSnapshot).not.toHaveBeenCalled();
  });
});

// ==========================================================================
// Milestone 3: commitIfChanged returns { committed: true, tx } when differs
// ==========================================================================

describe('Milestone 3 — Commit when hash differs', () => {
  let contract: ReturnType<typeof createMockContract>;
  let valiron: ReturnType<typeof createMockValiron>;
  let sdk: BehaviorChainSDK;

  beforeEach(() => {
    contract = createMockContract();
    valiron = createMockValiron();
    sdk = buildSDK(contract, valiron);
  });

  it('returns { committed: true } with tx receipt and previous hash', async () => {
    valiron.getAgentSnapshot.mockResolvedValue({
      agentId: '42',
      snapshotHash: HASH_B,
      previousHash: HASH_A,
      encryptedDataUri: 'ipfs://encrypted',
      timestamp: '2026-04-03T00:00:00Z',
      interactionCount: 15,
    });
    contract.getChainHead.mockResolvedValue(HASH_A);

    const result = await sdk.commitIfChanged('42');

    expect(result.committed).toBe(true);
    expect(result.tx).toBeDefined();
    expect(result.snapshotHash).toBe(HASH_B);
    expect(result.previousHash).toBe(HASH_A);
    expect(contract.commitSnapshot).toHaveBeenCalledWith(
      BigInt(42),
      HASH_B,
      HASH_A,
      'ipfs://encrypted',
    );
  });
});

// ==========================================================================
// Milestone 4: Genesis snapshot committed with previousHash 0x0
// ==========================================================================

describe('Milestone 4 — Genesis commit', () => {
  it('commits genesis with previousHash = ZERO_BYTES32 when chain is empty', async () => {
    const contract = createMockContract();
    const valiron = createMockValiron();
    const sdk = buildSDK(contract, valiron);

    valiron.getAgentSnapshot.mockResolvedValue({
      agentId: '42',
      snapshotHash: HASH_A,
      previousHash: ZERO_BYTES32,
      encryptedDataUri: null,
      timestamp: null,
      interactionCount: 1,
    });
    contract.getChainHead.mockResolvedValue(ZERO_BYTES32);

    const result = await sdk.commitIfChanged('42');

    expect(result.committed).toBe(true);
    expect(result.previousHash).toBe(ZERO_BYTES32);
    expect(contract.commitSnapshot).toHaveBeenCalledWith(
      BigInt(42),
      HASH_A,
      ZERO_BYTES32,
      '',
    );
  });
});

// ==========================================================================
// Milestone 5: Second snapshot with different hash committed
// ==========================================================================

describe('Milestone 5 — Second snapshot commit', () => {
  it('commits second snapshot linking to the first', async () => {
    const contract = createMockContract();
    const valiron = createMockValiron();
    const sdk = buildSDK(contract, valiron);

    valiron.getAgentSnapshot.mockResolvedValue({
      agentId: '42',
      snapshotHash: HASH_B,
      previousHash: HASH_A,
      encryptedDataUri: 'ipfs://data2',
      timestamp: null,
      interactionCount: 20,
    });
    contract.getChainHead.mockResolvedValue(HASH_A);

    const result = await sdk.commitIfChanged('42');

    expect(result.committed).toBe(true);
    expect(result.snapshotHash).toBe(HASH_B);
    expect(result.previousHash).toBe(HASH_A);
    expect(contract.commitSnapshot).toHaveBeenCalledWith(
      BigInt(42),
      HASH_B,
      HASH_A,
      'ipfs://data2',
    );
  });
});

// ==========================================================================
// Milestone 6: Same hash as chain head → { committed: false } confirmed
// ==========================================================================

describe('Milestone 6 — Duplicate hash detection (exit metric: 10 identical → 0 commits)', () => {
  it('10 identical evaluations produce 0 commits', async () => {
    const contract = createMockContract();
    const valiron = createMockValiron();
    const sdk = buildSDK(contract, valiron);

    valiron.getAgentSnapshot.mockResolvedValue({
      agentId: '42',
      snapshotHash: HASH_A,
      previousHash: ZERO_BYTES32,
      encryptedDataUri: null,
      timestamp: null,
      interactionCount: 10,
    });
    contract.getChainHead.mockResolvedValue(HASH_A);

    for (let i = 0; i < 10; i++) {
      const result = await sdk.commitIfChanged('42');
      expect(result.committed).toBe(false);
    }

    expect(contract.commitSnapshot).not.toHaveBeenCalled();
  });

  it('10 identical then 1 different → exactly 1 commit', async () => {
    const contract = createMockContract();
    const valiron = createMockValiron();
    const sdk = buildSDK(contract, valiron);

    // 10 identical
    valiron.getAgentSnapshot.mockResolvedValue({
      agentId: '42',
      snapshotHash: HASH_A,
      previousHash: ZERO_BYTES32,
      encryptedDataUri: null,
      timestamp: null,
      interactionCount: 10,
    });
    contract.getChainHead.mockResolvedValue(HASH_A);

    for (let i = 0; i < 10; i++) {
      await sdk.commitIfChanged('42');
    }
    expect(contract.commitSnapshot).toHaveBeenCalledTimes(0);

    // 1 different
    valiron.getAgentSnapshot.mockResolvedValue({
      agentId: '42',
      snapshotHash: HASH_B,
      previousHash: HASH_A,
      encryptedDataUri: null,
      timestamp: null,
      interactionCount: 11,
    });

    const result = await sdk.commitIfChanged('42');
    expect(result.committed).toBe(true);
    expect(contract.commitSnapshot).toHaveBeenCalledTimes(1);
  });
});

// ==========================================================================
// Milestone 7: verifyChain returns true for valid chain
// ==========================================================================

describe('Milestone 7 — Chain verification', () => {
  it('returns valid for an empty chain', async () => {
    const contract = createMockContract();
    const valiron = createMockValiron();
    const sdk = buildSDK(contract, valiron);

    contract.queryFilter.mockResolvedValue([]);
    const result = await sdk.verifyChain('42');

    expect(result.valid).toBe(true);
    expect(result.chainLength).toBe(0);
  });

  it('returns valid for a correctly linked 3-event chain', async () => {
    const contract = createMockContract();
    const valiron = createMockValiron();
    const sdk = buildSDK(contract, valiron);

    contract.queryFilter.mockResolvedValue([
      {
        args: {
          agentId: BigInt(42),
          snapshotIndex: BigInt(0),
          snapshotHash: HASH_A,
          previousHash: ZERO_BYTES32,
          timestamp: BigInt(1000),
          encryptedDataUri: '',
        },
        blockNumber: 1,
        transactionHash: '0xtx1',
      },
      {
        args: {
          agentId: BigInt(42),
          snapshotIndex: BigInt(1),
          snapshotHash: HASH_B,
          previousHash: HASH_A,
          timestamp: BigInt(2000),
          encryptedDataUri: '',
        },
        blockNumber: 2,
        transactionHash: '0xtx2',
      },
      {
        args: {
          agentId: BigInt(42),
          snapshotIndex: BigInt(2),
          snapshotHash: HASH_C,
          previousHash: HASH_B,
          timestamp: BigInt(3000),
          encryptedDataUri: '',
        },
        blockNumber: 3,
        transactionHash: '0xtx3',
      },
    ]);

    const result = await sdk.verifyChain('42');

    expect(result.valid).toBe(true);
    expect(result.chainLength).toBe(3);
    expect(result.events[0].previousHash).toBe(ZERO_BYTES32);
    expect(result.events[1].previousHash).toBe(HASH_A);
    expect(result.events[2].previousHash).toBe(HASH_B);
  });

  it('returns invalid for a broken chain (bad previousHash)', async () => {
    const contract = createMockContract();
    const valiron = createMockValiron();
    const sdk = buildSDK(contract, valiron);

    contract.queryFilter.mockResolvedValue([
      {
        args: {
          agentId: BigInt(42),
          snapshotIndex: BigInt(0),
          snapshotHash: HASH_A,
          previousHash: ZERO_BYTES32,
          timestamp: BigInt(1000),
          encryptedDataUri: '',
        },
        blockNumber: 1,
        transactionHash: '0xtx1',
      },
      {
        args: {
          agentId: BigInt(42),
          snapshotIndex: BigInt(1),
          snapshotHash: HASH_B,
          previousHash: HASH_C, // broken link
          timestamp: BigInt(2000),
          encryptedDataUri: '',
        },
        blockNumber: 2,
        transactionHash: '0xtx2',
      },
    ]);

    const result = await sdk.verifyChain('42');

    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(1);
  });

  it('returns invalid when genesis previousHash is not zero', async () => {
    const contract = createMockContract();
    const valiron = createMockValiron();
    const sdk = buildSDK(contract, valiron);

    contract.queryFilter.mockResolvedValue([
      {
        args: {
          agentId: BigInt(42),
          snapshotIndex: BigInt(0),
          snapshotHash: HASH_A,
          previousHash: HASH_B, // should be zero
          timestamp: BigInt(1000),
          encryptedDataUri: '',
        },
        blockNumber: 1,
        transactionHash: '0xtx1',
      },
    ]);

    const result = await sdk.verifyChain('42');

    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(0);
  });
});

// ==========================================================================
// Milestone 8: Auto-commit via webhook within 5 seconds
// ==========================================================================

describe('Milestone 8 — Auto-commit via webhook', () => {
  let contract: ReturnType<typeof createMockContract>;
  let valiron: ReturnType<typeof createMockValiron>;
  let sdk: BehaviorChainSDK;
  let closeServer: (() => Promise<void>) | null = null;

  beforeEach(() => {
    contract = createMockContract();
    valiron = createMockValiron();
    sdk = buildSDK(contract, valiron);
  });

  afterEach(async () => {
    if (closeServer) {
      await closeServer();
      closeServer = null;
    }
  });

  it('commits within 5 seconds of receiving evaluation_complete webhook', async () => {
    valiron.getAgentSnapshot.mockResolvedValue({
      agentId: '42',
      snapshotHash: HASH_B,
      previousHash: HASH_A,
      encryptedDataUri: null,
      timestamp: null,
      interactionCount: 10,
    });
    contract.getChainHead.mockResolvedValue(HASH_A);

    const onCommit = vi.fn();
    const onSkip = vi.fn();

    const { server, close } = sdk.startAutoCommit('42', {
      webhookPort: 0,
      onCommit,
      onSkip,
    });
    closeServer = close;

    await new Promise<void>((resolve) => server.once('listening', resolve));
    const port = (server.address() as { port: number }).port;

    const start = Date.now();

    await new Promise<void>((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
          res.on('end', () => {
            const body = JSON.parse(data);
            expect(body.ok).toBe(true);
            expect(body.committed).toBe(true);
            resolve();
          });
        },
      );
      req.on('error', reject);
      req.write(JSON.stringify({ event: 'evaluation_complete', agentId: '42' }));
      req.end();
    });

    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(5000);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onSkip).not.toHaveBeenCalled();
  }, 10_000);

  it('calls onSkip when hash matches chain head', async () => {
    valiron.getAgentSnapshot.mockResolvedValue({
      agentId: '42',
      snapshotHash: HASH_A,
      previousHash: ZERO_BYTES32,
      encryptedDataUri: null,
      timestamp: null,
      interactionCount: 10,
    });
    contract.getChainHead.mockResolvedValue(HASH_A);

    const onCommit = vi.fn();
    const onSkip = vi.fn();

    const { server, close } = sdk.startAutoCommit('42', {
      webhookPort: 0,
      onCommit,
      onSkip,
    });
    closeServer = close;

    await new Promise<void>((resolve) => server.once('listening', resolve));
    const port = (server.address() as { port: number }).port;

    await new Promise<void>((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
          res.on('end', () => {
            const body = JSON.parse(data);
            expect(body.committed).toBe(false);
            resolve();
          });
        },
      );
      req.on('error', reject);
      req.write(JSON.stringify({ event: 'evaluation_complete', agentId: '42' }));
      req.end();
    });

    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
  }, 10_000);

  it('responds to GET with health check', async () => {
    const { server, close } = sdk.startAutoCommit('42', {
      webhookPort: 0,
    });
    closeServer = close;

    await new Promise<void>((resolve) => server.once('listening', resolve));
    const port = (server.address() as { port: number }).port;

    await new Promise<void>((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}`, (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        res.on('end', () => {
          const body = JSON.parse(data);
          expect(body.status).toBe('listening');
          expect(body.agentId).toBe('42');
          resolve();
        });
      }).on('error', reject);
    });
  }, 10_000);
});

// ==========================================================================
// Milestone 9: Fallback mode when getAgentSnapshot returns 404
// ==========================================================================

describe('Milestone 9 — Fallback mode', () => {
  const PROFILE = {
    localReputation: { score: 85, tier: 'AAA', riskLevel: 'GREEN' },
    routing: { finalRoute: 'prod' },
    onchainReputation: { count: 50, averageScore: 4.5 },
  };

  it('uses fallback when getAgentSnapshot throws (404)', async () => {
    const contract = createMockContract();
    const valiron = createMockValiron();
    const sdk = buildSDK(contract, valiron);

    valiron.getAgentSnapshot.mockRejectedValue(new Error('404: Not Found'));
    valiron.getAgentProfile.mockResolvedValue(PROFILE);
    contract.getChainHead.mockResolvedValue(ZERO_BYTES32);

    const result = await sdk.commitIfChanged('42');

    expect(result.committed).toBe(true);
    expect(result.snapshotHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(valiron.getAgentProfile).toHaveBeenCalledWith('42');
  });

  it('fallback produces deterministic hashes from identical profile data', async () => {
    const valiron = createMockValiron();
    valiron.getAgentProfile.mockResolvedValue(PROFILE);

    const result1 = await fallbackSnapshot(valiron, '42');
    const result2 = await fallbackSnapshot(valiron, '42');

    expect(result1.snapshotHash).toBe(result2.snapshotHash);
    expect(result1.snapshotHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('fallback produces different hashes for different profiles', async () => {
    const valiron = createMockValiron();

    valiron.getAgentProfile.mockResolvedValueOnce(PROFILE);
    const result1 = await fallbackSnapshot(valiron, '42');

    valiron.getAgentProfile.mockResolvedValueOnce({
      ...PROFILE,
      localReputation: { score: 40, tier: 'BA', riskLevel: 'RED' },
    });
    const result2 = await fallbackSnapshot(valiron, '42');

    expect(result1.snapshotHash).not.toBe(result2.snapshotHash);
  });

  it('fallback returns { committed: false } when hash matches chain head', async () => {
    const contract = createMockContract();
    const valiron = createMockValiron();
    const sdk = buildSDK(contract, valiron);

    valiron.getAgentSnapshot.mockRejectedValue(new Error('404'));
    valiron.getAgentProfile.mockResolvedValue(PROFILE);

    // First call to get the fallback hash
    const fb = await fallbackSnapshot(valiron, '42');
    contract.getChainHead.mockResolvedValue(fb.snapshotHash);

    const result = await sdk.commitIfChanged('42');
    expect(result.committed).toBe(false);
    expect(result.snapshotHash).toBe(fb.snapshotHash);
    expect(contract.commitSnapshot).not.toHaveBeenCalled();
  });
});

// ==========================================================================
// Additional SDK method coverage
// ==========================================================================

describe('SDK — getChainHead & getSnapshotCount', () => {
  it('getChainHead delegates to contract', async () => {
    const contract = createMockContract();
    const valiron = createMockValiron();
    const sdk = buildSDK(contract, valiron);

    contract.getChainHead.mockResolvedValue(HASH_A);
    const head = await sdk.getChainHead('42');
    expect(head).toBe(HASH_A);
    expect(contract.getChainHead).toHaveBeenCalledWith(BigInt(42));
  });

  it('getSnapshotCount delegates to contract and returns number', async () => {
    const contract = createMockContract();
    const valiron = createMockValiron();
    const sdk = buildSDK(contract, valiron);

    contract.getSnapshotCount.mockResolvedValue(BigInt(7));
    const count = await sdk.getSnapshotCount('42');
    expect(count).toBe(7);
    expect(typeof count).toBe('number');
  });
});

describe('SDK — getSnapshotEvents', () => {
  it('returns parsed events from contract logs', async () => {
    const contract = createMockContract();
    const valiron = createMockValiron();
    const sdk = buildSDK(contract, valiron);

    contract.queryFilter.mockResolvedValue([
      {
        args: {
          agentId: BigInt(42),
          snapshotIndex: BigInt(0),
          snapshotHash: HASH_A,
          previousHash: ZERO_BYTES32,
          timestamp: BigInt(1710000000),
          encryptedDataUri: 'ipfs://genesis',
        },
        blockNumber: 50,
        transactionHash: '0xtxhash1',
      },
    ]);

    const events = await sdk.getSnapshotEvents('42');

    expect(events).toHaveLength(1);
    expect(events[0].agentId).toBe(BigInt(42));
    expect(events[0].snapshotIndex).toBe(BigInt(0));
    expect(events[0].snapshotHash).toBe(HASH_A);
    expect(events[0].previousHash).toBe(ZERO_BYTES32);
    expect(events[0].blockNumber).toBe(50);
  });
});
