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
    base: {
      url: process.env.BEHAVIORCHAIN_RPC_URL || "https://mainnet.base.org",
      chainId: 8453,
      accounts: process.env.BEHAVIORCHAIN_PRIVATE_KEY
        ? [process.env.BEHAVIORCHAIN_PRIVATE_KEY]
        : [],
    },
  },
  etherscan: {
    apiKey: {
      baseSepolia: process.env.BASESCAN_API_KEY || "",
      base: process.env.BASESCAN_API_KEY || "",
    },
    customChains: [
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org",
        },
      },
    ],
  },
};

export default config;
