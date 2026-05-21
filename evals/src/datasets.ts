import type { Claim, Property } from "@proofboard/shared-types";

export interface EvalCase {
  id: string;
  releaseBlocker: boolean;
  note: string;
}

export const vaultSource = {
  id: "eval_source_erc4626",
  path: "src/EvalVault.sol",
  language: "solidity" as const,
  content: `contract EvalVault is ERC4626, Ownable {
    function deposit(uint256 assets, address receiver) public returns (uint256 shares) {}
    function withdraw(uint256 assets, address receiver, address owner) public returns (uint256 shares) {}
    function pause() external onlyOwner {}
  }`
};

export const claimExtractionCases = [
  {
    id: "erc4626_core_claims",
    releaseBlocker: true,
    note: "Vault maps must keep core deposit and withdraw claim coverage.",
    expectedClaimIds: ["claim_deposit_shares", "claim_withdraw_ownership", "claim_pause_blocks_flows"]
  }
] satisfies Array<EvalCase & { expectedClaimIds: string[] }>;

export const unsupportedClaimCases = [
  {
    id: "insufficient_oracle_evidence",
    releaseBlocker: true,
    note: "Unsupported LLM claims should refuse when sources are absent.",
    payload: { status: "insufficient_evidence", reason: "No oracle source exists in the map." }
  },
  {
    id: "invalid_unstructured_claim",
    releaseBlocker: true,
    note: "Malformed claims cannot enter review state.",
    payload: { status: "proposed", claims: [{ title: "This has no evidence." }] }
  }
] satisfies Array<EvalCase & { payload: unknown }>;

export const propertyCoverageCases = [
  {
    id: "approved_vault_claims",
    releaseBlocker: true,
    note: "Approved vault claims must cover withdraw, pause, and deposit property templates.",
    approvedClaimIds: ["claim_deposit_shares", "claim_withdraw_ownership", "claim_pause_blocks_flows"],
    expectedPropertyIds: ["property_deposit_mint_consistency", "property_redeemable_assets", "property_pause_behavior"]
  }
] satisfies Array<EvalCase & { approvedClaimIds: string[]; expectedPropertyIds: string[] }>;

export const weakInvariantCases = [
  {
    id: "vague_consistency",
    releaseBlocker: true,
    note: "Vague invariants must not be marked acceptable.",
    property: {
      id: "property_eval_vague",
      claimId: "claim_eval_vague",
      text: "Things should be consistent.",
      status: "Draft",
      skepticStatus: "Needs human review",
      skepticFindings: [],
      verificationLevel: "human_approved",
      risk: "medium",
      assumptions: [],
      evidence: [],
      nextAction: "Strengthen it."
    } satisfies Property
  }
] satisfies Array<EvalCase & { property: Property }>;

export const assumptionGenerationCases = [
  {
    id: "vault_token_assumptions",
    releaseBlocker: true,
    note: "Vault token behavior must keep ERC20 and adversarial token assumptions.",
    expectedAssumptionIds: ["assumption_standard_erc20", "assumption_no_fee_on_transfer", "assumption_no_rebase"]
  }
] satisfies Array<EvalCase & { expectedAssumptionIds: string[] }>;

export const foundryParserCases = [
  {
    id: "passed_and_failed_invariant_output",
    releaseBlocker: true,
    note: "Foundry fixtures must preserve pass/fail and counterexample text.",
    rawOutput: `[PASS] invariant_redeemableAssets() (runs: 256)
[FAIL. Reason: assertion failed] invariant_pauseBehavior()
Counterexample: pause accepted deposit
Sequence: handler.deposit(1 ether, alice)`,
    expectedStatus: "failed"
  },
  {
    id: "weak_handler_signal",
    releaseBlocker: true,
    note: "Unreached handlers cannot be counted as strong evidence.",
    rawOutput: `[PASS] invariant_redeemableAssets()
Warning: No calls made to target contract for selector deposit`,
    expectedStatus: "passed"
  }
] satisfies Array<EvalCase & { rawOutput: string; expectedStatus: "passed" | "failed" }>;

export function approveClaims(claims: Claim[], approvedClaimIds: string[]) {
  return claims.map((claim) => (approvedClaimIds.includes(claim.id) ? { ...claim, status: "Human-approved" as const } : claim));
}
