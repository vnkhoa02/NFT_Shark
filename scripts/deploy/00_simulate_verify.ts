import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const simulateDeploy: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("⚠️ Simulation should only run on hardhat fork!");
    return;
  }

  console.log("🔧 Simulating deployment on forked mainnet...");

  // 1) Deploy the marketplace (no constructor args)
  console.log("⛓ Deploying NFTMarketplace...");
  const nftMarketplace = await deploy("NFTMarketplace", {
    from: deployer,
    args: [], // ← no args
    log: true,
  });
  console.log(`✅ NFTMarketplace deployed to: ${nftMarketplace.address}`);

  // 2) Deploy Shark721NFT with the correct constructor parameters
  console.log("🦈 Deploying Shark721NFT...");
  const shark721 = await deploy("Shark721NFT", {
    from: deployer,
    args: [
      "Shark721NFT", // name
      "SHK721", // symbol
      deployer, // royalty recipient
      500, // royaltyBps (5%)
    ],
    log: true,
  });
  console.log(`✅ Shark721NFT deployed to: ${shark721.address}`);
};

export default simulateDeploy;
simulateDeploy.tags = ["Simulate"];
