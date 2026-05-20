import { describe, expect, it } from "vitest";
import {
  type Workspace,
  validateAssumption,
  validateProperty,
  validateWorkspace
} from "./index";

const validWorkspace: Workspace = {
  id: "workspace_123",
  name: "Example Vault",
  protocolType: "erc4626_vault",
  description: "A vault assurance workspace.",
  sources: [
    {
      id: "source_vault",
      path: "src/ExampleVault.sol",
      language: "solidity",
      content: "contract ExampleVault {}"
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
    parserWarnings: []
  },
  claims: [
    {
      id: "claim_1",
      title: "Withdrawals respect ownership",
      text: "Users cannot withdraw more assets than their shares permit.",
      source: ["README.md"],
      confidence: 0.8,
      relatedContracts: ["ExampleVault"],
      relatedFunctions: ["withdraw"],
      severity: "critical",
      status: "Human-approved"
    }
  ],
  properties: [
    {
      id: "property_1",
      claimId: "claim_1",
      text: "Redeemable assets remain consistent with share balances.",
      status: "Draft",
      verificationLevel: "human_approved",
      risk: "critical",
      assumptions: ["assumption_1"],
      evidence: [],
      nextAction: "Generate invariant."
    }
  ],
  assumptions: [
    {
      id: "assumption_1",
      text: "Token is standard ERC20.",
      whyItMatters: "Adversarial token behavior can break accounting evidence.",
      status: "Needs test",
      severity: "high",
      relatedProperties: ["property_1"],
      relatedFunctions: ["deposit", "withdraw"]
    }
  ],
  verificationRuns: [
    {
      id: "run_1",
      tool: "foundry",
      command: "forge test",
      status: "not_run",
      counterexamples: [],
      rawOutput: "",
      createdAt: "2026-05-19T00:00:00Z"
    }
  ],
  evidence: [
    {
      id: "evidence_1",
      propertyId: "property_1",
      source: "manual review",
      strength: "weak",
      summary: "Claim approved but not fuzzed."
    }
  ]
};

describe("shared schema validation", () => {
  it("accepts a complete workspace fixture", () => {
    expect(validateWorkspace(validWorkspace)).toEqual([]);
  });

  it("rejects invalid verification levels", () => {
    const issues = validateProperty({
      ...validWorkspace.properties[0],
      verificationLevel: "passed" as never
    });

    expect(issues).toContainEqual({
      path: "property.verificationLevel",
      message:
        "Expected one of: claimed_only, ai_inferred, human_approved, test_generated, fuzzed_passed, fuzzed_failed, symbolically_checked, formally_proven, weak_or_vacuous, out_of_scope."
    });
  });

  it("rejects invalid property statuses", () => {
    const issues = validateProperty({
      ...validWorkspace.properties[0],
      status: "Done" as never
    });

    expect(issues[0]?.path).toBe("property.status");
  });

  it("rejects invalid assumption statuses", () => {
    const issues = validateAssumption({
      ...validWorkspace.assumptions[0],
      status: "Done" as never
    });

    expect(issues[0]?.path).toBe("assumption.status");
  });
});
