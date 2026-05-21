import type { AuditPacket, Assumption, Property, Workspace } from "@proofboard/shared-types";
import type { HarnessBundle } from "@proofboard/harness-generator";

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
  const approvedProperties = workspace.properties.filter((property) =>
    packet.approvedClaims.some((claim) => claim.id === property.claimId)
  );

  return [
    markdownFile("proofboard-report.md", reportMarkdown(workspace, packet, approvedProperties)),
    jsonFile("proofboard-ledger.json", {
      properties: workspace.properties,
      evidence: workspace.evidence,
      verificationRuns: workspace.verificationRuns,
      assumptions: workspace.assumptions
    }),
    markdownFile("assumption-debt.md", assumptionDebtMarkdown(workspace.assumptions)),
    jsonFile("protocol-map.json", workspace.protocolMap),
    jsonFile("approved-properties.json", approvedProperties),
    jsonFile("generated-foundry-invariants.json", harnessBundle),
    markdownFile("audit-prep.md", auditPrepMarkdown(packet))
  ];
}

function reportMarkdown(workspace: Workspace, packet: AuditPacket, approvedProperties: Property[]) {
  return `# ProofBoard Assurance Report

Workspace: ${workspace.name || workspace.id}
Protocol type: ${workspace.protocolType}

ProofBoard separates generated intent, human-reviewed claims, candidate properties, assumptions, and verification evidence. This report is not a safety guarantee.

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

function assumptionDebtMarkdown(assumptions: Assumption[]) {
  return `# Assumption Debt

Accepted risk and out-of-scope assumptions remain visible alongside unresolved assumptions.

${assumptions
  .map(
    (assumption) => `## ${assumption.id}

- Status: ${assumption.status}
- Severity: ${assumption.severity}
- Assumption: ${assumption.text}
- Why it matters: ${assumption.whyItMatters}
- Related properties: ${assumption.relatedProperties.join(", ") || "Unlinked"}
- Related functions: ${assumption.relatedFunctions.join(", ") || "Unlinked"}
`
  )
  .join("\n")}`;
}

function auditPrepMarkdown(packet: AuditPacket) {
  return `# Audit Prep

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
