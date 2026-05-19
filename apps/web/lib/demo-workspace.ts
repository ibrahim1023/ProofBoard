import type { Workspace } from "./types";

export const demoSolidity = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC4626} from "openzeppelin/token/ERC20/extensions/ERC4626.sol";
import {Ownable} from "openzeppelin/access/Ownable.sol";

contract ExampleVault is ERC4626, Ownable {
    bool public paused;
    address public feeRecipient;

    function deposit(uint256 assets, address receiver)
        public
        override
        returns (uint256 shares)
    {
        require(!paused, "paused");
        shares = super.deposit(assets, receiver);
    }

    function withdraw(uint256 assets, address receiver, address owner)
        public
        override
        returns (uint256 shares)
    {
        require(!paused, "paused");
        shares = super.withdraw(assets, receiver, owner);
    }

    function pause() external onlyOwner {
        paused = true;
    }

    function setFeeRecipient(address nextRecipient) external onlyOwner {
        feeRecipient = nextRecipient;
    }
}`;

export const demoWorkspace: Workspace = {
  id: "workspace_demo_erc4626",
  name: "ExampleVault Assurance",
  protocolType: "erc4626_vault",
  description:
    "ERC4626 vault with pause controls, share accounting flows, and fee recipient administration.",
  solidity: demoSolidity,
  contracts: ["ExampleVault", "ERC4626", "Ownable"],
  functions: [
    {
      name: "deposit",
      visibility: "public",
      flow: "user",
      notes: "Mints shares for deposited underlying assets when not paused."
    },
    {
      name: "withdraw",
      visibility: "public",
      flow: "user",
      notes: "Burns shares to release assets when not paused."
    },
    {
      name: "pause",
      visibility: "external",
      flow: "privileged",
      notes: "Owner can stop user-facing asset movement flows."
    },
    {
      name: "setFeeRecipient",
      visibility: "external",
      flow: "privileged",
      notes: "Owner can update the fee recipient address."
    }
  ],
  claims: [
    {
      id: "claim_withdraw_ownership",
      title: "Withdrawals respect share ownership",
      text: "Users should not be able to withdraw more assets than their share ownership permits.",
      source: ["ERC4626 inheritance", "ExampleVault.withdraw"],
      confidence: 0.86,
      relatedFunctions: ["withdraw", "redeem"],
      severity: "critical",
      status: "Human-approved"
    },
    {
      id: "claim_deposit_shares",
      title: "Deposits mint proportional shares",
      text: "Deposits should mint shares proportional to deposited assets within expected rounding bounds.",
      source: ["ERC4626 inheritance", "ExampleVault.deposit"],
      confidence: 0.82,
      relatedFunctions: ["deposit", "mint"],
      severity: "high",
      status: "AI-inferred"
    },
    {
      id: "claim_pause_blocks_flows",
      title: "Paused vault blocks asset movement",
      text: "When the vault is paused, deposit and withdrawal behavior should match the emergency policy.",
      source: ["paused state variable", "deposit require", "withdraw require"],
      confidence: 0.9,
      relatedFunctions: ["deposit", "withdraw", "pause"],
      severity: "high",
      status: "Edited"
    },
    {
      id: "claim_admin_no_drain",
      title: "Owner cannot drain user funds",
      text: "Privileged functions should not let the owner transfer user assets except through approved emergency flows.",
      source: ["Ownable inheritance", "privileged function list"],
      confidence: 0.64,
      relatedFunctions: ["pause", "setFeeRecipient"],
      severity: "critical",
      status: "AI-inferred"
    }
  ],
  properties: [
    {
      id: "property_redeemable_assets",
      claimId: "claim_withdraw_ownership",
      text: "A user's redeemable assets should be consistent with their share balance and the vault exchange rate.",
      verificationLevel: "human_approved",
      risk: "critical",
      assumptions: ["assumption_standard_erc20", "assumption_no_rebase"],
      nextAction: "Generate Foundry invariant with multi-actor withdraw and redeem flows."
    },
    {
      id: "property_deposit_mint_consistency",
      claimId: "claim_deposit_shares",
      text: "For equivalent economic inputs, deposit and mint flows should produce consistent outcomes within rounding bounds.",
      verificationLevel: "ai_inferred",
      risk: "high",
      assumptions: ["assumption_standard_erc20"],
      nextAction: "Ask a human reviewer to approve or edit the claim."
    },
    {
      id: "property_pause_behavior",
      claimId: "claim_pause_blocks_flows",
      text: "Paused state should block user-facing asset movement while preserving documented emergency behavior.",
      verificationLevel: "test_generated",
      risk: "high",
      assumptions: ["assumption_admin_policy"],
      nextAction: "Run generated Foundry invariant locally."
    }
  ],
  assumptions: [
    {
      id: "assumption_standard_erc20",
      text: "Underlying token behaves like a standard ERC20.",
      whyItMatters: "Fee-on-transfer, missing return values, or callback behavior can invalidate share accounting evidence.",
      status: "Needs test",
      severity: "high",
      relatedProperties: ["property_redeemable_assets", "property_deposit_mint_consistency"]
    },
    {
      id: "assumption_no_rebase",
      text: "Underlying token does not rebase.",
      whyItMatters: "Rebases can change vault balances without deposits or withdrawals.",
      status: "Unresolved",
      severity: "medium",
      relatedProperties: ["property_redeemable_assets"]
    },
    {
      id: "assumption_admin_policy",
      text: "Admin actions follow the documented emergency policy.",
      whyItMatters: "Pause and fee controls are privileged paths that can affect availability and user trust.",
      status: "Accepted risk",
      severity: "medium",
      relatedProperties: ["property_pause_behavior"]
    }
  ]
};

export const emptyWorkspace: Workspace = {
  ...demoWorkspace,
  id: "workspace_new",
  name: "",
  description: "",
  solidity: "",
  contracts: [],
  functions: [],
  claims: [],
  properties: [],
  assumptions: []
};
