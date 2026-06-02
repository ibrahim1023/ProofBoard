import type { AuditPacket, Assumption, Property, Workspace } from "@proofboard/shared-types";
import type { HarnessBundle } from "@proofboard/harness-generator";
import { assessHarnessQuality, type HarnessQualityReport } from "./harness-quality";
import { calculateVerificationReadiness, type VerificationReadiness } from "./readiness";
import { assessInvariantVacuity, type VacuityReport } from "./vacuity";

export interface AuditExportFile {
  name: string;
  content: string;
  mimeType: string;
}

export function buildAuditPacket(workspace: Workspace, harnessBundle: HarnessBundle): AuditPacket {
  const unresolvedAssumptions = workspace.assumptions.filter(isUnresolvedAssumption);
  const outOfScope = workspace.assumptions.filter((assumption) => assumption.status === "Out of scope");

  return {
    workspaceId: workspace.id,
    protocolMap: workspace.protocolMap,
    approvedClaims: workspace.claims.filter((claim) => claim.status === "Human-approved" || claim.status === "Edited"),
    properties: workspace.properties,
    assumptions: workspace.assumptions,
    evidence: workspace.evidence,
    generatedFiles: harnessBundle.files.map((file) => file.path),
    unresolvedRisks: [
      ...unresolvedAssumptions.map((assumption) => `${assumption.severity}: ${assumption.text} (${assumption.status})`),
      ...outOfScope.map((assumption) => `out of scope: ${assumption.text}`)
    ],
    suggestedAuditFocus: suggestedAuditFocus(workspace.properties, unresolvedAssumptions)
  };
}

export function generateAuditExportFiles(workspace: Workspace, harnessBundle: HarnessBundle): AuditExportFile[] {
  const packet = buildAuditPacket(workspace, harnessBundle);
  const readiness = calculateVerificationReadiness(workspace);
  const harnessQuality = assessHarnessQuality(workspace, harnessBundle);
  const vacuity = assessInvariantVacuity(workspace);
  const approvedProperties = workspace.properties.filter((property) =>
    packet.approvedClaims.some((claim) => claim.id === property.claimId)
  );

  return [
    markdownFile("proofboard-report.md", reportMarkdown(workspace, packet, approvedProperties, readiness)),
    markdownFile("executive-summary.md", executiveSummaryMarkdown(workspace, packet, readiness, harnessQuality, vacuity)),
    markdownFile("approved-protocol-intent.md", approvedProtocolIntentMarkdown(packet, approvedProperties)),
    markdownFile("unresolved-assumptions-table.md", unresolvedAssumptionsTableMarkdown(workspace.assumptions)),
    markdownFile("verification-evidence-appendix.md", verificationEvidenceAppendixMarkdown(workspace, packet)),
    markdownFile("failed-and-fuzzy-evidence.md", failedAndFuzzyEvidenceMarkdown(workspace, vacuity)),
    markdownFile("auditor-questions.md", auditorQuestionsMarkdown(packet, readiness, harnessQuality, vacuity)),
    jsonFile("proofboard-ledger.json", {
      properties: workspace.properties,
      evidence: workspace.evidence,
      verificationRuns: workspace.verificationRuns,
      assumptions: workspace.assumptions,
      verificationReadiness: readiness,
      vacuity
    }),
    jsonFile("verification-readiness.json", readiness),
    jsonFile("harness-quality.json", harnessQuality),
    jsonFile("vacuity-report.json", vacuity),
    markdownFile("assumption-debt.md", assumptionDebtMarkdown(workspace.assumptions)),
    jsonFile("protocol-map.json", workspace.protocolMap),
    jsonFile("approved-properties.json", approvedProperties),
    jsonFile("generated-foundry-invariants.json", harnessBundle),
    markdownFile("audit-prep.md", auditPrepMarkdown(packet, readiness, harnessQuality, vacuity))
  ];
}

