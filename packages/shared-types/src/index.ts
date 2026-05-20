export const protocolTypes = ["erc4626_vault", "staking_vault", "custom_vault"] as const;
export type ProtocolType = (typeof protocolTypes)[number];

export const boardIds = [
  "upload",
  "map",
  "intent",
  "invariants",
  "assumptions",
  "ledger",
  "harness",
  "results",
  "export"
] as const;
export type BoardId = (typeof boardIds)[number];

export const reviewStatuses = ["AI-inferred", "Human-approved", "Edited", "Rejected"] as const;
export type ReviewStatus = (typeof reviewStatuses)[number];

export const verificationLevels = [
  "claimed_only",
  "ai_inferred",
  "human_approved",
  "test_generated",
  "fuzzed_passed",
  "fuzzed_failed",
  "symbolically_checked",
  "formally_proven",
  "weak_or_vacuous",
  "out_of_scope"
] as const;
export type VerificationLevel = (typeof verificationLevels)[number];

export const mvpVerificationLevels = [
  "claimed_only",
  "ai_inferred",
  "human_approved",
  "test_generated",
  "fuzzed_passed",
  "fuzzed_failed",
  "weak_or_vacuous",
  "out_of_scope"
] as const satisfies readonly VerificationLevel[];

export const assumptionStatuses = [
  "Unresolved",
  "Accepted risk",
  "Needs test",
  "Needs invariant",
  "Needs symbolic check",
  "Needs formal proof",
  "Mitigated in code",
  "Out of scope"
] as const;
export type AssumptionStatus = (typeof assumptionStatuses)[number];

export const propertyStatuses = [
  "Draft",
  "Approved",
  "Generated",
  "Fuzzed passed",
  "Fuzzed failed",
  "Weak or vacuous",
  "Out of scope"
] as const;
export type PropertyStatus = (typeof propertyStatuses)[number];

export const severityLevels = ["low", "medium", "high", "critical"] as const;
export type Severity = (typeof severityLevels)[number];

export const functionVisibilities = ["public", "external", "internal", "private"] as const;
export type FunctionVisibility = (typeof functionVisibilities)[number];

export const functionFlows = ["user", "privileged", "view", "internal"] as const;
export type FunctionFlow = (typeof functionFlows)[number];

export type EvidenceStrength = "none" | "weak" | "medium" | "strong";
export type VerificationRunStatus = "passed" | "failed" | "errored" | "not_run";

export interface Workspace {
  id: string;
  name: string;
  protocolType: ProtocolType;
  description: string;
  sources: SourceFile[];
  protocolMap: ProtocolMap;
  claims: Claim[];
  properties: Property[];
  assumptions: Assumption[];
  verificationRuns: VerificationRun[];
  evidence: Evidence[];
}

export interface SourceFile {
  id: string;
  path: string;
  language: "solidity" | "markdown" | "text";
  content: string;
}

export interface ProtocolMap {
  contracts: Contract[];
  roles: Role[];
  criticalState: StateVariable[];
  assetFlows: AssetFlow[];
  externalCalls: ExternalCall[];
  privilegedFunctions: ProtocolFunction[];
  userFlows: ProtocolFunction[];
  tokenDependencies: TokenDependency[];
  parserWarnings: string[];
}

export interface Contract {
  id: string;
  name: string;
  path: string;
  inherits: string[];
  functions: ProtocolFunction[];
  stateVariables: StateVariable[];
  events: ContractEvent[];
  modifiers: ContractModifier[];
  externalCalls: ExternalCall[];
}

export interface ProtocolFunction {
  id: string;
  contractId: string;
  name: string;
  signature: string;
  visibility: FunctionVisibility;
  flow: FunctionFlow;
  modifiers: string[];
  notes: string;
}

export interface StateVariable {
  id: string;
  contractId: string;
  name: string;
  type: string;
  visibility: FunctionVisibility | "default";
}

export interface ContractEvent {
  id: string;
  contractId: string;
  name: string;
  signature: string;
}

export interface ContractModifier {
  id: string;
  contractId: string;
  name: string;
  signature: string;
}

export interface ExternalCall {
  id: string;
  contractId: string;
  functionId?: string;
  target: string;
  expression: string;
}

export interface Role {
  id: string;
  name: string;
  source: string;
  privilegedFunctions: string[];
}

export interface AssetFlow {
  id: string;
  name: string;
  kind: "deposit" | "mint" | "withdraw" | "redeem" | "privileged" | "unknown";
  functions: string[];
  assets: string[];
  notes: string;
}

export interface TokenDependency {
  id: string;
  name: string;
  source: string;
  assumptions: string[];
}

export interface Claim {
  id: string;
  title: string;
  text: string;
  source: string[];
  confidence: number;
  relatedContracts: string[];
  relatedFunctions: string[];
  severity: Severity;
  status: ReviewStatus;
}

