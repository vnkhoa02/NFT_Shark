import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { NFTMarketplace, Shark721NFT } from "../typechain-types";

describe("NFTMarketplace", function () {
  let deployer: SignerWithAddress;
  let seller: SignerWithAddress;
  let buyer: SignerWithAddress;
  let marketplace: NFTMarketplace;
  let nft: Shark721NFT;

  before(async () => {
    [deployer, seller, buyer] = await ethers.getSigners();

    // 1) Deploy your ERC‑721
    const NFTFactory = await ethers.getContractFactory("Shark721NFT", deployer);
    nft = (await NFTFactory.deploy(
      "Shark721NFT",
      "SHK721",
      deployer.address, // royalty recipient
      500 // 5% royalty
    )) as Shark721NFT;
    await nft.waitForDeployment();

    // 2) Deploy the Marketplace
    const MarketFactory = await ethers.getContractFactory(
      "NFTMarketplace",
      deployer
    );
    marketplace = (await MarketFactory.deploy()) as NFTMarketplace;
    await marketplace.waitForDeployment();

    // 3) Mint two NFTs to the seller
    await nft.connect(deployer).mintNew(seller.address, "ipfs://meta0.json");
    await nft.connect(deployer).mintNew(seller.address, "ipfs://meta1.json");
  });

  describe("listItem", function () {
    it("reverts if marketplace not approved", async () => {
      await expect(
        marketplace
          .connect(seller)
          .listItem(nft.getAddress(), 0, ethers.parseEther("1"), "Art")
      ).to.be.revertedWith("Marketplace not approved");
    });

    it("lets a user list their NFT once approved", async () => {
      await nft.connect(seller).approve(marketplace.getAddress(), 0);

      const price = ethers.parseEther("1");
      const category = "Art";

      await expect(
        marketplace
          .connect(seller)
          .listItem(nft.getAddress(), 0, price, category)
      )
        .to.emit(marketplace, "ItemListed")
        .withArgs(nft.getAddress(), 0, seller.address, price, category);

      const listing = await marketplace.listings(nft.getAddress(), 0);
      expect(listing.seller).to.equal(seller.address);
      expect(listing.price).to.equal(price);
      expect(listing.category).to.equal(category);
    });
  });

  describe("buyItem", function () {
    it("reverts if token is not listed", async () => {
      await expect(
        marketplace.connect(buyer).buyItem(nft.getAddress(), 2, { value: 0 })
      ).to.be.revertedWith("Not listed");
    });

    it("reverts if payment is incorrect", async () => {
      await expect(
        marketplace
          .connect(buyer)
          .buyItem(nft.getAddress(), 0, { value: ethers.parseEther("0.5") })
      ).to.be.revertedWith("Incorrect payment");
    });

    it("lets a buyer purchase a paid NFT", async () => {
      const price = ethers.parseEther("1");

      // Perform the purchase
      const tx = marketplace
        .connect(buyer)
        .buyItem(nft.getAddress(), 0, { value: price });

      // 1) ETH is transferred to the seller
      await expect(tx).to.changeEtherBalance(seller, price);

      // 2) Event is emitted
      await expect(tx)
        .to.emit(marketplace, "ItemBought")
        .withArgs(nft.getAddress(), 0, buyer.address, price);

      // 3) Ownership transferred
      expect(await nft.ownerOf(0)).to.equal(buyer.address);

      // 4) Listing cleared
      const listing = await marketplace.listings(nft.getAddress(), 0);
      expect(listing.seller).to.equal(ethers.ZeroAddress);
    });

    it("lets a buyer claim a free NFT", async () => {
      // List tokenId=1 at price=0
      await nft.connect(seller).approve(marketplace.getAddress(), 1);
      await marketplace
        .connect(seller)
        .listItem(nft.getAddress(), 1, 0, "Free");

      // Claim for free
      const tx = marketplace
        .connect(buyer)
        .buyItem(nft.getAddress(), 1, { value: 0 });

      // No ETH transfer for free item
      await expect(tx).to.changeEtherBalance(seller, 0);

      await expect(tx)
        .to.emit(marketplace, "ItemBought")
        .withArgs(nft.getAddress(), 1, buyer.address, 0);

      expect(await nft.ownerOf(1)).to.equal(buyer.address);
    });
  });

  describe("cancelListing", function () {
    before(async () => {
      // Mint and list tokenId=2 for cancellation tests
      await nft.connect(deployer).mintNew(seller.address, "ipfs://meta2.json");
      await nft.connect(seller).approve(marketplace.getAddress(), 2);
      await marketplace
        .connect(seller)
        .listItem(nft.getAddress(), 2, ethers.parseEther("0.1"), "Collectible");
    });

    it("reverts if non‑seller tries to cancel", async () => {
      await expect(
        marketplace.connect(buyer).cancelListing(nft.getAddress(), 2)
      ).to.be.revertedWith("Not seller");
    });

    it("lets the seller cancel and get back their NFT", async () => {
      await expect(
        marketplace.connect(seller).cancelListing(nft.getAddress(), 2)
      )
        .to.emit(marketplace, "ItemCanceled")
        .withArgs(nft.getAddress(), 2, seller.address);

      // NFT returned
      expect(await nft.ownerOf(2)).to.equal(seller.address);

      // Listing cleared
      const listing = await marketplace.listings(nft.getAddress(), 2);
      expect(listing.seller).to.equal(ethers.ZeroAddress);
    });
  });
});
