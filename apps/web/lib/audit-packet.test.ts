import { describe, expect, it } from "vitest";
import { generateFoundryHarnessBundle } from "@proofboard/harness-generator";
import { demoWorkspace } from "./demo-workspace";
import { buildAuditPacket, generateAuditExportFiles } from "./audit-packet";

describe("audit packet export", () => {
  it("creates the MVP export artifacts from the demo workspace", () => {
    const files = generateAuditExportFiles(demoWorkspace, generateFoundryHarnessBundle(demoWorkspace));

    expect(files.map((file) => file.name)).toEqual([
      "proofboard-report.md",
      "proofboard-ledger.json",
      "assumption-debt.md",
      "protocol-map.json",
      "approved-properties.json",
      "generated-foundry-invariants.json",
      "audit-prep.md"
    ]);
  });

  it("keeps evidence, assumptions, and audit focus separated", () => {
    const bundle = generateFoundryHarnessBundle(demoWorkspace);
    const packet = buildAuditPacket(demoWorkspace, bundle);
    const prep = generateAuditExportFiles(demoWorkspace, bundle).find((file) => file.name === "audit-prep.md");

    expect(packet.approvedClaims.map((claim) => claim.id)).toContain("claim_withdraw_ownership");
    expect(packet.unresolvedRisks.join("\n")).toContain("Underlying token does not rebase");
    expect(packet.suggestedAuditFocus.length).toBeGreaterThan(0);
    expect(prep?.content).toContain("Unresolved assumptions and out-of-scope areas");
  });
});
