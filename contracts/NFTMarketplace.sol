// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

struct Listing {
    address seller;
    uint256 price;
}
using EnumerableSet for EnumerableSet.UintSet;
using Address for address payable;

contract NFTMarketplace is ReentrancyGuard, Ownable, Pausable {
    // Marketplace fee
    uint16 public feeBps;
    address public feeRecipient;

    // NFT contract => tokenId => Listing
    mapping(address => mapping(uint256 => Listing)) public listings;

    // Seller => tokenId => Listing
    mapping(address => EnumerableSet.UintSet) private sellerListings;

    event ItemListed(
        address indexed nft,
        uint256 indexed tokenId,
        address indexed seller,
        uint256 price
    );

    event ItemUpdated(
        address indexed nft,
        uint256 indexed tokenId,
        address indexed seller,
        uint256 newPrice
    );

    event ItemBought(
        address indexed nft,
        uint256 indexed tokenId,
        address indexed buyer,
        uint256 price
    );

    event ItemCanceled(
        address indexed nft,
        uint256 indexed tokenId,
        address indexed seller
    );

    constructor(uint16 _feeBps, address _feeRecipient) {
        feeBps = _feeBps;
        feeRecipient = _feeRecipient;
    }

    function setFeeBps(
        uint16 _feeBps,
        address _feeRecipient
    ) external onlyOwner {
        // feeBps must be <= 10_000 (100%)
        require(_feeBps <= 10_000, "Fee too high");
        feeBps = _feeBps;
        feeRecipient = _feeRecipient;
    }

    function listItem(
        address nft,
        uint256 tokenId,
        uint256 price
    ) external whenNotPaused nonReentrant {
        require(price > 0, "Price > 0");
        IERC721(nft).transferFrom(msg.sender, address(this), tokenId);

        listings[nft][tokenId] = Listing(msg.sender, price);
        sellerListings[msg.sender].add(tokenId);
        emit ItemListed(nft, tokenId, msg.sender, price);
    }

    function updateListing(
        address nft,
        uint256 tokenId,
        uint256 newPrice
    ) external whenNotPaused nonReentrant {
        Listing storage lst = listings[nft][tokenId];
        require(lst.seller == msg.sender, "Not seller");
        require(newPrice >= 0, "Price >= 0");
        lst.price = newPrice;
        emit ItemUpdated(nft, tokenId, msg.sender, newPrice);
    }

    function cancelListing(
        address nft,
        uint256 tokenId
    ) external whenNotPaused nonReentrant {
        Listing memory lst = listings[nft][tokenId];
        require(lst.seller == msg.sender, "Not seller");
        delete listings[nft][tokenId];
        sellerListings[msg.sender].remove(tokenId);
        IERC721(nft).safeTransferFrom(address(this), msg.sender, tokenId);
        emit ItemCanceled(nft, tokenId, msg.sender);
    }

    function buyItem(
        address nft,
        uint256 tokenId
    ) external payable whenNotPaused nonReentrant {
        Listing memory lst = listings[nft][tokenId];
        require(lst.price > 0 && msg.value == lst.price, "Not listed");

        delete listings[nft][tokenId];
        sellerListings[lst.seller].remove(tokenId);

        uint256 fee = (msg.value * feeBps) / 10_000;
        payable(lst.seller).sendValue(msg.value - fee);
        IERC721(nft).safeTransferFrom(address(this), msg.sender, tokenId);
        emit ItemBought(nft, tokenId, msg.sender, lst.price);
    }

    function getSellerListings(
        address seller
    ) external view returns (uint256[] memory) {
        uint256 count = sellerListings[seller].length();
        uint256[] memory tokenIds = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            tokenIds[i] = sellerListings[seller].at(i);
        }
        return tokenIds;
    }

    function withdrawERC20(address token, uint256 amount) external onlyOwner {
        require(token != address(0), "Invalid token");
        require(amount > 0, "Invalid amount");
        IERC20(token).transfer(owner(), amount);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