function reportMarkdown(workspace: Workspace, packet: AuditPacket, approvedProperties: Property[], readiness: VerificationReadiness) {
  return `# ProofBoard Assurance Report

Workspace: ${workspace.name || workspace.id}
Protocol type: ${workspace.protocolType}

ProofBoard separates generated intent, human-reviewed claims, candidate properties, assumptions, and verification evidence. This report is not a safety guarantee.

## Verification readiness
Score: ${readiness.score}/100 (${readiness.label})

${readiness.disclaimer}

${lines(readiness.factors.map((factor) => `${factor.label}: ${factor.score}/100 - ${factor.summary}`))}

## Approved or edited claims
${lines(packet.approvedClaims.map((claim) => `${claim.id}: ${claim.text}`))}

## Approved-claim properties
${lines(approvedProperties.map((property) => `${property.id}: ${property.text} [${property.verificationLevel}]`))}

## Evidence summary
${lines(packet.evidence.map((evidence) => `${evidence.propertyId}: ${evidence.strength} via ${evidence.source} - ${evidence.summary}`))}

## Unresolved and out-of-scope risk
${lines(packet.unresolvedRisks)}

## Suggested audit focus
${lines(packet.suggestedAuditFocus)}
`;
}

function executiveSummaryMarkdown(
  workspace: Workspace,
  packet: AuditPacket,
  readiness: VerificationReadiness,
  harnessQuality: HarnessQualityReport,
  vacuity: VacuityReport
) {
  return `# Executive Summary

Workspace: ${workspace.name || workspace.id}
Protocol type: ${workspace.protocolType}

ProofBoard is an assurance workspace, not an AI auditor, vulnerability scanner, formal proof engine, or safety guarantee. This packet summarizes review preparation, approved intent, candidate properties, assumptions, generated harness artifacts, and preserved verification evidence.

## Review posture
- Verification readiness: ${readiness.score}/100 (${readiness.label})
- Harness quality: ${harnessQuality.score}/100
- Invariant exercise visibility: ${vacuity.score}/100
- Approved or edited claims: ${packet.approvedClaims.length}
- Candidate properties: ${packet.properties.length}
- Evidence records: ${packet.evidence.length}
- Open risk items: ${packet.unresolvedRisks.length}

## Current blockers and next actions
${lines(readiness.blockers.length > 0 ? readiness.blockers : readiness.nextActions)}

## External review packet map
- \`approved-protocol-intent.md\`: human-approved or edited claims and their linked properties.
- \`unresolved-assumptions-table.md\`: unresolved, test-needed, undocumented, accepted-risk, and out-of-scope assumptions.
- \`verification-evidence-appendix.md\`: property-by-property evidence, run links, and next actions.
- \`failed-and-fuzzy-evidence.md\`: failed runs, weak evidence, skeptic findings, and vacuity warnings.
- \`auditor-questions.md\`: review questions derived from risks, assumptions, harness gaps, and vacuity signals.
`;
}

function approvedProtocolIntentMarkdown(packet: AuditPacket, approvedProperties: Property[]) {
  return `# Approved Protocol Intent

Only claims marked human-approved or edited are listed as approved protocol intent. AI-inferred and rejected claims remain outside this artifact.

## Approved or edited claims
${packet.approvedClaims
  .map((claim) => {
    const linkedProperties = approvedProperties.filter((property) => property.claimId === claim.id);
    return `### ${claim.title}

- Claim id: ${claim.id}
- Status: ${claim.status}
- Severity: ${claim.severity}
- Source: ${claim.source.join(", ") || "None recorded."}
- Text: ${claim.text}
- Linked properties: ${linkedProperties.map((property) => property.id).join(", ") || "None generated."}

${lines(linkedProperties.map((property) => `${property.id}: ${property.text} [${property.verificationLevel}]`))}`;
  })
  .join("\n\n")}
`;
}

