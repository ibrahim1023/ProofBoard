import { describe, expect, it } from "vitest";
import {
  type Workspace,
  validateAssuranceTarget,
  validateAssumption,
  validateEvmDeployment,
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

  it("accepts a chain-agnostic assurance model independently from execution support", () => {
    const workspace: Workspace = {
      ...validWorkspace,
      sources: [
        {
          id: "source_program",
          path: "programs/token-vault/src/lib.rs",
          language: "rust",
          content: "use anchor_lang::prelude::*;"
        }
      ],
      assuranceModel: {
        version: "1",
        targets: [
          {
            id: "target_token_vault",
            name: "TokenVault",
            kind: "program",
            runtime: {
              family: "solana",
              environment: "sbf",
              sourceLanguage: "rust"
            },
            sourceIds: ["source_program"],
            operationIds: ["initialize", "deposit", "withdraw"]
          }
        ]
      },
      claims: validWorkspace.claims.map((claim) => ({
        ...claim,
        relatedTargets: ["target_token_vault"],
        relatedOperations: ["withdraw"]
      })),
      properties: validWorkspace.properties.map((property) => ({
        ...property,
        targetIds: ["target_token_vault"]
      })),
      assumptions: validWorkspace.assumptions.map((assumption) => ({
        ...assumption,
        relatedTargets: ["target_token_vault"],
        relatedOperations: ["deposit"]
      })),
      verificationRuns: validWorkspace.verificationRuns.map((run) => ({
        ...run,
        targetIds: ["target_token_vault"],
        backend: {
          id: "backend_manual",
          name: "Manual architecture review",
          kind: "manual",
          runtimeFamily: "agnostic"
        }
      })),
      evidence: validWorkspace.evidence.map((evidence) => ({
        ...evidence,
        targetIds: ["target_token_vault"],
        backendId: "backend_manual",
        artifactRefs: ["review/token-vault.md"]
      }))
    };

    expect(validateWorkspace(workspace)).toEqual([]);
  });

  it("validates assurance target runtime descriptors", () => {
    expect(
      validateAssuranceTarget({
        id: "target_vault",
        name: "Vault",
        kind: "contract",
        runtime: {
          family: "evm",
          environment: "ethereum",
          sourceLanguage: "solidity"
        },
        sourceIds: ["source_vault"],
        operationIds: ["deposit"]
      })
    ).toEqual([]);

    expect(
      validateAssuranceTarget({
        id: "target_vault",
        name: "Vault",
        kind: "contract",
        runtime: {
          family: "unknown" as never,
          environment: "ethereum",
          sourceLanguage: "solidity"
        },
        sourceIds: [],
        operationIds: []
      })[0]?.path
    ).toBe("assuranceTarget.runtime.family");
  });

  it("accepts EVM multi-chain deployment metadata", () => {
    const deployment = {
      id: "deployment_vault_sepolia",
      targetId: "target_vault",
      runtimeFamily: "evm" as const,
      network: "Ethereum Sepolia",
      chainId: 11155111,
      address: "0x1111111111111111111111111111111111111111",
      explorerUrl: "https://sepolia.etherscan.io/address/0x1111111111111111111111111111111111111111",
      proxy: {
        kind: "transparent" as const,
        implementationAddress: "0x2222222222222222222222222222222222222222",
        adminAddress: "0x3333333333333333333333333333333333333333"
      },
      oracleFeeds: [
        {
          name: "ETH / USD",
          address: "0x4444444444444444444444444444444444444444",
          network: "Ethereum Sepolia",
          assumption: "Feed freshness is checked before use."
        }
      ],
      bridgeDependencies: [
        {
          name: "Canonical message bridge",
          network: "Ethereum Sepolia to L2",
          assumption: "Finality follows the documented challenge period."
        }
      ]
    };

    expect(validateEvmDeployment(deployment)).toEqual([]);
    expect(
      validateWorkspace({
        ...validWorkspace,
        assuranceModel: {
          version: "1",
          targets: [
            {
              id: "target_vault",
              name: "ExampleVault",
              kind: "contract",
              runtime: { family: "evm", environment: "ethereum", sourceLanguage: "solidity" },
              sourceIds: ["source_vault"],
              operationIds: ["deposit"]
            }
          ]
        },
        deployments: [deployment]
      })
    ).toEqual([]);
  });

  it("rejects invalid EVM chain ids and target links", () => {
    const deployment = {
      id: "deployment_invalid",
      targetId: "target_missing",
      runtimeFamily: "evm" as const,
      network: "Unknown",
      chainId: 0,
      address: "0x0",
      oracleFeeds: [],
      bridgeDependencies: []
    };

    expect(validateEvmDeployment(deployment)[0]?.path).toBe("deployment.chainId");
    expect(validateWorkspace({ ...validWorkspace, deployments: [deployment] })[0]?.path).toBe("deployments.0.chainId");
    expect(validateWorkspace({ ...validWorkspace, deployments: [{ ...deployment, chainId: 1 }] })[0]?.path).toBe(
      "deployments.0.targetId"
    );
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

  it("rejects broken assurance target and source links", () => {
    const issues = validateWorkspace({
      ...validWorkspace,
      assuranceModel: {
        version: "1",
        targets: [
          {
            id: "target_vault",
            name: "Vault",
            kind: "contract",
            runtime: { family: "evm", environment: "ethereum", sourceLanguage: "solidity" },
            sourceIds: ["source_missing"],
            operationIds: []
          }
        ]
      },
      claims: [{ ...validWorkspace.claims[0], relatedTargets: ["target_missing"] }]
    });

    expect(issues.map((issue) => issue.path)).toEqual(
      expect.arrayContaining(["assuranceModel.targets.0.sourceIds.0", "claims.0.relatedTargets.0"])
    );
  });
});
