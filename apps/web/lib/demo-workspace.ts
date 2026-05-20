import { analyzeSoliditySource } from "@proofboard/analyzer";
import type { Contract, ProtocolFunction, SourceFile, Workspace } from "@proofboard/shared-types";

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

const sourceFile: SourceFile = {
  id: "source_example_vault",
  path: "src/ExampleVault.sol",
  language: "solidity",
  content: demoSolidity
};

const demoFunctions: ProtocolFunction[] = [
  {
    id: "function_example_vault_deposit",
    contractId: "contract_example_vault",
    name: "deposit",
    signature: "deposit(uint256 assets, address receiver)",
    visibility: "public",
    flow: "user",
    modifiers: [],
    notes: "Mints shares for deposited underlying assets when not paused."
  },
  {
    id: "function_example_vault_withdraw",
    contractId: "contract_example_vault",
    name: "withdraw",
    signature: "withdraw(uint256 assets, address receiver, address owner)",
    visibility: "public",
    flow: "user",
    modifiers: [],
    notes: "Burns shares to release assets when not paused."
  },
  {
    id: "function_example_vault_pause",
    contractId: "contract_example_vault",
    name: "pause",
    signature: "pause()",
    visibility: "external",
    flow: "privileged",
    modifiers: ["onlyOwner"],
    notes: "Owner can stop user-facing asset movement flows."
  },
  {
    id: "function_example_vault_set_fee_recipient",
    contractId: "contract_example_vault",
    name: "setFeeRecipient",
    signature: "setFeeRecipient(address nextRecipient)",
    visibility: "external",
    flow: "privileged",
    modifiers: ["onlyOwner"],
    notes: "Owner can update the fee recipient address."
  }
];

const fallbackContract: Contract = {
  id: "contract_example_vault",
  name: "ExampleVault",
  path: sourceFile.path,
  inherits: ["ERC4626", "Ownable"],
  functions: demoFunctions,
  stateVariables: [
    {
      id: "state_example_vault_paused",
      contractId: "contract_example_vault",
      name: "paused",
      type: "bool",
      visibility: "public"
    },
    {
      id: "state_example_vault_fee_recipient",
      contractId: "contract_example_vault",
      name: "feeRecipient",
      type: "address",
      visibility: "public"
    }
  ],
  events: [],
  modifiers: [],
  externalCalls: [
    {
      id: "external_example_vault_super_deposit",
      contractId: "contract_example_vault",
      functionId: "function_example_vault_deposit",
      target: "super",
      expression: "super.deposit(assets, receiver)"
    },
    {
      id: "external_example_vault_super_withdraw",
      contractId: "contract_example_vault",
      functionId: "function_example_vault_withdraw",
      target: "super",
      expression: "super.withdraw(assets, receiver, owner)"
    }
  ]
};

