import type { Assumption, EvidenceStrength, Property, Workspace } from "@proofboard/shared-types";

export interface ReadinessFactor {
  id: string;
  label: string;
  score: number;
  weight: number;
  summary: string;
}

export interface VerificationReadiness {
  score: number;
  label: "Not ready" | "Needs work" | "Reviewable" | "Strong prep";
  factors: ReadinessFactor[];
  blockers: string[];
  nextActions: string[];
  disclaimer: string;
}

const disclaimer = "Verification readiness measures review preparation and evidence coverage. It is not a safety score or proof of correctness.";

export function calculateVerificationReadiness(workspace: Workspace): VerificationReadiness {
  const approvedClaims = workspace.claims.filter((claim) => claim.status === "Human-approved" || claim.status === "Edited");
  const reviewableClaims = workspace.claims.filter((claim) => claim.status !== "Rejected");
  const approvedClaimIds = new Set(approvedClaims.map((claim) => claim.id));
  const propertiesForApprovedClaims = workspace.properties.filter((property) => approvedClaimIds.has(property.claimId));
  const evidencedProperties = workspace.properties.filter((property) => property.evidence.length > 0);
  const mediumOrStrongEvidence = workspace.evidence.filter((evidence) => evidenceRank(evidence.strength) >= evidenceRank("medium"));
  const unresolvedAssumptions = workspace.assumptions.filter(isUnresolvedAssumption);
  const failedProperties = workspace.properties.filter((property) => property.verificationLevel === "fuzzed_failed");
  const weakProperties = workspace.properties.filter(
    (property) => property.verificationLevel === "weak_or_vacuous" || property.skepticStatus === "Weak" || property.skepticStatus === "Vacuous"
  );

  const factors: ReadinessFactor[] = [
    {
      id: "intent",
      label: "Approved intent",
      score: ratioScore(approvedClaims.length, reviewableClaims.length),
      weight: 25,
      summary: `${approvedClaims.length}/${reviewableClaims.length} reviewable claims are human-approved or edited.`
    },
    {
      id: "properties",
      label: "Property coverage",
      score: ratioScore(unique(propertiesForApprovedClaims.map((property) => property.claimId)).length, approvedClaims.length),
      weight: 20,
      summary: `${propertiesForApprovedClaims.length} properties trace back to ${approvedClaims.length} approved or edited claims.`
    },
    {
      id: "evidence",
      label: "Evidence coverage",
      score: evidenceCoverageScore(workspace.properties, workspace.evidence),
      weight: 25,
      summary: `${evidencedProperties.length}/${workspace.properties.length} properties have evidence; ${mediumOrStrongEvidence.length} evidence records are medium or strong.`
    },
    {
      id: "assumptions",
      label: "Assumption debt",
      score: assumptionDebtScore(workspace.assumptions),
      weight: 20,
      summary: `${unresolvedAssumptions.length}/${workspace.assumptions.length} assumptions remain unresolved or need more work.`
    },
    {
      id: "skeptic",
      label: "Skeptic checks",
      score: ratioScore(workspace.properties.length - weakProperties.length, workspace.properties.length),
      weight: 10,
      summary: `${weakProperties.length}/${workspace.properties.length} properties are weak or vacuous.`
    }
  ];

  const score = Math.round(
    factors.reduce((total, factor) => total + factor.score * factor.weight, 0) / factors.reduce((total, factor) => total + factor.weight, 0)
  );

  return {
    score,
    label: readinessLabel(score),
    factors,
    blockers: readinessBlockers(workspace, unresolvedAssumptions, failedProperties, weakProperties),
    nextActions: readinessNextActions(factors, unresolvedAssumptions, weakProperties),
    disclaimer
  };
}

