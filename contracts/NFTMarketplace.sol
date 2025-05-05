// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract NFTMarketplace is ReentrancyGuard {
    struct Listing { address seller; uint256 price; string category; }

    // NFT contract => tokenId => Listing
    mapping(address => mapping(uint256 => Listing)) public listings;

    event ItemListed(
        address indexed nft,
        uint256 indexed tokenId,
        address seller,
        uint256 price,
        string category
    );

    event ItemBought(
        address indexed nft,
        uint256 indexed tokenId,
        address buyer,
        uint256 price
    );
    event ItemCanceled(
        address indexed nft,
        uint256 indexed tokenId,
        address seller
    );

    /// @notice List an owned NFT for sale
    function listItem(
        address nft,
        uint256 tokenId,
        uint256 price,
        string calldata category
    ) external {
        // 1. Check approval
        require(
            IERC721(nft).getApproved(tokenId) == address(this) ||
                IERC721(nft).isApprovedForAll(msg.sender, address(this)),
            "Marketplace not approved"
        );
        IERC721(nft).transferFrom(msg.sender, address(this), tokenId);
        listings[nft][tokenId] = Listing(msg.sender, price, category);
        emit ItemListed(nft, tokenId, msg.sender, price, category);
    }

    /// @notice Buy a listed NFT
    function buyItem(
        address nft,
        uint256 tokenId
    ) external payable nonReentrant {
        Listing memory item = listings[nft][tokenId];
        require(item.seller != address(0), "Not listed");
        require(msg.value == item.price, "Incorrect payment");

        delete listings[nft][tokenId];
        // only transfer funds if price > 0
        if (item.price > 0) {
            payable(item.seller).transfer(item.price);
        }

        // transfer NFT to the buyer
        IERC721(nft).safeTransferFrom(address(this), msg.sender, tokenId);

        emit ItemBought(nft, tokenId, msg.sender, item.price);
    }

    /// @notice Cancel a listing and get back your NFT
    function cancelListing(address nft, uint256 tokenId) external {
        Listing memory item = listings[nft][tokenId];
        require(item.seller == msg.sender, "Not seller");

        delete listings[nft][tokenId];
        IERC721(nft).safeTransferFrom(address(this), msg.sender, tokenId);

        emit ItemCanceled(nft, tokenId, msg.sender);
    }
}
