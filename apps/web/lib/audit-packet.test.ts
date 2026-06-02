import { describe, expect, it } from "vitest";
import { generateFoundryHarnessBundle } from "@proofboard/harness-generator";
import { demoWorkspace } from "./demo-workspace";
import { buildAuditPacket, generateAuditExportFiles } from "./audit-packet";

describe("audit packet export", () => {
  it("creates the MVP export artifacts from the demo workspace", () => {
    const files = generateAuditExportFiles(demoWorkspace, generateFoundryHarnessBundle(demoWorkspace));

    expect(files.map((file) => file.name)).toEqual([
      "proofboard-report.md",
      "executive-summary.md",
      "approved-protocol-intent.md",
      "unresolved-assumptions-table.md",
      "verification-evidence-appendix.md",
      "failed-and-fuzzy-evidence.md",
      "auditor-questions.md",
      "proofboard-ledger.json",
      "verification-readiness.json",
      "harness-quality.json",
      "vacuity-report.json",
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
    const files = generateAuditExportFiles(demoWorkspace, bundle);
    const prep = files.find((file) => file.name === "audit-prep.md");
    const executiveSummary = files.find((file) => file.name === "executive-summary.md");
    const intent = files.find((file) => file.name === "approved-protocol-intent.md");
    const assumptionTable = files.find((file) => file.name === "unresolved-assumptions-table.md");
    const evidenceAppendix = files.find((file) => file.name === "verification-evidence-appendix.md");
    const fuzzyEvidence = files.find((file) => file.name === "failed-and-fuzzy-evidence.md");
    const auditorQuestions = files.find((file) => file.name === "auditor-questions.md");

    expect(packet.approvedClaims.map((claim) => claim.id)).toContain("claim_withdraw_ownership");
    expect(packet.unresolvedRisks.join("\n")).toContain("Underlying token does not rebase");
    expect(packet.suggestedAuditFocus.length).toBeGreaterThan(0);
    expect(prep?.content).toContain("Unresolved assumptions and out-of-scope areas");
    expect(prep?.content).toContain("Verification readiness");
    expect(prep?.content).toContain("Harness quality");
    expect(prep?.content).toContain("Vacuity review");
    expect(prep?.content).toContain("not a safety score");
    expect(generateAuditExportFiles(demoWorkspace, bundle).find((file) => file.name === "assumption-debt.md")?.content).toContain(
      "Owner: Protocol governance"
    );
    expect(executiveSummary?.content).toContain("External review packet map");
    expect(intent?.content).toContain("Only claims marked human-approved or edited");
    expect(intent?.content).not.toContain("Owner cannot drain user funds");
    expect(assumptionTable?.content).toContain("| assumption_no_rebase | Unresolved | medium |");
    expect(evidenceAppendix?.content).toContain("property_redeemable_assets");
    expect(fuzzyEvidence?.content).toContain("Weak or missing evidence records");
    expect(auditorQuestions?.content).toContain("Suggested Auditor Questions");
  });
});
