import { describe, expect, it } from "vitest";
import {
  type Workspace,
  validateAssumption,
  validateProperty,
  validateReviewRecord,
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
      skepticStatus: "Needs human review",
      skepticFindings: ["No harness has exercised this property yet."],
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
  ],
  reviewRecords: [
    {
      id: "review_claim_1",
      targetType: "claim",
      targetId: "claim_1",
      action: "approved",
      reviewer: "Security lead",
      comment: "Approved as protocol intent for harness generation.",
      createdAt: "2026-05-19T00:00:00Z"
    },
    {
      id: "review_property_1",
      targetType: "property",
      targetId: "property_1",
      action: "commented",
      reviewer: "Security lead",
      comment: "Needs stronger actor coverage before audit handoff.",
      createdAt: "2026-05-19T00:00:00Z"
    }
  ]
};

describe("shared schema validation", () => {
  it("accepts a complete workspace fixture", () => {
    expect(validateWorkspace(validWorkspace)).toEqual([]);
  });

  it("accepts lending market workspaces", () => {
    expect(validateWorkspace({ ...validWorkspace, protocolType: "lending_market" })).toEqual([]);
  });

  it("accepts AMM pool workspaces", () => {
    expect(validateWorkspace({ ...validWorkspace, protocolType: "amm_pool" })).toEqual([]);
  });

  it("accepts bridge workspaces", () => {
    expect(validateWorkspace({ ...validWorkspace, protocolType: "bridge" })).toEqual([]);
  });

  it("accepts governance workspaces", () => {
    expect(validateWorkspace({ ...validWorkspace, protocolType: "governance" })).toEqual([]);
  });

  it("validates repository metadata and approval policy", () => {
    expect(
      validateWorkspace({
        ...validWorkspace,
        repository: {
          provider: "github",
          repositoryUrl: "https://github.com/example/protocol",
          ref: "main",
          importedAt: "2026-06-10T00:00:00Z",
          files: ["src/Protocol.sol"]
        },
        approvalPolicy: { requiredApprovals: 2 }
      })
    ).toEqual([]);

    expect(validateWorkspace({ ...validWorkspace, approvalPolicy: { requiredApprovals: 0 } })[0]?.path).toBe(
      "approvalPolicy.requiredApprovals"
    );
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

  it("rejects invalid skeptic statuses", () => {
    const issues = validateProperty({
      ...validWorkspace.properties[0],
      skepticStatus: "Looks fine" as never
    });

    expect(issues[0]?.path).toBe("property.skepticStatus");
  });

  it("rejects invalid assumption statuses", () => {
    const issues = validateAssumption({
      ...validWorkspace.assumptions[0],
      status: "Done" as never
    });

    expect(issues[0]?.path).toBe("assumption.status");
  });

  it("rejects invalid review records", () => {
    const issues = validateReviewRecord({
      ...validWorkspace.reviewRecords![0],
      action: "signed" as never
    });

    expect(issues[0]?.path).toBe("reviewRecord.action");
  });

  it("rejects broken workspace claim, assumption, property, and evidence links", () => {
    const issues = validateWorkspace({
      ...validWorkspace,
      properties: [
        {
          ...validWorkspace.properties[0],
          claimId: "claim_missing",
          assumptions: ["assumption_missing"],
          evidence: ["evidence_missing"]
        }
      ],
      assumptions: [{ ...validWorkspace.assumptions[0], relatedProperties: ["property_missing"] }],
      evidence: [{ ...validWorkspace.evidence[0], propertyId: "property_missing" }],
      reviewRecords: [{ ...validWorkspace.reviewRecords![0], targetId: "claim_missing" }]
    });

    expect(issues.map((issue) => issue.path)).toEqual(
      expect.arrayContaining([
        "properties.0.claimId",
        "properties.0.assumptions.0",
        "properties.0.evidence.0",
        "assumptions.0.relatedProperties.0",
        "evidence.0.propertyId",
        "reviewRecords.0.targetId"
      ])
    );
  });
});
