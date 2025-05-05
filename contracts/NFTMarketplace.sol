// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract NFTMarketplace is ReentrancyGuard {
    struct Listing {
        address seller;
        uint256 price;
    }

    // NFT contract => tokenId => Listing
    mapping(address => mapping(uint256 => Listing)) public listings;

    event ItemListed(
        address indexed nft,
        uint256 indexed tokenId,
        address seller,
        uint256 price
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
    function listItem(address nft, uint256 tokenId, uint256 price) external {
        require(price > 0, "Price > 0");
        IERC721(nft).transferFrom(msg.sender, address(this), tokenId);
        listings[nft][tokenId] = Listing(msg.sender, price);
        emit ItemListed(nft, tokenId, msg.sender, price);
    }

    /// @notice Buy a listed NFT
    function buyItem(
        address nft,
        uint256 tokenId
    ) external payable nonReentrant {
        Listing memory item = listings[nft][tokenId];
        require(item.price > 0, "Not listed");
        require(msg.value == item.price, "Incorrect payment");

        delete listings[nft][tokenId];

        // transfer ETH to seller
        payable(item.seller).transfer(msg.value);

        // transfer NFT to buyer
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
