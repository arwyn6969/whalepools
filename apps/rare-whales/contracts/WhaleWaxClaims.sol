// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Fixed supply. Only the distributor can burn its expired reserve.
contract WhaleWax is ERC20 {
    address public immutable distributor;
    constructor(uint256 supply) ERC20("Whale Wax", "WWAX") {
        distributor = msg.sender;
        _mint(msg.sender, supply);
    }
    function burnReserve(uint256 amount) external {
        require(msg.sender == distributor, "Distributor only");
        _burn(msg.sender, amount);
    }
}

/// @notice One paid claim per NFT per global period. NFTs stay with their owners.
/// @dev No owner controls, proxy, pause, approvals, fee setters or further minting.
contract WhaleWaxClaims is ReentrancyGuard {
    address public constant RARE_WHALES = 0xcaFa6d08ac4eD305C15F8d41D155499118c5F605;
    address public constant WHALESTREET = 0x01F33271d74A9dcc91798c7232d3D788Da93A1f6;
    uint256 public constant REWARD = 100 ether;
    uint256 public constant FEE = 0.0001 ether;
    uint256 public constant PERIOD = 30 days;
    uint256 public constant PERIODS = 12;
    uint256 public constant MAX_BATCH = 20;
    uint256 public constant INITIAL_SUPPLY = (420 + 3319) * REWARD * PERIODS;
    WhaleWax public immutable token;
    address payable public immutable treasury;
    uint256 public immutable startsAt;
    uint256 public immutable endsAt;
    mapping(address => mapping(uint256 => uint256)) public claimedPeriods;

    error Closed();
    error InvalidBatch();
    error IncorrectFee();
    error IneligibleNFT();
    error NotNFTOwner();
    error AlreadyClaimed();
    error FeeWithdrawalFailed();
    event Claimed(address indexed owner, address indexed collection, uint256 indexed tokenId, uint256 period);
    event FeesWithdrawn(address indexed treasury, uint256 amount);
    event ReserveBurned(uint256 amount);

    constructor() {
        treasury = payable(msg.sender);
        startsAt = block.timestamp + 1 days;
        endsAt = startsAt + PERIOD * PERIODS;
        token = new WhaleWax(INITIAL_SUPPLY);
    }

    function eligible(address collection, uint256 id) public pure returns (bool) {
        return id > 0 && ((collection == RARE_WHALES && id <= 420)
            || (collection == WHALESTREET && id <= 3319));
    }

    /// @return Zero-based period; reverts before opening or after the final period.
    function currentPeriod() public view returns (uint256) {
        if (block.timestamp < startsAt || block.timestamp >= endsAt) revert Closed();
        return (block.timestamp - startsAt) / PERIOD;
    }

    function claim(address[] calldata collections, uint256[] calldata ids) external payable nonReentrant {
        uint256 length = ids.length;
        if (length == 0 || length > MAX_BATCH || length != collections.length) revert InvalidBatch();
        if (msg.value != FEE * length) revert IncorrectFee();
        uint256 period = currentPeriod();
        uint256 mask = 1 << period;
        for (uint256 i; i < length; ++i) {
            address collection = collections[i];
            uint256 id = ids[i];
            if (!eligible(collection, id)) revert IneligibleNFT();
            if (claimedPeriods[collection][id] & mask != 0) revert AlreadyClaimed();
            if (IERC721(collection).ownerOf(id) != msg.sender) revert NotNFTOwner();
            claimedPeriods[collection][id] |= mask;
            emit Claimed(msg.sender, collection, id, period);
        }
        // Standard ERC20 transfer: no receiver callback. Any failure reverts the whole batch.
        require(token.transfer(msg.sender, REWARD * length), "Reward transfer failed");
    }

    /// @notice Anyone can trigger payout, always to the immutable deployment wallet.
    function withdrawFees() external nonReentrant {
        uint256 amount = address(this).balance;
        (bool success,) = treasury.call{value: amount}("");
        if (!success) revert FeeWithdrawalFailed();
        emit FeesWithdrawn(treasury, amount);
    }

    /// @notice After all periods close, anyone can burn the remaining reserve.
    function burnExpiredReserve() external nonReentrant {
        if (block.timestamp < endsAt) revert Closed();
        uint256 amount = token.balanceOf(address(this));
        token.burnReserve(amount);
        emit ReserveBurned(amount);
    }
}
