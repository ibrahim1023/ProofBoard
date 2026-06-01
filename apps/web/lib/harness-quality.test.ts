import { describe, expect, it } from "vitest";
import { generateFoundryHarnessBundle } from "@proofboard/harness-generator";
import { demoWorkspace } from "./demo-workspace";
import { assessHarnessQuality } from "./harness-quality";

describe("harness quality", () => {
  it("reports scaffolded, partial, and missing harness flow coverage", () => {
    const report = assessHarnessQuality(demoWorkspace, generateFoundryHarnessBundle(demoWorkspace));

    expect(report.score).toBeGreaterThan(0);
    expect(report.checks.find((check) => check.id === "deposit")).toMatchObject({ status: "scaffolded" });
    expect(report.checks.find((check) => check.id === "mint")).toMatchObject({ status: "not-applicable" });
    expect(report.checks.find((check) => check.id === "pause")).toMatchObject({ status: "missing" });
    expect(report.checks.find((check) => check.id === "adversarial-token")).toMatchObject({ status: "partial" });
    expect(report.checks.find((check) => check.id === "privileged")?.nextAction).toContain("role-aware handlers");
  });
});
