import { expect } from "chai";
import { ethers } from "hardhat";
import { NFTMarketplace, Shark721NFT, TestERC20 } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("NFTMarketplace", function () {
  let deployer: SignerWithAddress;
  let seller: SignerWithAddress;
  let buyer: SignerWithAddress;
  let other: SignerWithAddress;
  let marketplace: NFTMarketplace;
  let nft: Shark721NFT;

  beforeEach(async () => {
    [deployer, seller, buyer, other] = await ethers.getSigners();

    const NFTFactory = await ethers.getContractFactory("Shark721NFT", deployer);
    nft = (await NFTFactory.deploy(
      "Shark721NFT",
      "SHK721",
      deployer.address,
      500
    )) as Shark721NFT;
    await nft.waitForDeployment();

    const MarketFactory = await ethers.getContractFactory(
      "NFTMarketplace",
      deployer
    );
    marketplace = (await MarketFactory.deploy(
      200,
      deployer.address
    )) as NFTMarketplace;
    await marketplace.waitForDeployment();

    await nft.connect(deployer).mintNew(seller.address, "ipfs://meta0.json");
    await nft.connect(deployer).mintNew(seller.address, "ipfs://meta1.json");
  });

  it("should allow seller to list an NFT", async () => {
    await nft.connect(seller).approve(marketplace.getAddress(), 1);
    await expect(
      marketplace
        .connect(seller)
        .listItem(nft.getAddress(), 1, ethers.parseEther("1"))
    )
      .to.emit(marketplace, "ItemListed")
      .withArgs(nft.getAddress(), 1, seller.address, ethers.parseEther("1"));

    expect(await nft.ownerOf(1)).to.equal(await marketplace.getAddress());
    const listing = await marketplace.listings(nft.getAddress(), 1);
    expect(listing.seller).to.equal(seller.address);
    expect(listing.price).to.equal(ethers.parseEther("1"));
  });

  it("should allow seller to update listing price", async () => {
    await nft.connect(seller).approve(marketplace.getAddress(), 1);
    await marketplace
      .connect(seller)
      .listItem(nft.getAddress(), 1, ethers.parseEther("1"));
    await expect(
      marketplace
        .connect(seller)
        .updateListing(nft.getAddress(), 1, ethers.parseEther("2"))
    )
      .to.emit(marketplace, "ItemUpdated")
      .withArgs(nft.getAddress(), 1, seller.address, ethers.parseEther("2"));

    const listing = await marketplace.listings(nft.getAddress(), 1);
    expect(listing.price).to.equal(ethers.parseEther("2"));
  });

  it("should allow seller to cancel a listing", async () => {
    await nft.connect(seller).approve(marketplace.getAddress(), 1);
    await marketplace
      .connect(seller)
      .listItem(nft.getAddress(), 1, ethers.parseEther("1"));
    await expect(marketplace.connect(seller).cancelListing(nft.getAddress(), 1))
      .to.emit(marketplace, "ItemCanceled")
      .withArgs(nft.getAddress(), 1, seller.address);

    expect(await nft.ownerOf(1)).to.equal(seller.address);
    const listing = await marketplace.listings(nft.getAddress(), 1);
    expect(listing.seller).to.equal(ethers.ZeroAddress);
  });

  it("should allow buyer to buy a listed NFT and pay fee", async () => {
    await nft.connect(seller).approve(marketplace.getAddress(), 1);
    const ntfAddr = await nft.getAddress();
    await marketplace
      .connect(seller)
      .listItem(ntfAddr, 1, ethers.parseEther("1"));

    const sellerBalBefore = await ethers.provider.getBalance(seller.address);

    await expect(
      marketplace
        .connect(buyer)
        .buyItem(ntfAddr, 1, { value: ethers.parseEther("1") })
    )
      .to.emit(marketplace, "ItemBought")
      .withArgs(ntfAddr, 1, buyer.address, ethers.parseEther("1"));

    expect(await nft.ownerOf(1)).to.equal(buyer.address);
    const listing = await marketplace.listings(ntfAddr, 1);
    expect(listing.seller).to.equal(ethers.ZeroAddress);

    // Check fee and seller payout
    const fee = (ethers.parseEther("1") * 200n) / 10000n;
    const sellerBalAfter = await ethers.provider.getBalance(seller.address);
    expect(sellerBalAfter - sellerBalBefore).to.equal(
      ethers.parseEther("1") - fee
    );
  });

  it("should return correct seller listings", async () => {
    const marketplaceAddr = await marketplace.getAddress();
    const nftAddr = await nft.getAddress();
    await nft.connect(seller).approve(marketplaceAddr, 0);
    await nft.connect(seller).approve(marketplaceAddr, 1);
    await marketplace
      .connect(seller)
      .listItem(nftAddr, 0, ethers.parseEther("1"));
    await marketplace
      .connect(seller)
      .listItem(nftAddr, 1, ethers.parseEther("2"));
    const tokenIds = await marketplace.getSellerListings(seller.address);
    expect(tokenIds.map((x) => x.toString()).sort()).to.deep.equal(["0", "1"]);
  });

  it("should only allow owner to set fee and feeRecipient", async () => {
    await expect(
      marketplace.connect(other).setFeeBps(100, other.address)
    ).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(marketplace.connect(deployer).setFeeBps(100, other.address)).to
      .not.be.reverted;
    expect(await marketplace.feeBps()).to.equal(100);
    expect(await marketplace.feeRecipient()).to.equal(other.address);
  });

  it("should only allow owner to pause/unpause", async () => {
    await expect(marketplace.connect(other).pause()).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
    await expect(marketplace.connect(deployer).pause()).to.not.be.reverted;
    await expect(marketplace.connect(deployer).unpause()).to.not.be.reverted;
  });

  it("should not allow actions when paused", async () => {
    await nft.connect(seller).approve(marketplace.getAddress(), 1);
    await marketplace.connect(deployer).pause();
    await expect(
      marketplace
        .connect(seller)
        .listItem(nft.getAddress(), 1, ethers.parseEther("1"))
    ).to.be.revertedWith("Pausable: paused");
    await marketplace.connect(deployer).unpause();
    await expect(
      marketplace
        .connect(seller)
        .listItem(nft.getAddress(), 1, ethers.parseEther("1"))
    ).to.not.be.reverted;
  });

  it("should allow owner to withdraw ERC20 tokens", async () => {
    const ERC20Factory = await ethers.getContractFactory("TestERC20", deployer);
    const erc20 = (await ERC20Factory.deploy(
      "Test",
      "TST",
      18,
      0
    )) as TestERC20;
    await erc20.mint(marketplace.getAddress(), 1000);
    await expect(
      marketplace.connect(other).withdrawERC20(erc20.getAddress(), 1000)
    ).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(
      marketplace.connect(deployer).withdrawERC20(erc20.getAddress(), 1000)
    ).to.not.be.reverted;
    expect(await erc20.balanceOf(deployer.address)).to.equal(1000);
  });

  it("should not allow buying unlisted item", async () => {
    const nftAddr = await nft.getAddress();
    await expect(
      marketplace
        .connect(buyer)
        .buyItem(nftAddr, 1, { value: ethers.parseEther("1") })
    ).to.be.revertedWith("Not listed");
  });

  it("should not allow listing with price <= 0", async () => {
    await nft.connect(seller).approve(marketplace.getAddress(), 0);
    await expect(marketplace.connect(seller).listItem(nft.getAddress(), 0, 0))
      .to.be.reverted;
  });
});
