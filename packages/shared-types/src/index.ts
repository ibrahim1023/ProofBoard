export const protocolTypes = [
  "erc4626_vault",
  "staking_vault",
  "lending_market",
  "amm_pool",
  "bridge",
  "governance",
  "custom_vault"
] as const;
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

export const skepticStatuses = [
  "Acceptable",
  "Weak",
  "Vacuous",
  "Needs stronger actor model",
  "Needs adversarial mock",
  "Needs human review"
] as const;
export type SkepticStatus = (typeof skepticStatuses)[number];

export const severityLevels = ["low", "medium", "high", "critical"] as const;
export type Severity = (typeof severityLevels)[number];

export const functionVisibilities = ["public", "external", "internal", "private"] as const;
export type FunctionVisibility = (typeof functionVisibilities)[number];

export const functionFlows = ["user", "privileged", "view", "internal"] as const;
export type FunctionFlow = (typeof functionFlows)[number];

export const runtimeFamilies = ["evm", "solana", "other"] as const;
export type RuntimeFamily = (typeof runtimeFamilies)[number];

export const assuranceTargetKinds = ["contract", "program", "module", "service"] as const;
export type AssuranceTargetKind = (typeof assuranceTargetKinds)[number];

export const sourceLanguages = ["solidity", "rust", "markdown", "text", "other"] as const;
export type SourceLanguage = (typeof sourceLanguages)[number];

export type EvidenceStrength = "none" | "weak" | "medium" | "strong";
export type VerificationRunStatus = "passed" | "failed" | "errored" | "not_run";
export type VerificationTool = "foundry" | "manual" | "halmos" | "echidna" | "medusa" | "other";
export type ReviewTargetType = "claim" | "property";
export type ReviewAction = "approved" | "edited" | "rejected" | "commented" | "generated";

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
  reviewRecords?: ReviewRecord[];
  repository?: RepositoryImport;
  approvalPolicy?: ApprovalPolicy;
  assuranceModel?: AssuranceModel;
}

export interface AssuranceModel {
  version: "1";
  targets: AssuranceTarget[];
}

export interface AssuranceTarget {
  id: string;
  name: string;
  kind: AssuranceTargetKind;
  runtime: RuntimeDescriptor;
  sourceIds: string[];
  operationIds: string[];
}

export interface RuntimeDescriptor {
  family: RuntimeFamily;
  environment: string;
  sourceLanguage: SourceLanguage;
}

export interface VerificationBackend {
  id: string;
  name: string;
  kind: "test" | "fuzzer" | "symbolic" | "formal" | "manual" | "other";
  runtimeFamily: RuntimeFamily | "agnostic";
}

export interface RepositoryImport {
  provider: "github" | "local";
  repositoryUrl?: string;
  ref?: string;
  importedAt: string;
  files: string[];
}

export interface ApprovalPolicy {
  requiredApprovals: number;
}

export interface SourceFile {
  id: string;
  path: string;
  language: SourceLanguage;
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
  kind:
    | "deposit"
    | "mint"
    | "withdraw"
    | "redeem"
    | "stake"
    | "unstake"
    | "claim_rewards"
    | "supply"
    | "borrow"
    | "repay"
    | "liquidate"
    | "add_liquidity"
    | "remove_liquidity"
    | "swap"
    | "send_message"
    | "receive_message"
    | "finalize_message"
    | "propose"
    | "vote"
    | "queue"
    | "execute"
    | "upgrade"
    | "privileged"
    | "unknown";
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
  relatedTargets?: string[];
  relatedOperations?: string[];
  severity: Severity;
  status: ReviewStatus;
}

export interface Property {
  id: string;
  claimId: string;
  text: string;
  status: PropertyStatus;
  skepticStatus: SkepticStatus;
  skepticFindings: string[];
  verificationLevel: VerificationLevel;
  risk: Severity;
  assumptions: string[];
  evidence: string[];
  targetIds?: string[];
  nextAction: string;
}

export interface Assumption {
  id: string;
  text: string;
  whyItMatters: string;
  status: AssumptionStatus;
  severity: Severity;
  owner?: string;
  rationale?: string;
  revisitBy?: string;
  mitigation?: string;
  acceptedRiskJustification?: string;
  relatedProperties: string[];
  relatedFunctions: string[];
  relatedTargets?: string[];
  relatedOperations?: string[];
}

