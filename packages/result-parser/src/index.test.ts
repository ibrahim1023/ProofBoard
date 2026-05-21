import { describe, expect, it } from "vitest";
import type { Workspace } from "@proofboard/shared-types";
import { applyFoundryOutput, parseFoundryOutput } from "./index";

const workspace = {
  id: "workspace_results",
  name: "Results Vault",
  protocolType: "erc4626_vault",
  description: "Result parser fixture.",
  sources: [],
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
  claims: [],
  properties: [
    {
      id: "property_redeemable_assets",
      claimId: "claim_withdraw",
      text: "Redeemable assets should follow shares.",
      status: "Generated",
      skepticStatus: "Acceptable",
      skepticFindings: [],
      verificationLevel: "test_generated",
      risk: "critical",
      assumptions: [],
      evidence: [],
      nextAction: "Run Foundry."
    },
    {
      id: "property_pause_behavior",
      claimId: "claim_pause",
      text: "Pause should block movement.",
      status: "Generated",
      skepticStatus: "Needs human review",
      skepticFindings: [],
      verificationLevel: "test_generated",
      risk: "high",
      assumptions: [],
      evidence: [],
      nextAction: "Run Foundry."
    }
  ],
  assumptions: [],
  verificationRuns: [],
  evidence: []
} satisfies Workspace;

describe("Foundry result parser", () => {
  it("extracts pass, fail, and counterexample text", () => {
    const parsed = parseFoundryOutput(
      `[PASS] invariant_redeemableAssets() (runs: 256)
[FAIL. Reason: assertion failed] invariant_pauseBehavior()
Counterexample: pause was bypassed
Sequence: handler.deposit(1, alice)`,
      workspace.properties
    );

    expect(parsed.runStatus).toBe("failed");
    expect(parsed.results[0]).toMatchObject({ propertyId: "property_redeemable_assets", status: "passed" });
    expect(parsed.results[1]?.counterexample).toContain("pause was bypassed");
  });

  it("reports parser errors without mutating property status", () => {
    const next = applyFoundryOutput(workspace, "compiler output only", "2026-05-21T00:00:00Z");

    expect(next.properties[0]?.status).toBe("Generated");
    expect(next.verificationRuns[0]?.status).toBe("errored");
  });

  it("marks passed weak handler runs as weak evidence", () => {
    const next = applyFoundryOutput(
      workspace,
      `[PASS] invariant_redeemableAssets()
Warning: No calls made to target contract for selector deposit`,
      "2026-05-21T00:00:00Z"
    );

    expect(next.properties[0]).toMatchObject({ status: "Weak or vacuous", verificationLevel: "weak_or_vacuous" });
    expect(next.evidence[0]?.strength).toBe("weak");
  });
});
