import { describe, expect, it } from "vitest";
import { applyFoundryOutput } from "@proofboard/result-parser";
import { demoWorkspace } from "./demo-workspace";
import { assessInvariantVacuity } from "./vacuity";

describe("invariant vacuity report", () => {
  it("flags low call count, missing actors, and missing core flows", () => {
    const workspace = applyFoundryOutput(
      demoWorkspace,
      `[PASS] invariant_redeemableAssets() (runs: 16, calls: 12, reverts: 0)
Sequence:
  handler.deposit(1 ether, 0)`,
      "2026-06-02T00:00:00Z"
    );

    const report = assessInvariantVacuity(workspace);

    expect(report.score).toBeLessThan(100);
    expect(report.invariantMetrics[0]).toMatchObject({ testName: "invariant_redeemableAssets", calls: 12 });
    expect(report.touchedCoreFlows).toContain("deposit");
    expect(report.missingCoreFlows).toContain("withdraw");
    expect(report.findings.map((finding) => finding.id)).toEqual(
      expect.arrayContaining(["low_calls_invariant_redeemableAssets", "missing_core_flows", "missing_actor_evidence"])
    );
  });

  it("treats unreached handler output as a critical vacuity signal", () => {
    const workspace = applyFoundryOutput(
      demoWorkspace,
      `[PASS] invariant_redeemableAssets() (runs: 256, calls: 0, reverts: 0)
Warning: No calls made to target contract for selector deposit`,
      "2026-06-02T00:00:00Z"
    );

    const report = assessInvariantVacuity(workspace);

    expect(report.findings).toContainEqual(expect.objectContaining({ id: expect.stringMatching(/^unreached_/), severity: "critical" }));
    expect(report.score).toBeLessThan(70);
  });

  it("keeps empty run history as non-vacuous but unscored evidence", () => {
    const report = assessInvariantVacuity({ ...demoWorkspace, verificationRuns: [] });

    expect(report.score).toBe(100);
    expect(report.findings).toEqual([]);
    expect(report.invariantMetrics).toEqual([]);
  });
});
