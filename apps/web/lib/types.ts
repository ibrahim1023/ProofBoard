export type ProtocolType = "erc4626_vault" | "staking_vault" | "custom_vault";

export type BoardId =
  | "upload"
  | "map"
  | "intent"
  | "invariants"
  | "assumptions"
  | "ledger"
  | "harness"
  | "results"
  | "export";

export type ReviewStatus = "AI-inferred" | "Human-approved" | "Edited" | "Rejected";

export type VerificationLevel =
  | "claimed_only"
  | "ai_inferred"
  | "human_approved"
  | "test_generated"
  | "fuzzed_passed"
  | "fuzzed_failed"
  | "weak_or_vacuous"
  | "out_of_scope";

export type AssumptionStatus =
  | "Unresolved"
  | "Accepted risk"
  | "Needs test"
  | "Needs invariant"
  | "Needs symbolic check"
  | "Needs formal proof"
  | "Mitigated in code"
  | "Out of scope";

export interface ProtocolFunction {
  name: string;
  visibility: "public" | "external" | "internal" | "private";
  flow: "user" | "privileged" | "view" | "internal";
  notes: string;
}

export interface Claim {
  id: string;
  title: string;
  text: string;
  source: string[];
  confidence: number;
  relatedFunctions: string[];
  severity: "low" | "medium" | "high" | "critical";
  status: ReviewStatus;
}

export interface Property {
  id: string;
  claimId: string;
  text: string;
  verificationLevel: VerificationLevel;
  risk: "low" | "medium" | "high" | "critical";
  assumptions: string[];
  nextAction: string;
}

export interface Assumption {
  id: string;
  text: string;
  whyItMatters: string;
  status: AssumptionStatus;
  severity: "low" | "medium" | "high" | "critical";
  relatedProperties: string[];
}

export interface Workspace {
  id: string;
  name: string;
  protocolType: ProtocolType;
  description: string;
  solidity: string;
  contracts: string[];
  functions: ProtocolFunction[];
  claims: Claim[];
  properties: Property[];
  assumptions: Assumption[];
}