function unresolvedAssumptionsTableMarkdown(assumptions: Assumption[]) {
  const reviewAssumptions = assumptions.filter((assumption) => assumption.status !== "Mitigated in code");
  const rows = reviewAssumptions.map((assumption) =>
    [
      assumption.id,
      assumption.status,
      assumption.severity,
      assumption.owner || "Unassigned",
      assumption.revisitBy || "Not scheduled",
      assumption.mitigation || "None recorded.",
      assumption.text
    ]
      .map(tableCell)
      .join(" | ")
  );

  return `# Unresolved Assumptions Table

This table keeps open assumptions, test-needed assumptions, accepted risk, and out-of-scope areas visible for external review. Accepted risk is not the same as verified behavior.

| Assumption | Status | Severity | Owner | Revisit by | Mitigation | Text |
|---|---|---|---|---|---|---|
${rows.length > 0 ? rows.map((row) => `| ${row} |`).join("\n") : "| None recorded. | - | - | - | - | - | - |"}
`;
}

function verificationEvidenceAppendixMarkdown(workspace: Workspace, packet: AuditPacket) {
  return `# Verification Evidence Appendix

Evidence entries preserve their source and strength. A passing run, generated harness, or manual review does not prove protocol safety.

${workspace.properties
  .map((property) => {
    const linkedEvidence = packet.evidence.filter(
      (evidence) => evidence.propertyId === property.id || property.evidence.includes(evidence.id)
    );
    const linkedRuns = linkedEvidence
      .map((evidence) => workspace.verificationRuns.find((run) => run.id === evidence.verificationRunId))
      .filter((run): run is NonNullable<typeof run> => Boolean(run));

    return `## ${property.id}

- Property: ${property.text}
- Status: ${property.status}
- Verification level: ${property.verificationLevel}
- Risk: ${property.risk}
- Next action: ${property.nextAction}
- Evidence: ${linkedEvidence.length > 0 ? linkedEvidence.map((evidence) => `${evidence.id} (${evidence.strength}, ${evidence.source}): ${evidence.summary}`).join("; ") : "None recorded."}
- Verification runs: ${linkedRuns.length > 0 ? linkedRuns.map((run) => `${run.id} (${run.tool}, ${run.status}): ${run.command}`).join("; ") : "None linked."}
`;
  })
  .join("\n")}
`;
}

function failedAndFuzzyEvidenceMarkdown(workspace: Workspace, vacuity: VacuityReport) {
  const failedRuns = workspace.verificationRuns.filter((run) => run.status === "failed" || run.status === "errored");
  const weakEvidence = workspace.evidence.filter((evidence) => evidence.strength === "weak" || evidence.strength === "none");
  const fuzzyProperties = workspace.properties.filter(
    (property) =>
      property.status !== "Fuzzed passed" ||
      property.skepticStatus !== "Acceptable" ||
      property.verificationLevel === "ai_inferred" ||
      property.verificationLevel === "test_generated"
  );

  return `# Failed And Fuzzy Evidence

This artifact is intentionally conservative. It groups failed runs, weak evidence, generated-but-unexecuted evidence, skeptic findings, and vacuity warnings so external reviewers can inspect them first.

## Failed or errored verification runs
${lines(
  failedRuns.map(
    (run) =>
      `${run.id}: ${run.status} via ${run.command}. Counterexamples: ${run.counterexamples.join(" | ") || "None preserved."}`
  )
)}

## Weak or missing evidence records
${lines(weakEvidence.map((evidence) => `${evidence.propertyId}: ${evidence.strength} via ${evidence.source} - ${evidence.summary}`))}

## Properties needing stronger review
${lines(
  fuzzyProperties.map(
    (property) =>
      `${property.id}: ${property.status}, ${property.verificationLevel}, ${property.skepticStatus}. ${property.skepticFindings.join(" ") || property.nextAction}`
  )
)}

## Vacuity and under-exercise findings
${lines(vacuity.findings.map((finding) => `${finding.severity}: ${finding.title} - ${finding.nextAction}`))}
`;
}