function evidenceCoverageScore(properties: Property[], evidence: Workspace["evidence"]) {
  if (properties.length === 0) {
    return 0;
  }

  const evidenceByProperty = new Map<string, Workspace["evidence"]>();
  evidence.forEach((item) => {
    evidenceByProperty.set(item.propertyId, [...(evidenceByProperty.get(item.propertyId) ?? []), item]);
  });

  const total = properties.reduce((sum, property) => {
    const propertyEvidence = property.evidence.flatMap((id) => evidence.filter((item) => item.id === id));
    const fallbackEvidence = evidenceByProperty.get(property.id) ?? [];
    const strongest = [...propertyEvidence, ...fallbackEvidence].reduce(
      (current, item) => Math.max(current, evidenceRank(item.strength)),
      0
    );
    return sum + strongest / evidenceRank("strong");
  }, 0);

  return Math.round((total / properties.length) * 100);
}

function assumptionDebtScore(assumptions: Assumption[]) {
  if (assumptions.length === 0) {
    return 100;
  }

  const totalWeight = assumptions.reduce((sum, assumption) => sum + severityWeight(assumption.severity), 0);
  const openWeight = assumptions
    .filter(isUnresolvedAssumption)
    .reduce((sum, assumption) => sum + severityWeight(assumption.severity), 0);

  return Math.max(0, Math.round((1 - openWeight / totalWeight) * 100));
}

function readinessBlockers(
  workspace: Workspace,
  unresolvedAssumptions: Assumption[],
  failedProperties: Property[],
  weakProperties: Property[]
) {
  const blockers: string[] = [];

  if (workspace.claims.some((claim) => claim.status === "AI-inferred")) {
    blockers.push("AI-inferred claims still need human approval, editing, or rejection.");
  }

  if (workspace.properties.length === 0) {
    blockers.push("No candidate properties have been generated from approved intent.");
  }

  if (workspace.properties.some((property) => property.evidence.length === 0)) {
    blockers.push("Some properties have no attached evidence.");
  }

  if (unresolvedAssumptions.some((assumption) => assumption.severity === "critical" || assumption.severity === "high")) {
    blockers.push("High-severity assumption debt remains unresolved.");
  }

  if (failedProperties.length > 0) {
    blockers.push("Failed fuzz evidence needs implementation review, property review, or documented remediation.");
  }

  if (weakProperties.length > 0) {
    blockers.push("Weak or vacuous properties need stronger handlers, actors, or assertions.");
  }

  return blockers;
}

function readinessNextActions(factors: ReadinessFactor[], unresolvedAssumptions: Assumption[], weakProperties: Property[]) {
  const actions = factors
    .filter((factor) => factor.score < 80)
    .map((factor) => {
      if (factor.id === "intent") {
        return "Approve, edit, or reject remaining inferred claims before relying on generated properties.";
      }
      if (factor.id === "properties") {
        return "Generate or review properties for each approved claim.";
      }
      if (factor.id === "evidence") {
        return "Run or import verification evidence for properties that still have no evidence.";
      }
      if (factor.id === "assumptions") {
        return "Resolve, test, mitigate, or explicitly accept assumption debt.";
      }
      return "Strengthen weak or vacuous properties before treating passing runs as useful evidence.";
    });

  return unique([
    ...actions,
    ...unresolvedAssumptions.slice(0, 3).map((assumption) => `Resolve assumption ${assumption.id}: ${assumption.status}.`),
    ...weakProperties.slice(0, 3).map((property) => `Strengthen property ${property.id}: ${property.nextAction}`)
  ]).slice(0, 8);
}

function readinessLabel(score: number): VerificationReadiness["label"] {
  if (score >= 85) {
    return "Strong prep";
  }
  if (score >= 65) {
    return "Reviewable";
  }
  if (score >= 40) {
    return "Needs work";
  }
  return "Not ready";
}

function ratioScore(numerator: number, denominator: number) {
  if (denominator === 0) {
    return 0;
  }

  return Math.round((numerator / denominator) * 100);
}

function isUnresolvedAssumption(assumption: Assumption) {
  return assumption.status !== "Accepted risk" && assumption.status !== "Mitigated in code" && assumption.status !== "Out of scope";
}

function severityWeight(severity: Assumption["severity"]) {
  return {
    low: 1,
    medium: 2,
    high: 4,
    critical: 6
  }[severity];
}

function evidenceRank(strength: EvidenceStrength) {
  return {
    none: 0,
    weak: 1,
    medium: 2,
    strong: 3
  }[strength];
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}
