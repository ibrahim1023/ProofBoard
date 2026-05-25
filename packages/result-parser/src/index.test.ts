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

  it("reports empty output before it can become evidence", () => {
    const parsed = parseFoundryOutput("", workspace.properties);

    expect(parsed.errors).toEqual(["Paste Foundry output before parsing."]);
    expect(parsed.runStatus).toBe("errored");
  });

  it("preserves unlinked invariant runs without mutating ledger properties", () => {
    const next = applyFoundryOutput(workspace, "[PASS] invariant_unknownAccounting()", "2026-05-21T01:00:00Z");

    expect(next.verificationRuns[0]).toMatchObject({ status: "passed", rawOutput: "[PASS] invariant_unknownAccounting()" });
    expect(next.properties.map((property) => property.verificationLevel)).toEqual(["test_generated", "test_generated"]);
    expect(next.evidence).toEqual([]);
  });

  it("parses Forge summary logs with runs, calls, and reverts metadata", () => {
    const parsed = parseFoundryOutput(
      `Ran 2 tests for test/invariants/ProofboardVaultInvariant.t.sol:ProofboardVaultInvariant
[PASS] invariant_redeemableAssets() (runs: 256, calls: 128000, reverts: 0)
[PASS] invariant_pauseBehavior() (runs: 256, calls: 51200, reverts: 10)
Suite result: ok. 2 passed; 0 failed; 0 skipped`,
      workspace.properties
    );

    expect(parsed.runStatus).toBe("passed");
    expect(parsed.results).toEqual([
      expect.objectContaining({ propertyId: "property_redeemable_assets", status: "passed" }),
      expect.objectContaining({ propertyId: "property_pause_behavior", status: "passed" })
    ]);
  });

  it("keeps multi-line failure traces attached to the active failing invariant", () => {
    const parsed = parseFoundryOutput(
      `[FAIL: assertion failed] invariant_pauseBehavior()
Counterexample:
  sender=0x0000000000000000000000000000000000000B0B
  args=[1, 2, 3]
Sequence:
  handler.pause()
  handler.deposit(1 ether, 0)`,
      workspace.properties
    );

    expect(parsed.runStatus).toBe("failed");
    expect(parsed.results[0]).toMatchObject({ propertyId: "property_pause_behavior", status: "failed" });
    expect(parsed.results[0]?.counterexample).toContain("sender=0x0000000000000000000000000000000000000B0B");
    expect(parsed.results[0]?.counterexample).toContain("handler.deposit(1 ether, 0)");
  });

  it("reports Forge no-match output as a parser error instead of evidence", () => {
    const parsed = parseFoundryOutput("No tests match the provided pattern: ProofboardVaultInvariant", workspace.properties);

    expect(parsed.runStatus).toBe("errored");
    expect(parsed.errors).toEqual(["No invariant pass or fail results were found in the Foundry output."]);
  });
});
