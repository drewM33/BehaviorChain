// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC8004IdentityRegistry} from "./IERC8004IdentityRegistry.sol";

contract BehaviorSnapshotRegistry {
    IERC8004IdentityRegistry public immutable identityRegistry;

    mapping(uint256 agentId => bytes32 headHash) public chainHeads;
    mapping(uint256 agentId => uint256 snapshotCount) public snapshotCounts;
    mapping(uint256 agentId => uint256 lastCommitTimestamp) public lastCommits;

    event SnapshotCommitted(
        uint256 indexed agentId,
        uint256 indexed snapshotIndex,
        bytes32 snapshotHash,
        bytes32 previousHash,
        uint256 timestamp,
        string encryptedDataUri
    );

    event DriftFlagged(
        uint256 indexed agentId,
        uint256 indexed snapshotIndex,
        address indexed flagger,
        string reason
    );

    error NotAgentOwner(uint256 agentId, address caller);
    error ChainContinuityBroken(uint256 agentId, bytes32 expected, bytes32 provided);
    error InvalidGenesis(uint256 agentId);
    error InvalidSnapshotIndex(uint256 agentId, uint256 provided, uint256 max);

    constructor(address _identityRegistry) {
        identityRegistry = IERC8004IdentityRegistry(_identityRegistry);
    }

    modifier onlyAgentOwner(uint256 agentId) {
        address owner = identityRegistry.ownerOf(agentId);
        if (msg.sender != owner) {
            revert NotAgentOwner(agentId, msg.sender);
        }
        _;
    }

    function commitSnapshot(
        uint256 agentId,
        bytes32 snapshotHash,
        bytes32 previousHash,
        string calldata encryptedDataUri
    ) external onlyAgentOwner(agentId) {
        uint256 count = snapshotCounts[agentId];

        if (count == 0) {
            if (previousHash != bytes32(0)) {
                revert InvalidGenesis(agentId);
            }
        } else {
            if (previousHash != chainHeads[agentId]) {
                revert ChainContinuityBroken(agentId, chainHeads[agentId], previousHash);
            }
        }

        chainHeads[agentId] = snapshotHash;
        snapshotCounts[agentId] = count + 1;
        lastCommits[agentId] = block.timestamp;

        emit SnapshotCommitted(
            agentId,
            count,
            snapshotHash,
            previousHash,
            block.timestamp,
            encryptedDataUri
        );
    }

    function getChainHead(uint256 agentId) external view returns (bytes32) {
        return chainHeads[agentId];
    }

    function getSnapshotCount(uint256 agentId) external view returns (uint256) {
        return snapshotCounts[agentId];
    }

    function getLastCommitTimestamp(uint256 agentId) external view returns (uint256) {
        return lastCommits[agentId];
    }

    function flagDrift(
        uint256 agentId,
        uint256 snapshotIndex,
        string calldata reason
    ) external {
        uint256 count = snapshotCounts[agentId];
        if (snapshotIndex >= count) {
            revert InvalidSnapshotIndex(agentId, snapshotIndex, count);
        }

        emit DriftFlagged(agentId, snapshotIndex, msg.sender, reason);
    }

    function verifyChainContinuity(
        uint256 agentId,
        bytes32[] calldata hashes
    ) external view returns (bool) {
        uint256 count = snapshotCounts[agentId];
        if (hashes.length != count) {
            return false;
        }
        if (count == 0) {
            return true;
        }
        if (hashes[count - 1] != chainHeads[agentId]) {
            return false;
        }
        return true;
    }
}