export interface VerificationRun {
  id: string;
  tool: VerificationTool;
  backend?: VerificationBackend;
  targetIds?: string[];
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
  backendId?: string;
  targetIds?: string[];
  artifactRefs?: string[];
  summary: string;
}

export interface ReviewRecord {
  id: string;
  targetType: ReviewTargetType;
  targetId: string;
  action: ReviewAction;
  reviewer: string;
  comment: string;
  createdAt: string;
}

export interface AuditPacket {
  workspaceId: string;
  assuranceModel?: AssuranceModel;
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
  workspace.reviewRecords?.forEach((record, index) => validateReviewRecord(record, `reviewRecords.${index}`, issues));
  if (workspace.repository) {
    requireEnum(workspace.repository.provider, ["github", "local"] as const, "repository.provider", issues);
    requireString(workspace.repository.importedAt, "repository.importedAt", issues);
    requireArray(workspace.repository.files, "repository.files", issues);
  }
  if (workspace.approvalPolicy && (!Number.isInteger(workspace.approvalPolicy.requiredApprovals) || workspace.approvalPolicy.requiredApprovals < 1)) {
    issues.push({ path: "approvalPolicy.requiredApprovals", message: "Required approvals must be a positive integer." });
  }
  if (workspace.assuranceModel) {
    requireEnum(workspace.assuranceModel.version, ["1"] as const, "assuranceModel.version", issues);
    requireArray(workspace.assuranceModel.targets, "assuranceModel.targets", issues);
    workspace.assuranceModel.targets.forEach((target, index) => validateAssuranceTarget(target, `assuranceModel.targets.${index}`, issues));
  }
  validateWorkspaceLinks(workspace, issues);

  return issues;
}

export function validateAssuranceTarget(
  target: AssuranceTarget,
  path = "assuranceTarget",
  issues: ValidationIssue[] = []
): ValidationIssue[] {
  requireString(target.id, `${path}.id`, issues);
  requireString(target.name, `${path}.name`, issues);
  requireEnum(target.kind, assuranceTargetKinds, `${path}.kind`, issues);
  requireEnum(target.runtime.family, runtimeFamilies, `${path}.runtime.family`, issues);
  requireString(target.runtime.environment, `${path}.runtime.environment`, issues);
  requireEnum(target.runtime.sourceLanguage, sourceLanguages, `${path}.runtime.sourceLanguage`, issues);
  requireArray(target.sourceIds, `${path}.sourceIds`, issues);
  requireArray(target.operationIds, `${path}.operationIds`, issues);
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
  requireEnum(property.skepticStatus, skepticStatuses, `${path}.skepticStatus`, issues);
  requireArray(property.skepticFindings, `${path}.skepticFindings`, issues);
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
  requireEnum(run.tool, ["foundry", "manual", "halmos", "echidna", "medusa", "other"] as const, `${path}.tool`, issues);
  requireString(run.command, `${path}.command`, issues);
  requireEnum(run.status, ["passed", "failed", "errored", "not_run"] as const, `${path}.status`, issues);
  if (run.backend) {
    requireString(run.backend.id, `${path}.backend.id`, issues);
    requireString(run.backend.name, `${path}.backend.name`, issues);
    requireEnum(
      run.backend.kind,
      ["test", "fuzzer", "symbolic", "formal", "manual", "other"] as const,
      `${path}.backend.kind`,
      issues
    );
    requireEnum(
      run.backend.runtimeFamily,
      ["evm", "solana", "other", "agnostic"] as const,
      `${path}.backend.runtimeFamily`,
      issues
    );
  }
  return issues;
}

export function validateEvidence(evidence: Evidence, path = "evidence", issues: ValidationIssue[] = []): ValidationIssue[] {
  requireString(evidence.id, `${path}.id`, issues);
  requireString(evidence.propertyId, `${path}.propertyId`, issues);
  requireEnum(evidence.strength, ["none", "weak", "medium", "strong"] as const, `${path}.strength`, issues);
  return issues;
}

