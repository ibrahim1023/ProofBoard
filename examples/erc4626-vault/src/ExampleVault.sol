// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC4626} from "openzeppelin/token/ERC20/extensions/ERC4626.sol";
import {Ownable} from "openzeppelin/access/Ownable.sol";

contract ExampleVault is ERC4626, Ownable {
    bool public paused;
    address public feeRecipient;

    function deposit(uint256 assets, address receiver) public override returns (uint256 shares) {
        require(!paused, "paused");
        shares = super.deposit(assets, receiver);
    }

    function withdraw(uint256 assets, address receiver, address owner) public override returns (uint256 shares) {
        require(!paused, "paused");
        shares = super.withdraw(assets, receiver, owner);
    }

    function pause() external onlyOwner {
        paused = true;
    }

    function setFeeRecipient(address nextRecipient) external onlyOwner {
        feeRecipient = nextRecipient;
    }
}
