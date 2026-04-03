import { ethers } from "hardhat";

const ERC8004_IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying BehaviorSnapshotRegistry...");
  console.log("  Deployer:", deployer.address);
  console.log("  Identity Registry:", ERC8004_IDENTITY_REGISTRY);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("  Balance:", ethers.formatEther(balance), "ETH");

  const Registry = await ethers.getContractFactory("BehaviorSnapshotRegistry");
  const registry = await Registry.deploy(ERC8004_IDENTITY_REGISTRY);
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  console.log("\nBehaviorSnapshotRegistry deployed to:", address);
  console.log("\nSet BEHAVIORCHAIN_CONTRACT_ADDRESS=" + address);

  console.log("\nTo verify on Basescan:");
  console.log(
    `  npx hardhat verify --network baseSepolia ${address} "${ERC8004_IDENTITY_REGISTRY}"`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
