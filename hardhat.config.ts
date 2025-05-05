import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@typechain/hardhat";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
import "hardhat-deploy";

import path from "path";

import "dotenv/config";

const PRIVATE_KEY = process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    },
  },
  paths: {
    deploy: path.join(__dirname, "scripts/deploy"),
  },
  networks: {
    hardhat: {
      // forking: {
      //   url: process.env.INFURA_SEPOLIA_URL as string,
      //   // blockNumber: 331152474,
      // },
    },
    sepolia: {
      chainId: 11155111,
      url: process.env.INFURA_SEPOLIA_URL,
      accounts: PRIVATE_KEY,
    },
  },
  namedAccounts: {
    deployer: {
      default: 0, // first account in `accounts` array
    },
  },
  mocha: {
    timeout: 100000000,
  },
};

export default config;