export const demoWorkspace: Workspace = {
  id: "workspace_demo_erc4626",
  name: "ExampleVault Assurance",
  protocolType: "erc4626_vault",
  description:
    "ERC4626 vault with pause controls, share accounting flows, and fee recipient administration.",
  sources: [sourceFile],
  protocolMap: {
    contracts: [fallbackContract],
    roles: [
      {
        id: "role_owner",
        name: "owner",
        source: "Ownable inheritance and onlyOwner modifiers",
        privilegedFunctions: ["function_example_vault_pause", "function_example_vault_set_fee_recipient"]
      }
    ],
    criticalState: fallbackContract.stateVariables,
    assetFlows: [
      {
        id: "flow_deposit",
        name: "deposit",
        kind: "deposit",
        functions: ["function_example_vault_deposit"],
        assets: ["underlying ERC20"],
        notes: "User deposits assets and receives shares."
      },
      {
        id: "flow_withdraw",
        name: "withdraw",
        kind: "withdraw",
        functions: ["function_example_vault_withdraw"],
        assets: ["underlying ERC20"],
        notes: "User burns shares and receives assets."
      }
    ],
    externalCalls: fallbackContract.externalCalls,
    privilegedFunctions: demoFunctions.filter((fn) => fn.flow === "privileged"),
    userFlows: demoFunctions.filter((fn) => fn.flow === "user"),
    tokenDependencies: [
      {
        id: "token_underlying",
        name: "underlyingToken",
        source: "ERC4626 asset",
        assumptions: ["assumption_standard_erc20", "assumption_no_rebase"]
      }
    ],
    parserWarnings: []
  },
  claims: [
    {
      id: "claim_withdraw_ownership",
      title: "Withdrawals respect share ownership",
      text: "Users should not be able to withdraw more assets than their share ownership permits.",
      source: ["ERC4626 inheritance", "ExampleVault.withdraw"],
      confidence: 0.86,
      relatedContracts: ["ExampleVault"],
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
      relatedContracts: ["ExampleVault"],
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
      relatedContracts: ["ExampleVault"],
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
      relatedContracts: ["ExampleVault"],
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
      status: "Draft",
      skepticStatus: "Needs stronger actor model",
      skepticFindings: ["Withdraw/redeem ownership needs multi-actor coverage before fuzz evidence is meaningful."],
      verificationLevel: "human_approved",
      risk: "critical",
      assumptions: ["assumption_standard_erc20", "assumption_no_rebase"],
      evidence: ["evidence_manual_withdraw_claim"],
      nextAction: "Generate Foundry invariant with multi-actor withdraw and redeem flows."
    },
    {
      id: "property_deposit_mint_consistency",
      claimId: "claim_deposit_shares",
      text: "For equivalent economic inputs, deposit and mint flows should produce consistent outcomes within rounding bounds.",
      status: "Draft",
      skepticStatus: "Needs adversarial mock",
      skepticFindings: ["Deposit/mint consistency assumes standard ERC20 behavior and needs fee-on-transfer coverage."],
      verificationLevel: "ai_inferred",
      risk: "high",
      assumptions: ["assumption_standard_erc20"],
      evidence: [],
      nextAction: "Ask a human reviewer to approve or edit the claim."
    },
    {
      id: "property_pause_behavior",
      claimId: "claim_pause_blocks_flows",
      text: "Paused state should block user-facing asset movement while preserving documented emergency behavior.",
      status: "Generated",
      skepticStatus: "Needs human review",
      skepticFindings: ["Emergency policy must be reviewed before pause behavior can be treated as strong evidence."],
      verificationLevel: "test_generated",
      risk: "high",
      assumptions: ["assumption_admin_policy"],
      evidence: ["evidence_generated_pause_harness"],
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
      relatedProperties: ["property_redeemable_assets", "property_deposit_mint_consistency"],
      relatedFunctions: ["deposit", "withdraw"]
    },
    {
      id: "assumption_no_rebase",
      text: "Underlying token does not rebase.",
      whyItMatters: "Rebases can change vault balances without deposits or withdrawals.",
      status: "Unresolved",
      severity: "medium",
      relatedProperties: ["property_redeemable_assets"],
      relatedFunctions: ["deposit", "withdraw"]
    },
    {
      id: "assumption_admin_policy",
      text: "Admin actions follow the documented emergency policy.",
      whyItMatters: "Pause and fee controls are privileged paths that can affect availability and user trust.",
      status: "Accepted risk",
      severity: "medium",
      relatedProperties: ["property_pause_behavior"],
      relatedFunctions: ["pause", "setFeeRecipient"]
    }
  ],
  verificationRuns: [
    {
      id: "run_demo_foundry",
      tool: "foundry",
      command: "forge test --match-contract ProofboardVaultInvariant",
      status: "not_run",
      counterexamples: [],
      rawOutput: "",
      createdAt: "2026-05-19T00:00:00Z"
    }
  ],
  evidence: [
    {
      id: "evidence_manual_withdraw_claim",
      propertyId: "property_redeemable_assets",
      source: "human-approved claim",
      strength: "weak",
      summary: "Intent approved, but no fuzz evidence is attached yet."
    },
    {
      id: "evidence_generated_pause_harness",
      propertyId: "property_pause_behavior",
      source: "generated harness preview",
      strength: "medium",
      summary: "Harness scaffold exists but has not been executed."
    }
  ]
};

const analyzedProtocolMap = analyzeSoliditySource(sourceFile);
demoWorkspace.protocolMap = {
  ...analyzedProtocolMap,
  parserWarnings: analyzedProtocolMap.parserWarnings.filter((warning) => !warning.startsWith("Static regex parser"))
};

export const emptyWorkspace: Workspace = {
  ...demoWorkspace,
  id: "workspace_new",
  name: "",
  description: "",
  sources: [
    {
      id: "source_new",
      path: "src/Vault.sol",
      language: "solidity",
      content: ""
    }
  ],
  protocolMap: {
    contracts: [],
    roles: [],
    criticalState: [],
    assetFlows: [],
    externalCalls: [],
    privilegedFunctions: [],
    userFlows: [],
    tokenDependencies: [],
    parserWarnings: ["No Solidity source has been analyzed yet."]
  },
  claims: [],
  properties: [],
  assumptions: [],
  verificationRuns: [],
  evidence: []
};
