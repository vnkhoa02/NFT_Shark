import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deployNFTMarketplace: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  // 1) Deploy the marketplace (no constructor args)
  console.log("⛓ Deploying NFTMarketplace...");
  const nftMarketplace = await deploy("NFTMarketplace", {
    from: deployer,
    args: [200, deployer],
    log: true,
  });
  console.log(`✅ NFTMarketplace deployed to: ${nftMarketplace.address}`);

  // 2) Deploy Shark721NFT with the correct constructor parameters
  // console.log("🦈 Deploying Shark721NFT...");
  // const shark721 = await deploy("Shark721NFT", {
  //   from: deployer,
  //   args: [
  //     "Shark721NFT", // name
  //     "SHK721", // symbol
  //     deployer, // royalty recipient
  //     100, // royaltyBps (1%)
  //   ],
  //   log: true,
  // });
  // console.log(`✅ Shark721NFT deployed to: ${shark721.address}`);
};

export default deployNFTMarketplace;
deployNFTMarketplace.tags = ["NFT_MP"];
