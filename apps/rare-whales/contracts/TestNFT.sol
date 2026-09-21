// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;
// Local test fixture only. Never deployed in the launch package.
contract TestNFT {
    mapping(uint256 => address) public owners;
    function setOwner(uint256 id, address owner) external { owners[id] = owner; }
    function ownerOf(uint256 id) external view returns (address) {
        require(owners[id] != address(0), "Missing NFT");
        return owners[id];
    }
}

interface IFees { function withdrawFees() external; }
contract RejectingTreasury {
    function deploy(bytes memory code) external returns (address result) {
        assembly { result := create(0, add(code, 32), mload(code)) }
        require(result != address(0));
    }
    receive() external payable { revert("No ETH"); }
}
contract ReenteringTreasury {
    address public claims;
    bool public attempted;
    bool public reentered;
    function deploy(bytes memory code) external {
        address result;
        assembly { result := create(0, add(code, 32), mload(code)) }
        require(result != address(0)); claims = result;
    }
    receive() external payable {
        attempted = true;
        (reentered,) = claims.call(abi.encodeCall(IFees.withdrawFees, ()));
    }
}
