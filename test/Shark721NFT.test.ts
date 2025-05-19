import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { Shark721NFT } from "../typechain-types";

const SharkNFT = {
  name: "Shark721NFT",
  symbol: "SHK721",
  royaltyBps: 500, // 5%
};

describe("Shark721NFT", function () {
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let shark721: Shark721NFT;

  before(async () => {
    [owner, user] = await ethers.getSigners();

    const Shark721Factory = await ethers.getContractFactory(
      SharkNFT.name,
      owner
    );
    shark721 = (await Shark721Factory.deploy(
      SharkNFT.name,
      SharkNFT.symbol,
      owner.address, // royalty recipient
      SharkNFT.royaltyBps // royalty BPS
    )) as Shark721NFT;
    await shark721.waitForDeployment();
  });

  it("should deploy with correct name and symbol", async () => {
    expect(await shark721.name()).to.equal(SharkNFT.name);
    expect(await shark721.symbol()).to.equal(SharkNFT.symbol);
  });

  it("should allow owner (MINTER_ROLE) to mint NFT to user", async () => {
    const tokenURI = "ipfs://QmSharkMetadata1/0.json";
    await shark721.connect(owner).mintNew(user.address, tokenURI);

    const tokenId = 0;
    expect(await shark721.ownerOf(tokenId)).to.equal(user.address);
    expect(await shark721.tokenURI(tokenId)).to.equal(tokenURI);
  });

  it("should increment tokenId on multiple mints", async () => {
    const tokenURI2 = "ipfs://QmSharkMetadata1/1.json";
    await shark721.connect(owner).mintNew(user.address, tokenURI2);

    const tokenId2 = 1;
    expect(await shark721.ownerOf(tokenId2)).to.equal(user.address);
    expect(await shark721.tokenURI(tokenId2)).to.equal(tokenURI2);
    expect(await shark721.totalMinted()).to.equal(2);
  });

  it("should revert when non‑minter tries to mint", async () => {
    await expect(
      shark721.connect(user).mintNew(user.address, "ipfs://QmNope/2.json")
    ).to.be.revertedWith(
      `AccessControl: account ${user.address.toLowerCase()} is missing role ${ethers.id(
        "MINTER_ROLE"
      )}`
    );
  });

  it("should revert when querying tokenURI for nonexistent token", async () => {
    await expect(shark721.tokenURI(999)).to.be.revertedWith(
      "ERC721: invalid token ID"
    );
  });

  it("should revert when transferring token not owned by caller", async () => {
    await expect(
      shark721.connect(owner).transferFrom(user.address, owner.address, 0)
    ).to.be.revertedWith("ERC721: caller is not token owner or approved");
  });
});
