import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    baseSepolia: {
      url: process.env.BEHAVIORCHAIN_RPC_URL || "https://sepolia.base.org",
      chainId: 84532,
      accounts: process.env.BEHAVIORCHAIN_PRIVATE_KEY
        ? [process.env.BEHAVIORCHAIN_PRIVATE_KEY]
        : [],
    },
  },
};

export default config;
