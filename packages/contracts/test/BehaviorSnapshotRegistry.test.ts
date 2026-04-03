import { expect } from "chai";
import { ethers } from "hardhat";
import { BehaviorSnapshotRegistry, MockIdentityRegistry } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("BehaviorSnapshotRegistry", function () {
  let registry: BehaviorSnapshotRegistry;
  let identityRegistry: MockIdentityRegistry;
  let owner: SignerWithAddress;
  let nonOwner: SignerWithAddress;
  let flagger: SignerWithAddress;

  const AGENT_ID = 42n;
  const ZERO_HASH = ethers.ZeroHash;

  function randomHash(): string {
    return ethers.keccak256(ethers.randomBytes(32));
  }

  beforeEach(async function () {
    [owner, nonOwner, flagger] = await ethers.getSigners();

    const MockFactory = await ethers.getContractFactory("MockIdentityRegistry");
    identityRegistry = await MockFactory.deploy();
    await identityRegistry.waitForDeployment();

    await identityRegistry.setOwner(AGENT_ID, owner.address);

    const RegistryFactory = await ethers.getContractFactory("BehaviorSnapshotRegistry");
    registry = await RegistryFactory.deploy(await identityRegistry.getAddress());
    await registry.waitForDeployment();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Milestone 1: Contract deployed (verified at deployment time; tested via fixture)
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Milestone 1 — Deployment", function () {
    it("deploys with the correct identity registry address", async function () {
      expect(await registry.identityRegistry()).to.equal(
        await identityRegistry.getAddress()
      );
    });

    it("starts with zero state for any agentId", async function () {
      expect(await registry.getChainHead(AGENT_ID)).to.equal(ZERO_HASH);
      expect(await registry.getSnapshotCount(AGENT_ID)).to.equal(0n);
      expect(await registry.getLastCommitTimestamp(AGENT_ID)).to.equal(0n);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Milestone 2: Correct previousHash → event emitted
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Milestone 2 — Correct previousHash emits event", function () {
    it("emits SnapshotCommitted on genesis commit", async function () {
      const hash = randomHash();
      const tx = registry.commitSnapshot(AGENT_ID, hash, ZERO_HASH, "ipfs://genesis");
      await expect(tx)
        .to.emit(registry, "SnapshotCommitted")
        .withArgs(AGENT_ID, 0n, hash, ZERO_HASH, (t: bigint) => t > 0n, "ipfs://genesis");
    });

    it("emits SnapshotCommitted on subsequent commit with correct previousHash", async function () {
      const hash1 = randomHash();
      await registry.commitSnapshot(AGENT_ID, hash1, ZERO_HASH, "");

      const hash2 = randomHash();
      const tx = registry.commitSnapshot(AGENT_ID, hash2, hash1, "ipfs://second");
      await expect(tx)
        .to.emit(registry, "SnapshotCommitted")
        .withArgs(AGENT_ID, 1n, hash2, hash1, (t: bigint) => t > 0n, "ipfs://second");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Milestone 3: Wrong previousHash → revert
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Milestone 3 — Wrong previousHash reverts", function () {
    it("reverts when previousHash does not match chain head", async function () {
      const hash1 = randomHash();
      await registry.commitSnapshot(AGENT_ID, hash1, ZERO_HASH, "");

      const wrongPrevious = randomHash();
      const hash2 = randomHash();

      await expect(
        registry.commitSnapshot(AGENT_ID, hash2, wrongPrevious, "")
      ).to.be.revertedWithCustomError(registry, "ChainContinuityBroken")
        .withArgs(AGENT_ID, hash1, wrongPrevious);
    });

    it("reverts when using zero hash after genesis already committed", async function () {
      const hash1 = randomHash();
      await registry.commitSnapshot(AGENT_ID, hash1, ZERO_HASH, "");

      const hash2 = randomHash();
      await expect(
        registry.commitSnapshot(AGENT_ID, hash2, ZERO_HASH, "")
      ).to.be.revertedWithCustomError(registry, "ChainContinuityBroken");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Milestone 4: Genesis accepted only when snapshotCount is 0
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Milestone 4 — Genesis handling", function () {
    it("accepts genesis commit (previousHash = 0x0, snapshotCount = 0)", async function () {
      const hash = randomHash();
      await expect(
        registry.commitSnapshot(AGENT_ID, hash, ZERO_HASH, "")
      ).to.not.be.reverted;
    });

    it("rejects non-zero previousHash when snapshotCount is 0", async function () {
      const hash = randomHash();
      const fakePrev = randomHash();
      await expect(
        registry.commitSnapshot(AGENT_ID, hash, fakePrev, "")
      ).to.be.revertedWithCustomError(registry, "InvalidGenesis")
        .withArgs(AGENT_ID);
    });

    it("rejects genesis-style commit (previousHash = 0x0) after chain already started", async function () {
      const hash1 = randomHash();
      await registry.commitSnapshot(AGENT_ID, hash1, ZERO_HASH, "");

      const hash2 = randomHash();
      await expect(
        registry.commitSnapshot(AGENT_ID, hash2, ZERO_HASH, "")
      ).to.be.revertedWithCustomError(registry, "ChainContinuityBroken");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Milestone 5: getChainHead correct after N commits
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Milestone 5 — getChainHead correct after N commits", function () {
    it("returns correct chain head after 1 commit", async function () {
      const hash = randomHash();
      await registry.commitSnapshot(AGENT_ID, hash, ZERO_HASH, "");
      expect(await registry.getChainHead(AGENT_ID)).to.equal(hash);
    });

    it("returns correct chain head after 5 sequential commits", async function () {
      let prevHash = ZERO_HASH;
      let currentHash = "";

      for (let i = 0; i < 5; i++) {
        currentHash = randomHash();
        await registry.commitSnapshot(AGENT_ID, currentHash, prevHash, `ipfs://${i}`);
        prevHash = currentHash;
      }

      expect(await registry.getChainHead(AGENT_ID)).to.equal(currentHash);
      expect(await registry.getSnapshotCount(AGENT_ID)).to.equal(5n);
    });

    it("tracks independent chains for different agentIds", async function () {
      const AGENT_B = 99n;
      await identityRegistry.setOwner(AGENT_B, owner.address);

      const hashA = randomHash();
      const hashB = randomHash();

      await registry.commitSnapshot(AGENT_ID, hashA, ZERO_HASH, "");
      await registry.commitSnapshot(AGENT_B, hashB, ZERO_HASH, "");

      expect(await registry.getChainHead(AGENT_ID)).to.equal(hashA);
      expect(await registry.getChainHead(AGENT_B)).to.equal(hashB);
      expect(await registry.getSnapshotCount(AGENT_ID)).to.equal(1n);
      expect(await registry.getSnapshotCount(AGENT_B)).to.equal(1n);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Milestone 6: Events reconstruct full chain
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Milestone 6 — Events reconstruct full chain", function () {
    it("can reconstruct the full hash chain from SnapshotCommitted events", async function () {
      const hashes: string[] = [];
      let prev = ZERO_HASH;

      for (let i = 0; i < 4; i++) {
        const h = randomHash();
        hashes.push(h);
        await registry.commitSnapshot(AGENT_ID, h, prev, `ipfs://snap-${i}`);
        prev = h;
      }

      const filter = registry.filters.SnapshotCommitted(AGENT_ID);
      const events = await registry.queryFilter(filter);

      expect(events.length).to.equal(4);

      // Verify chain linkage from events
      expect(events[0].args.previousHash).to.equal(ZERO_HASH);
      for (let i = 1; i < events.length; i++) {
        expect(events[i].args.previousHash).to.equal(events[i - 1].args.snapshotHash);
      }

      // Verify final event hash matches chain head
      expect(events[events.length - 1].args.snapshotHash).to.equal(
        await registry.getChainHead(AGENT_ID)
      );

      // Verify all hashes present
      for (let i = 0; i < hashes.length; i++) {
        expect(events[i].args.snapshotHash).to.equal(hashes[i]);
        expect(events[i].args.snapshotIndex).to.equal(BigInt(i));
      }

      // Verify encryptedDataUri preserved
      for (let i = 0; i < events.length; i++) {
        expect(events[i].args.encryptedDataUri).to.equal(`ipfs://snap-${i}`);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Milestone 7: Unauthorized caller reverts
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Milestone 7 — Unauthorized caller reverts", function () {
    it("reverts when non-owner calls commitSnapshot", async function () {
      const hash = randomHash();
      await expect(
        registry.connect(nonOwner).commitSnapshot(AGENT_ID, hash, ZERO_HASH, "")
      ).to.be.revertedWithCustomError(registry, "NotAgentOwner")
        .withArgs(AGENT_ID, nonOwner.address);
    });

    it("allows only the registered owner to commit", async function () {
      const hash = randomHash();
      await expect(
        registry.connect(owner).commitSnapshot(AGENT_ID, hash, ZERO_HASH, "")
      ).to.not.be.reverted;
    });

    it("flagDrift is permissionless (anyone can flag)", async function () {
      const hash = randomHash();
      await registry.commitSnapshot(AGENT_ID, hash, ZERO_HASH, "");

      await expect(
        registry.connect(flagger).flagDrift(AGENT_ID, 0, "suspicious behavior")
      ).to.emit(registry, "DriftFlagged")
        .withArgs(AGENT_ID, 0n, flagger.address, "suspicious behavior");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Milestone 8: ABI + address published (verified via artifact generation)
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Milestone 8 — ABI availability", function () {
    it("contract ABI is accessible from artifacts", async function () {
      const factory = await ethers.getContractFactory("BehaviorSnapshotRegistry");
      const abi = factory.interface;

      expect(abi.getFunction("commitSnapshot")).to.not.be.null;
      expect(abi.getFunction("getChainHead")).to.not.be.null;
      expect(abi.getFunction("getSnapshotCount")).to.not.be.null;
      expect(abi.getFunction("getLastCommitTimestamp")).to.not.be.null;
      expect(abi.getFunction("flagDrift")).to.not.be.null;
      expect(abi.getFunction("verifyChainContinuity")).to.not.be.null;

      expect(abi.getEvent("SnapshotCommitted")).to.not.be.null;
      expect(abi.getEvent("DriftFlagged")).to.not.be.null;
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Additional coverage: flagDrift, verifyChainContinuity, edge cases
  // ─────────────────────────────────────────────────────────────────────────────

  describe("flagDrift", function () {
    it("reverts when flagging a snapshotIndex that does not exist", async function () {
      await expect(
        registry.flagDrift(AGENT_ID, 0, "drift")
      ).to.be.revertedWithCustomError(registry, "InvalidSnapshotIndex");
    });

    it("allows flagging a valid snapshot index", async function () {
      await registry.commitSnapshot(AGENT_ID, randomHash(), ZERO_HASH, "");
      await expect(
        registry.connect(flagger).flagDrift(AGENT_ID, 0, "score dropped")
      ).to.emit(registry, "DriftFlagged");
    });
  });

  describe("verifyChainContinuity", function () {
    it("returns true for an empty chain with empty hashes array", async function () {
      expect(await registry.verifyChainContinuity(AGENT_ID, [])).to.be.true;
    });

    it("returns false when hashes array length does not match snapshot count", async function () {
      const h = randomHash();
      await registry.commitSnapshot(AGENT_ID, h, ZERO_HASH, "");
      expect(await registry.verifyChainContinuity(AGENT_ID, [])).to.be.false;
      expect(await registry.verifyChainContinuity(AGENT_ID, [h, h])).to.be.false;
    });

    it("returns true when last hash matches chain head", async function () {
      const h1 = randomHash();
      const h2 = randomHash();
      await registry.commitSnapshot(AGENT_ID, h1, ZERO_HASH, "");
      await registry.commitSnapshot(AGENT_ID, h2, h1, "");
      expect(await registry.verifyChainContinuity(AGENT_ID, [h1, h2])).to.be.true;
    });

    it("returns false when last hash does not match chain head", async function () {
      const h1 = randomHash();
      const h2 = randomHash();
      const h_fake = randomHash();
      await registry.commitSnapshot(AGENT_ID, h1, ZERO_HASH, "");
      await registry.commitSnapshot(AGENT_ID, h2, h1, "");
      expect(await registry.verifyChainContinuity(AGENT_ID, [h1, h_fake])).to.be.false;
    });
  });

  describe("Edge cases", function () {
    it("handles max uint256 agentId", async function () {
      const maxId = 2n ** 256n - 1n;
      await identityRegistry.setOwner(maxId, owner.address);

      const hash = randomHash();
      await expect(
        registry.commitSnapshot(maxId, hash, ZERO_HASH, "")
      ).to.emit(registry, "SnapshotCommitted");

      expect(await registry.getChainHead(maxId)).to.equal(hash);
      expect(await registry.getSnapshotCount(maxId)).to.equal(1n);
    });

    it("handles rapid sequential commits", async function () {
      let prev = ZERO_HASH;
      const count = 10;

      for (let i = 0; i < count; i++) {
        const h = randomHash();
        await registry.commitSnapshot(AGENT_ID, h, prev, "");
        prev = h;
      }

      expect(await registry.getSnapshotCount(AGENT_ID)).to.equal(BigInt(count));
      expect(await registry.getChainHead(AGENT_ID)).to.equal(prev);
    });

    it("getLastCommitTimestamp updates on each commit", async function () {
      const h1 = randomHash();
      await registry.commitSnapshot(AGENT_ID, h1, ZERO_HASH, "");
      const ts1 = await registry.getLastCommitTimestamp(AGENT_ID);
      expect(ts1).to.be.greaterThan(0n);

      const h2 = randomHash();
      await registry.commitSnapshot(AGENT_ID, h2, h1, "");
      const ts2 = await registry.getLastCommitTimestamp(AGENT_ID);
      expect(ts2).to.be.greaterThanOrEqual(ts1);
    });

    it("empty encryptedDataUri is valid", async function () {
      const hash = randomHash();
      const tx = registry.commitSnapshot(AGENT_ID, hash, ZERO_HASH, "");
      await expect(tx)
        .to.emit(registry, "SnapshotCommitted")
        .withArgs(AGENT_ID, 0n, hash, ZERO_HASH, (t: bigint) => t > 0n, "");
    });
  });

  describe("Gas measurement", function () {
    it("commitSnapshot gas cost < 100k (Base target)", async function () {
      const hash = randomHash();
      const tx = await registry.commitSnapshot(AGENT_ID, hash, ZERO_HASH, "ipfs://QmTest");
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed;
      console.log(`    Gas used for commitSnapshot: ${gasUsed.toString()}`);
      expect(gasUsed).to.be.lessThan(100_000n);
    });
  });
});
