// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC8004IdentityRegistry} from "../IERC8004IdentityRegistry.sol";

/// @dev Test-only mock. Maps agentId → owner for deterministic testing.
contract MockIdentityRegistry is IERC8004IdentityRegistry {
    mapping(uint256 => address) private _owners;

    function setOwner(uint256 agentId, address owner) external {
        _owners[agentId] = owner;
    }

    function ownerOf(uint256 agentId) external view override returns (address) {
        address owner = _owners[agentId];
        require(owner != address(0), "Agent not registered");
        return owner;
    }
}