function auditorQuestionsMarkdown(
  packet: AuditPacket,
  readiness: VerificationReadiness,
  harnessQuality: HarnessQualityReport,
  vacuity: VacuityReport
) {
  const questions = [
    ...packet.suggestedAuditFocus.map((focus) => `Can the team resolve or justify this audit focus item: ${focus}`),
    ...packet.unresolvedRisks.map((risk) => `What evidence or design decision closes this unresolved risk: ${risk}`),
    ...readiness.blockers.map((blocker) => `What concrete work would remove this readiness blocker: ${blocker}`),
    ...harnessQuality.checks
      .filter((check) => check.status === "missing" || check.status === "partial")
      .map((check) => `How should the harness be strengthened for ${check.label}: ${check.nextAction}`),
    ...vacuity.findings.map((finding) => `Does the latest fuzz output really exercise this area: ${finding.title}? ${finding.nextAction}`)
  ];

  return `# Suggested Auditor Questions

These questions are generated from approved intent, assumption debt, evidence gaps, harness quality checks, and vacuity review. They are prompts for expert review, not findings by themselves.

${lines(unique(questions).slice(0, 24))}
`;
}

function assumptionDebtMarkdown(assumptions: Assumption[]) {
  return `# Assumption Debt

Accepted risk and out-of-scope assumptions remain visible alongside unresolved assumptions.

${assumptions
  .map(
    (assumption) => `## ${assumption.id}

- Status: ${assumption.status}
- Severity: ${assumption.severity}
- Owner: ${assumption.owner || "Unassigned"}
- Rationale: ${assumption.rationale || "None recorded."}
- Revisit by: ${assumption.revisitBy || "Not scheduled"}
- Mitigation: ${assumption.mitigation || "None recorded."}
- Accepted-risk justification: ${assumption.acceptedRiskJustification || "None recorded."}
- Assumption: ${assumption.text}
- Why it matters: ${assumption.whyItMatters}
- Related properties: ${assumption.relatedProperties.join(", ") || "Unlinked"}
- Related functions: ${assumption.relatedFunctions.join(", ") || "Unlinked"}
`
  )
  .join("\n")}`;
}

function auditPrepMarkdown(
  packet: AuditPacket,
  readiness: VerificationReadiness,
  harnessQuality: HarnessQualityReport,
  vacuity: VacuityReport
) {
  return `# Audit Prep

## Verification readiness
${readiness.score}/100 (${readiness.label})

${readiness.disclaimer}

${lines(readiness.nextActions)}

## Harness quality
${harnessQuality.score}/100

${lines(harnessQuality.checks.map((check) => `${check.label}: ${check.status} - ${check.nextAction}`))}

## Vacuity review
${vacuity.score}/100

Touched core flows: ${vacuity.touchedCoreFlows.join(", ") || "None visible in raw output."}

Missing core flows: ${vacuity.missingCoreFlows.join(", ") || "None detected."}

${lines(vacuity.findings.map((finding) => `${finding.severity}: ${finding.title} - ${finding.nextAction}`))}

## Suggested focus areas
${lines(packet.suggestedAuditFocus)}

## Unresolved assumptions and out-of-scope areas
${lines(packet.unresolvedRisks)}

## Generated Foundry scaffold files
${lines(packet.generatedFiles)}

Review raw verification runs and evidence summaries before elevating a property beyond the evidence level recorded in the ledger.
`;
}

function suggestedAuditFocus(properties: Property[], unresolvedAssumptions: Assumption[]) {
  const highRiskProperties = properties
    .filter((property) => property.risk === "critical" || property.risk === "high")
    .map((property) => `${property.id}: ${property.nextAction}`);
  const assumptionFocus = unresolvedAssumptions.map((assumption) => `${assumption.id}: resolve ${assumption.status.toLowerCase()} debt.`);
  return [...highRiskProperties, ...assumptionFocus].slice(0, 8);
}

function isUnresolvedAssumption(assumption: Assumption) {
  return assumption.status !== "Accepted risk" && assumption.status !== "Mitigated in code" && assumption.status !== "Out of scope";
}

function markdownFile(name: string, content: string): AuditExportFile {
  return { name, content, mimeType: "text/markdown" };
}

function jsonFile(name: string, value: unknown): AuditExportFile {
  return { name, content: JSON.stringify(value, null, 2), mimeType: "application/json" };
}

function lines(items: string[]) {
  return items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- None recorded.";
}

function tableCell(value: string) {
  return value.replaceAll("|", "\\|").replace(/\s+/g, " ").trim();
}

function unique(items: string[]) {
  return [...new Set(items)];
}
