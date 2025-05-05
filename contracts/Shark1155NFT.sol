// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract Shark1155NFT is
    ERC1155Supply,
    ERC1155Burnable,
    ERC2981,
    AccessControl,
    ReentrancyGuard
{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    uint256 public immutable maxTokens;
    uint128 private _currentTokenId;

    string public name;
    string public symbol;

    constructor(
        string memory _baseURI,
        uint256 _maxTokens,
        address _royaltyRecipient,
        uint96 _royaltyBps,
        string memory _name,
        string memory _symbol
    ) ERC1155(_baseURI) {
        maxTokens = _maxTokens;
        name = _name;
        symbol = _symbol;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _setDefaultRoyalty(_royaltyRecipient, _royaltyBps);
    }

    function mintNew(
        address to,
        uint256 amount,
        bytes calldata data
    ) external onlyRole(MINTER_ROLE) {
        require(_currentTokenId < maxTokens, "Max token types reached");
        uint256 id = _currentTokenId++;
        _mint(to, id, amount, data);
    }

    function mintBatch(
        address to,
        uint256[] calldata ids,
        uint256[] calldata amounts,
        bytes calldata data
    ) external onlyRole(MINTER_ROLE) {
        _mintBatch(to, ids, amounts, data);
    }

    function setURI(
        string memory newuri
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setURI(newuri);
    }

    /// @notice Returns whether a token exists
    function exists(uint256 id) public view override returns (bool) {
        return totalSupply(id) > 0;
    }

    /// @dev Override _beforeTokenTransfer to satisfy both ERC1155 and ERC1155Supply
    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal virtual override(ERC1155, ERC1155Supply) {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }

    /// @dev Override supportsInterface to include all inherited interfaces
    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC1155, ERC2981, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
