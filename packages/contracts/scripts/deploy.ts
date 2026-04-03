import { ethers, run, network } from "hardhat";

const ERC8004_IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";

async function main() {
  const [deployer] = await ethers.getSigners();
  const networkName = network.name;

  console.log(`Deploying BehaviorSnapshotRegistry to ${networkName}...`);
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

  // Auto-verify on supported networks
  if (networkName === "baseSepolia" || networkName === "base") {
    console.log("\nWaiting for block confirmations before verification...");
    const tx = registry.deploymentTransaction();
    if (tx) await tx.wait(5);

    try {
      await run("verify:verify", {
        address,
        constructorArguments: [ERC8004_IDENTITY_REGISTRY],
      });
      console.log("Contract verified on BaseScan");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Already Verified")) {
        console.log("Contract already verified");
      } else {
        console.log("Verification failed:", msg);
        console.log("Manual verify command:");
        console.log(
          `  npx hardhat verify --network ${networkName} ${address} "${ERC8004_IDENTITY_REGISTRY}"`
        );
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