export interface Property {
  id: string;
  claimId: string;
  text: string;
  status: PropertyStatus;
  verificationLevel: VerificationLevel;
  risk: Severity;
  assumptions: string[];
  evidence: string[];
  nextAction: string;
}

export interface Assumption {
  id: string;
  text: string;
  whyItMatters: string;
  status: AssumptionStatus;
  severity: Severity;
  relatedProperties: string[];
  relatedFunctions: string[];
}

export interface VerificationRun {
  id: string;
  tool: "foundry" | "manual" | "halmos" | "echidna" | "medusa";
  command: string;
  status: VerificationRunStatus;
  counterexamples: string[];
  rawOutput: string;
  createdAt: string;
}

export interface Evidence {
  id: string;
  propertyId: string;
  source: string;
  strength: EvidenceStrength;
  verificationRunId?: string;
  summary: string;
}

export interface AuditPacket {
  workspaceId: string;
  protocolMap: ProtocolMap;
  approvedClaims: Claim[];
  properties: Property[];
  assumptions: Assumption[];
  evidence: Evidence[];
  generatedFiles: string[];
  unresolvedRisks: string[];
  suggestedAuditFocus: string[];
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export function validateWorkspace(workspace: Workspace): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  requireString(workspace.id, "id", issues);
  requireString(workspace.name, "name", issues);
  requireEnum(workspace.protocolType, protocolTypes, "protocolType", issues);
  requireArray(workspace.sources, "sources", issues);
  requireArray(workspace.protocolMap.contracts, "protocolMap.contracts", issues);

  workspace.claims.forEach((claim, index) => validateClaim(claim, `claims.${index}`, issues));
  workspace.properties.forEach((property, index) => validateProperty(property, `properties.${index}`, issues));
  workspace.assumptions.forEach((assumption, index) => validateAssumption(assumption, `assumptions.${index}`, issues));
  workspace.verificationRuns.forEach((run, index) => validateVerificationRun(run, `verificationRuns.${index}`, issues));
  workspace.evidence.forEach((evidence, index) => validateEvidence(evidence, `evidence.${index}`, issues));

  return issues;
}

export function validateClaim(claim: Claim, path = "claim", issues: ValidationIssue[] = []): ValidationIssue[] {
  requireString(claim.id, `${path}.id`, issues);
  requireString(claim.text, `${path}.text`, issues);
  requireEnum(claim.status, reviewStatuses, `${path}.status`, issues);
  requireEnum(claim.severity, severityLevels, `${path}.severity`, issues);
  if (claim.confidence < 0 || claim.confidence > 1) {
    issues.push({ path: `${path}.confidence`, message: "Confidence must be between 0 and 1." });
  }
  return issues;
}

export function validateProperty(property: Property, path = "property", issues: ValidationIssue[] = []): ValidationIssue[] {
  requireString(property.id, `${path}.id`, issues);
  requireString(property.claimId, `${path}.claimId`, issues);
  requireEnum(property.status, propertyStatuses, `${path}.status`, issues);
  requireEnum(property.verificationLevel, verificationLevels, `${path}.verificationLevel`, issues);
  requireEnum(property.risk, severityLevels, `${path}.risk`, issues);
  requireArray(property.assumptions, `${path}.assumptions`, issues);
  return issues;
}

export function validateAssumption(assumption: Assumption, path = "assumption", issues: ValidationIssue[] = []): ValidationIssue[] {
  requireString(assumption.id, `${path}.id`, issues);
  requireString(assumption.text, `${path}.text`, issues);
  requireEnum(assumption.status, assumptionStatuses, `${path}.status`, issues);
  requireEnum(assumption.severity, severityLevels, `${path}.severity`, issues);
  return issues;
}

export function validateVerificationRun(run: VerificationRun, path = "verificationRun", issues: ValidationIssue[] = []): ValidationIssue[] {
  requireString(run.id, `${path}.id`, issues);
  requireString(run.command, `${path}.command`, issues);
  requireEnum(run.status, ["passed", "failed", "errored", "not_run"] as const, `${path}.status`, issues);
  return issues;
}

export function validateEvidence(evidence: Evidence, path = "evidence", issues: ValidationIssue[] = []): ValidationIssue[] {
  requireString(evidence.id, `${path}.id`, issues);
  requireString(evidence.propertyId, `${path}.propertyId`, issues);
  requireEnum(evidence.strength, ["none", "weak", "medium", "strong"] as const, `${path}.strength`, issues);
  return issues;
}

function requireString(value: string, path: string, issues: ValidationIssue[]) {
  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push({ path, message: "Expected a non-empty string." });
  }
}

function requireArray(value: unknown[], path: string, issues: ValidationIssue[]) {
  if (!Array.isArray(value)) {
    issues.push({ path, message: "Expected an array." });
  }
}

function requireEnum<T extends string>(value: string, allowed: readonly T[], path: string, issues: ValidationIssue[]) {
  if (!allowed.includes(value as T)) {
    issues.push({ path, message: `Expected one of: ${allowed.join(", ")}.` });
  }
}