export function validateReviewRecord(record: ReviewRecord, path = "reviewRecord", issues: ValidationIssue[] = []): ValidationIssue[] {
  requireString(record.id, `${path}.id`, issues);
  requireEnum(record.targetType, ["claim", "property"] as const, `${path}.targetType`, issues);
  requireString(record.targetId, `${path}.targetId`, issues);
  requireEnum(record.action, ["approved", "edited", "rejected", "commented", "generated"] as const, `${path}.action`, issues);
  requireString(record.reviewer, `${path}.reviewer`, issues);
  requireString(record.createdAt, `${path}.createdAt`, issues);
  return issues;
}

function validateWorkspaceLinks(workspace: Workspace, issues: ValidationIssue[]) {
  const claimIds = new Set(workspace.claims.map((claim) => claim.id));
  const propertyIds = new Set(workspace.properties.map((property) => property.id));
  const assumptionIds = new Set(workspace.assumptions.map((assumption) => assumption.id));
  const evidenceIds = new Set(workspace.evidence.map((evidence) => evidence.id));
  const sourceIds = new Set(workspace.sources.map((source) => source.id));
  const targetIds = new Set(workspace.assuranceModel?.targets.map((target) => target.id) ?? []);

  workspace.assuranceModel?.targets.forEach((target, targetIndex) => {
    target.sourceIds.forEach((sourceId, sourceIndex) =>
      requireLink(sourceIds, sourceId, `assuranceModel.targets.${targetIndex}.sourceIds.${sourceIndex}`, "source", issues)
    );
  });

  workspace.properties.forEach((property, propertyIndex) => {
    requireLink(claimIds, property.claimId, `properties.${propertyIndex}.claimId`, "claim", issues);
    property.assumptions.forEach((assumptionId, assumptionIndex) =>
      requireLink(assumptionIds, assumptionId, `properties.${propertyIndex}.assumptions.${assumptionIndex}`, "assumption", issues)
    );
    property.evidence.forEach((evidenceId, evidenceIndex) =>
      requireLink(evidenceIds, evidenceId, `properties.${propertyIndex}.evidence.${evidenceIndex}`, "evidence", issues)
    );
    property.targetIds?.forEach((targetId, targetIndex) =>
      requireLink(targetIds, targetId, `properties.${propertyIndex}.targetIds.${targetIndex}`, "assurance target", issues)
    );
  });

  workspace.assumptions.forEach((assumption, assumptionIndex) => {
    assumption.relatedProperties.forEach((propertyId, propertyIndex) =>
      requireLink(propertyIds, propertyId, `assumptions.${assumptionIndex}.relatedProperties.${propertyIndex}`, "property", issues)
    );
  });

  workspace.evidence.forEach((evidence, evidenceIndex) => {
    requireLink(propertyIds, evidence.propertyId, `evidence.${evidenceIndex}.propertyId`, "property", issues);
    evidence.targetIds?.forEach((targetId, targetIndex) =>
      requireLink(targetIds, targetId, `evidence.${evidenceIndex}.targetIds.${targetIndex}`, "assurance target", issues)
    );
  });
  workspace.claims.forEach((claim, claimIndex) => {
    claim.relatedTargets?.forEach((targetId, targetIndex) =>
      requireLink(targetIds, targetId, `claims.${claimIndex}.relatedTargets.${targetIndex}`, "assurance target", issues)
    );
  });
  workspace.assumptions.forEach((assumption, assumptionIndex) => {
    assumption.relatedTargets?.forEach((targetId, targetIndex) =>
      requireLink(targetIds, targetId, `assumptions.${assumptionIndex}.relatedTargets.${targetIndex}`, "assurance target", issues)
    );
  });
  workspace.verificationRuns.forEach((run, runIndex) => {
    run.targetIds?.forEach((targetId, targetIndex) =>
      requireLink(targetIds, targetId, `verificationRuns.${runIndex}.targetIds.${targetIndex}`, "assurance target", issues)
    );
  });
  workspace.reviewRecords?.forEach((record, recordIndex) => {
    const ids = record.targetType === "claim" ? claimIds : propertyIds;
    requireLink(ids, record.targetId, `reviewRecords.${recordIndex}.targetId`, record.targetType, issues);
  });
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

function requireLink(ids: Set<string>, id: string, path: string, kind: string, issues: ValidationIssue[]) {
  if (!ids.has(id)) {
    issues.push({ path, message: `Unknown ${kind} link: ${id}.` });
  }
}
