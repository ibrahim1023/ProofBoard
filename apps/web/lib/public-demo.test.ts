import { describe, expect, it } from "vitest";
import { generateFoundryHarnessBundle } from "@proofboard/harness-generator";
import { generateAuditExportFiles } from "./audit-packet";
import { completedDemoWorkspace, demoWorkspace } from "./demo-workspace";
import { evaluatePublicDemo, publicDemoSteps } from "./public-demo";

describe("public demo workflow", () => {
  it("defines a bounded walkthrough across the review workflow", () => {
    expect(publicDemoSteps.map((step) => step.board)).toEqual([
      "Project",
      "Intent Board",
      "Assumption Debt",
      "Results",
      "Ledger",
      "Export"
    ]);
  });

  it("marks every public-demo acceptance criterion ready for the completed fixture", () => {
    const files = generateAuditExportFiles(completedDemoWorkspace, generateFoundryHarnessBundle(completedDemoWorkspace));
    const acceptance = evaluatePublicDemo(
      completedDemoWorkspace,
      files.map((file) => file.name)
    );

    expect(acceptance).toHaveLength(5);
    expect(acceptance.every((item) => item.satisfied)).toBe(true);
  });

  it("does not treat an unexecuted workspace as a completed public demo", () => {
    const files = generateAuditExportFiles(demoWorkspace, generateFoundryHarnessBundle(demoWorkspace));
    const acceptance = evaluatePublicDemo(
      demoWorkspace,
      files.map((file) => file.name)
    );

    expect(acceptance.find((item) => item.id === "parsed-foundry")?.satisfied).toBe(false);
  });
});
