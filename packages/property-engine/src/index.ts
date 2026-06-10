import type {
  Assumption,
  Claim,
  ProtocolFunction,
  ProtocolMap,
  Property,
  SkepticStatus,
  Severity
} from "@proofboard/shared-types";

type ClaimTemplate = {
  id: string;
  title: string;
  text: string;
  confidence: number;
  severity: Severity;
  relatedFunctionNames: string[];
  source: string[];
  when: (map: ProtocolMap) => boolean;
};

export const claimSuggestionModes = ["template", "local_llm", "hosted_llm"] as const;
export type ClaimSuggestionMode = (typeof claimSuggestionModes)[number];

export interface ClaimSuggestionBoundary {
  mode: ClaimSuggestionMode;
  label: string;
  needsApiKey: boolean;
  transport: "deterministic" | "local_adapter" | "hosted_adapter";
}

export interface LlmClaimValidation {
  claims: Claim[];
  issues: string[];
  refusal?: string;
}

export const claimSuggestionBoundaries: ClaimSuggestionBoundary[] = [
  {
    mode: "template",
    label: "No-LLM template mode",
    needsApiKey: false,
    transport: "deterministic"
  },
  {
    mode: "local_llm",
    label: "Local LLM adapter boundary",
    needsApiKey: false,
    transport: "local_adapter"
  },
  {
    mode: "hosted_llm",
    label: "Optional hosted LLM adapter boundary",
    needsApiKey: true,
    transport: "hosted_adapter"
  }
];

const claimTemplates: ClaimTemplate[] = [
  {
    id: "claim_deposit_shares",
    title: "Deposits mint proportional shares",
    text: "Deposits should mint shares proportional to deposited assets within expected rounding bounds.",
    confidence: 0.82,
    severity: "high",
    relatedFunctionNames: ["deposit", "mint"],
    source: ["ERC4626 inheritance", "deposit/mint entrypoints"],
    when: (map) => hasAnyFunction(map.userFlows, ["deposit", "mint"])
  },
  {
    id: "claim_withdraw_ownership",
    title: "Withdrawals respect share ownership",
    text: "Users should not be able to withdraw more assets than their share ownership permits.",
    confidence: 0.86,
    severity: "critical",
    relatedFunctionNames: ["withdraw", "redeem"],
    source: ["ERC4626 inheritance", "withdraw/redeem entrypoints"],
    when: (map) => hasAnyFunction(map.userFlows, ["withdraw", "redeem"])
  },
  {
    id: "claim_exchange_rate_consistency",
    title: "Shares track vault assets consistently",
    text: "Total shares and total assets should remain economically consistent across user flows.",
    confidence: 0.78,
    severity: "critical",
    relatedFunctionNames: ["deposit", "mint", "withdraw", "redeem"],
    source: ["ERC4626 inheritance", "asset flow map"],
    when: (map) => isErc4626Like(map)
  },
  {
    id: "claim_donation_inflation_resistance",
    title: "Vault resists donation inflation",
    text: "A direct asset donation should not let an attacker unfairly inflate share value against later depositors.",
    confidence: 0.72,
    severity: "critical",
    relatedFunctionNames: ["deposit", "mint"],
    source: ["ERC4626 inheritance", "token dependency assumptions"],
    when: (map) => isErc4626Like(map) && map.tokenDependencies.length > 0
  },
  {
    id: "claim_pause_blocks_flows",
    title: "Paused vault blocks asset movement",
    text: "When the vault is paused, deposit and withdrawal behavior should match the documented emergency policy.",
    confidence: 0.9,
    severity: "high",
    relatedFunctionNames: ["deposit", "withdraw", "pause"],
    source: ["pause-like privileged function", "user asset flows"],
    when: (map) => hasAnyFunction(map.privilegedFunctions, ["pause"]) && map.userFlows.length > 0
  },
  {
    id: "claim_admin_no_drain",
    title: "Owner cannot drain user funds",
    text: "Privileged functions should not allow owner or admin roles to transfer user assets except through explicitly approved emergency or strategy flows.",
    confidence: 0.64,
    severity: "critical",
    relatedFunctionNames: ["pause", "setFeeRecipient", "setStrategy", "updateStrategy"],
    source: ["role map", "privileged function list"],
    when: (map) => map.privilegedFunctions.length > 0
  },
  {
    id: "claim_staking_principal_accounting",
    title: "Staked principal remains attributable",
    text: "Stake and unstake flows should preserve each user's attributable principal within documented rounding bounds.",
    confidence: 0.84,
    severity: "critical",
    relatedFunctionNames: ["stake", "unstake"],
    source: ["stake/unstake entrypoints", "staking balance state"],
    when: (map) => hasAnyFunction(map.userFlows, ["stake"]) && hasAnyFunction(map.userFlows, ["unstake"])
  },
  {
    id: "claim_staking_rewards_conserved",
    title: "Reward claims conserve funded rewards",
    text: "Claimed staking rewards should not exceed funded rewards plus documented emissions and should remain attributable across users.",
    confidence: 0.76,
    severity: "high",
    relatedFunctionNames: ["claimRewards", "getReward"],
    source: ["reward claim entrypoints", "reward token dependency"],
    when: (map) => hasAnyFunction(map.userFlows, ["claimreward", "getreward"])
  },
  {
    id: "claim_lending_collateralization",
    title: "Borrowing remains sufficiently collateralized",
    text: "Borrowing should remain bounded by collateral value, collateral factors, and fresh oracle prices across supply, borrow, repay, and withdrawal flows.",
    confidence: 0.86,
    severity: "critical",
    relatedFunctionNames: ["supplyCollateral", "borrow", "repay", "withdrawCollateral"],
    source: ["collateral and borrow entrypoints", "oracle dependency"],
    when: (map) => hasAnyFunction(map.userFlows, ["borrow"]) && hasAnyFunction(map.userFlows, ["supply", "collateral"])
  },
  {
    id: "claim_lending_liquidation_bounds",
    title: "Liquidations respect solvency bounds",
    text: "Liquidations should only seize collateral from eligible unhealthy positions and should respect documented close-factor and incentive bounds.",
    confidence: 0.83,
    severity: "critical",
    relatedFunctionNames: ["liquidate"],
    source: ["liquidation entrypoint", "collateral and debt state"],
    when: (map) => hasAnyFunction(map.userFlows, ["liquidat"])
  },
  {
    id: "claim_lending_debt_conservation",
    title: "Debt and bad debt remain accounted",
    text: "Aggregate borrower debt, repayments, reserves, and realized bad debt should remain explicitly accounted without silently creating or forgiving liabilities.",
    confidence: 0.78,
    severity: "critical",
    relatedFunctionNames: ["borrow", "repay", "liquidate"],
    source: ["borrow/repay entrypoints", "reserve and debt state"],
    when: (map) => hasAnyFunction(map.userFlows, ["borrow", "repay"])
  },
  {
    id: "claim_amm_reserve_consistency",
    title: "AMM reserves track token balances",
    text: "Recorded AMM reserves should remain consistent with token balances and the documented pricing invariant across liquidity and swap flows.",
    confidence: 0.86,
    severity: "critical",
    relatedFunctionNames: ["addLiquidity", "removeLiquidity", "swap"],
    source: ["reserve state", "liquidity and swap entrypoints"],
    when: (map) => hasAnyFunction(map.userFlows, ["swap"]) && hasAnyFunction(map.userFlows, ["liquidity"])
  },
  {
    id: "claim_amm_lp_share_accounting",
    title: "Liquidity provider shares remain proportional",
    text: "Liquidity minting and burning should preserve each provider's proportional claim on pool reserves within documented rounding bounds.",
    confidence: 0.84,
    severity: "critical",
    relatedFunctionNames: ["addLiquidity", "removeLiquidity"],
    source: ["liquidity entrypoints", "LP supply state"],
    when: (map) => hasAnyFunction(map.userFlows, ["addliquidity"]) && hasAnyFunction(map.userFlows, ["removeliquidity"])
  },
  {
    id: "claim_amm_fee_accounting",
    title: "Swap fees remain accounted",
    text: "Swap fees should accrue according to the configured fee policy without disappearing from reserves or being charged beyond documented bounds.",
    confidence: 0.8,
    severity: "high",
    relatedFunctionNames: ["swap"],
    source: ["swap entrypoint", "fee configuration state"],
    when: (map) => hasAnyFunction(map.userFlows, ["swap"])
  },
  {
    id: "claim_bridge_message_validity",
    title: "Bridge messages require valid origin evidence",
    text: "Relayed or finalized messages should match an authorized origin, source chain, destination chain, sender, payload, and nonce commitment.",
    confidence: 0.84,
    severity: "critical",
    relatedFunctionNames: ["sendMessage", "relayMessage", "receiveMessage", "finalizeMessage"],
    source: ["message entrypoints", "message commitment state"],
    when: (map) => hasAnyFunction(map.userFlows, ["message"]) && hasAnyFunction(map.userFlows, ["relay", "receive", "finalize"])
  },
  {
    id: "claim_bridge_replay_protection",
    title: "Bridge messages cannot be replayed",
    text: "A valid cross-chain message should be processed at most once for its source chain, nonce, sender, and payload commitment.",
    confidence: 0.9,
    severity: "critical",
    relatedFunctionNames: ["relayMessage", "receiveMessage", "finalizeMessage"],
    source: ["message processing entrypoint", "processed-message state"],
    when: (map) => hasAnyFunction(map.userFlows, ["relay", "receive", "finalize"])
  },
  {
    id: "claim_bridge_finality",
    title: "Bridge finalization respects finality",
    text: "Cross-chain messages should not finalize before the documented source-chain finality or challenge condition has been satisfied.",
    confidence: 0.8,
    severity: "critical",
    relatedFunctionNames: ["finalizeMessage", "finalizeWithdrawal"],
    source: ["finalization entrypoint", "finality or challenge state"],
    when: (map) => hasAnyFunction(map.userFlows, ["finalize"])
  }
];

export function suggestClaimsFromProtocolMap(map: ProtocolMap): Claim[] {
  return claimTemplates.filter((template) => template.when(map)).map((template) => {
    const relatedFunctions = resolveFunctionNames(map, template.relatedFunctionNames);
    return {
      id: template.id,
      title: template.title,
      text: template.text,
      source: template.source,
      confidence: template.confidence,
      relatedContracts: map.contracts.map((contract) => contract.name),
      relatedFunctions,
      severity: template.severity,
      status: "AI-inferred"
    };
  });
}

export function validateLlmClaimEnvelope(value: unknown, map: ProtocolMap): LlmClaimValidation {
  if (!isRecord(value)) {
    return { claims: [], issues: ["LLM response must be a JSON object."] };
  }

  if (value.status === "insufficient_evidence") {
    return typeof value.reason === "string" && value.reason.trim().length > 0
      ? { claims: [], issues: [], refusal: value.reason }
      : { claims: [], issues: ["Insufficient-evidence responses require a reason."] };
  }

  if (value.status !== "proposed" || !Array.isArray(value.claims)) {
    return { claims: [], issues: ["LLM response must use status proposed with a claims array, or status insufficient_evidence."] };
  }

  const issues: string[] = [];
  const claims = value.claims.flatMap((candidate, index) => {
    const claim = claimFromLlmCandidate(candidate, map, `claims.${index}`, issues);
    return claim ? [claim] : [];
  });

  if (claims.length === 0 && issues.length === 0) {
    issues.push("LLM response proposed no reviewable claims.");
  }

  return { claims, issues };
}

export function generatePropertiesFromClaims(claims: Claim[], map: ProtocolMap): Property[] {
  return claims
    .filter((claim) => claim.status === "Human-approved" || claim.status === "Edited")
    .flatMap((claim) => propertyTemplatesForClaim(claim, map))
    .map((property) => applySkepticReview(property, map));
}

export function applySkepticReview(property: Property, map: ProtocolMap): Property {
  const findings: string[] = [];
  let status: SkepticStatus = "Acceptable";
  const normalized = property.text.toLowerCase();

  if (property.text.trim().length < 80 || !normalized.includes("should")) {
    status = "Weak";
    findings.push("Property is short or underspecified; strengthen it with concrete accounting conditions.");
  }

  if (normalized.includes("consistent") && !normalized.includes("rounding") && !normalized.includes("exchange rate")) {
    status = "Weak";
    findings.push("Consistency property needs explicit exchange-rate or rounding bounds to avoid vague passing checks.");
  }

  if (property.assumptions.some((assumption) => assumption.includes("fee") || assumption.includes("rebase"))) {
    status = strongerStatus(status, "Needs adversarial mock");
    findings.push("Property depends on token behavior assumptions; add fee-on-transfer or rebasing mocks before treating evidence as strong.");
  }

  if (normalized.includes("multi-actor") || normalized.includes("attacker") || normalized.includes("victim")) {
    findings.push("Property needs an actor model that exercises adversarial sequencing.");
  }

  if (normalized.includes("owner") || normalized.includes("admin") || normalized.includes("privileged")) {
    status = strongerStatus(status, "Needs human review");
    findings.push("Privileged-flow property needs human review of documented emergency and strategy permissions.");
  }

  if (property.assumptions.length === 0 && map.tokenDependencies.length > 0) {
    status = strongerStatus(status, "Vacuous");
    findings.push("Property has no token assumptions despite token dependencies; it may pass while assuming away vault risk.");
  }

  if (map.userFlows.length > 1 && !mentionsAny(normalized, map.userFlows.map((fn) => fn.name))) {
    status = strongerStatus(status, "Needs stronger actor model");
    findings.push("Property does not reference detected user flows, so a harness could pass without exercising critical paths.");
  }

  if (findings.length === 0) {
    findings.push("Property is specific enough for a draft invariant; still requires generated harness evidence.");
  }

  return {
    ...property,
    skepticStatus: status,
    skepticFindings: findings
  };
}

export function suggestTokenAssumptions(map: ProtocolMap): Assumption[] {
  const assumptions: Assumption[] = [];

  if (map.tokenDependencies.length > 0) {
    assumptions.push(
      {
        id: "assumption_standard_erc20",
        text: "Underlying token behaves like a standard ERC20.",
        whyItMatters: "Non-standard return values or callbacks can invalidate generated vault accounting evidence.",
        status: "Needs test",
        severity: "high",
        relatedProperties: [],
        relatedFunctions: ["deposit", "mint", "withdraw", "redeem"]
      },
      {
        id: "assumption_no_fee_on_transfer",
        text: "Underlying token has no fee-on-transfer behavior.",
        whyItMatters: "Fee-on-transfer behavior can make received assets differ from requested assets.",
        status: "Needs invariant",
        severity: "high",
        relatedProperties: [],
        relatedFunctions: ["deposit", "withdraw"]
      },
      {
        id: "assumption_no_rebase",
        text: "Underlying token does not rebase.",
        whyItMatters: "Rebases can change vault balances without explicit user flows.",
        status: "Unresolved",
        severity: "medium",
        relatedProperties: [],
        relatedFunctions: ["deposit", "withdraw", "redeem"]
      },
      {
        id: "assumption_no_reentrant_token",
        text: "Underlying token does not reenter vault flows.",
        whyItMatters: "Token callbacks can create multi-step states that simple handlers do not exercise.",
        status: "Needs test",
        severity: "high",
        relatedProperties: [],
        relatedFunctions: ["deposit", "withdraw"]
      },
      {
        id: "assumption_decimals_compatible",
        text: "Token decimals are compatible with vault accounting.",
        whyItMatters: "Decimal mismatches can amplify rounding and share accounting edge cases.",
        status: "Needs invariant",
        severity: "medium",
        relatedProperties: [],
        relatedFunctions: ["deposit", "mint", "withdraw", "redeem"]
      }
    );
  }

  if (map.privilegedFunctions.length > 0 || map.roles.length > 0) {
    assumptions.push({
      id: "assumption_admin_policy",
      text: "Admin actions follow the documented emergency policy.",
      whyItMatters: "Privileged paths can pause, redirect, or alter protocol behavior outside normal user flows.",
      status: "Accepted risk",
      severity: "medium",
      relatedProperties: [],
      relatedFunctions: map.privilegedFunctions.map((fn) => fn.name)
    });
  }

  if (map.privilegedFunctions.some((fn) => fn.name.toLowerCase().includes("strategy"))) {
    assumptions.push({
      id: "assumption_strategy_returns_funds",
      text: "Strategy integrations can return funds when needed.",
      whyItMatters: "Vault solvency can depend on strategy liquidity outside the ERC4626 surface.",
      status: "Unresolved",
      severity: "high",
      relatedProperties: [],
      relatedFunctions: map.privilegedFunctions.map((fn) => fn.name)
    });
  }

  if (
    map.externalCalls.some((call) => call.target.toLowerCase().includes("oracle")) ||
    (hasAnyFunction(map.userFlows, ["borrow"]) && hasAnyFunction(map.userFlows, ["liquidat"]))
  ) {
    assumptions.push({
      id: "assumption_oracle_fresh",
      text: "Oracle price data is fresh and cannot be cheaply manipulated.",
      whyItMatters: "Stale or manipulated oracle inputs can invalidate asset/share accounting assumptions.",
      status: "Needs symbolic check",
      severity: "high",
      relatedProperties: [],
      relatedFunctions: map.externalCalls.map((call) => call.functionId ?? call.target)
    });
  }

  if (hasAnyFunction(map.userFlows, ["stake", "unstake"])) {
    assumptions.push(
      {
        id: "assumption_unstaking_liquidity",
        text: "Staked principal remains available when users are permitted to unstake.",
        whyItMatters: "External staking or delegation can make recorded principal temporarily or permanently illiquid.",
        status: "Needs invariant",
        severity: "high",
        relatedProperties: [],
        relatedFunctions: resolveFunctionNames(map, ["stake", "unstake"])
      },
      {
        id: "assumption_rewards_funded",
        text: "Reward emissions are funded and cannot exceed the available reward-token balance.",
        whyItMatters: "Unfunded or over-accrued rewards can make claims insolvent or dilute later claimants.",
        status: "Needs invariant",
        severity: "high",
        relatedProperties: [],
        relatedFunctions: resolveFunctionNames(map, ["claimRewards", "getReward"])
      }
    );
  }

  if (hasAnyFunction(map.userFlows, ["borrow", "liquidat"])) {
    assumptions.push(
      {
        id: "assumption_liquidation_execution",
        text: "Eligible unhealthy positions can be liquidated before losses exceed available collateral and reserves.",
        whyItMatters: "Congestion, unprofitable incentives, or close-factor limits can let insolvency grow into protocol bad debt.",
        status: "Needs invariant",
        severity: "critical",
        relatedProperties: [],
        relatedFunctions: resolveFunctionNames(map, ["borrow", "liquidate"])
      },
      {
        id: "assumption_bad_debt_policy",
        text: "Bad debt recognition and absorption follow an explicit reserve or socialization policy.",
        whyItMatters: "Unspecified bad-debt handling can hide insolvency or shift losses between suppliers.",
        status: "Unresolved",
        severity: "critical",
        relatedProperties: [],
        relatedFunctions: resolveFunctionNames(map, ["borrow", "repay", "liquidate"])
      }
    );
  }

  if (hasAnyFunction(map.userFlows, ["swap", "liquidity"])) {
    assumptions.push(
      {
        id: "assumption_amm_reserve_sync",
        text: "Recorded reserves are synchronized with actual token balances after swaps, liquidity changes, donations, and token behavior.",
        whyItMatters: "Unsynchronized reserves can corrupt pricing, LP share value, and fee accounting.",
        status: "Needs invariant",
        severity: "critical",
        relatedProperties: [],
        relatedFunctions: resolveFunctionNames(map, ["addLiquidity", "removeLiquidity", "swap"])
      },
      {
        id: "assumption_amm_fee_policy",
        text: "Swap and protocol fee parameters stay within documented bounds and are applied exactly once.",
        whyItMatters: "Incorrect or mutable fee application can leak value, overcharge traders, or misstate pool reserves.",
        status: "Needs invariant",
        severity: "high",
        relatedProperties: [],
        relatedFunctions: resolveFunctionNames(map, ["swap"])
      }
    );
  }

  if (hasAnyFunction(map.userFlows, ["message", "relay", "finalize"])) {
    assumptions.push(
      {
        id: "assumption_bridge_relayer_trust",
        text: "Relayers, validators, or proof submitters cannot forge an accepted source-chain message commitment.",
        whyItMatters: "A forged commitment can authorize arbitrary message execution or asset release on the destination chain.",
        status: "Needs formal proof",
        severity: "critical",
        relatedProperties: [],
        relatedFunctions: resolveFunctionNames(map, ["relayMessage", "receiveMessage", "finalizeMessage"])
      },
      {
        id: "assumption_bridge_finality",
        text: "The configured finality or challenge rule is sufficient for the source chain and cannot be bypassed.",
        whyItMatters: "Premature finalization can accept messages from blocks that later reorganize or are successfully challenged.",
        status: "Needs symbolic check",
        severity: "critical",
        relatedProperties: [],
        relatedFunctions: resolveFunctionNames(map, ["finalizeMessage", "finalizeWithdrawal"])
      },
      {
        id: "assumption_bridge_domain_separation",
        text: "Message commitments include unambiguous source chain, destination chain, sender, nonce, and payload domain separation.",
        whyItMatters: "Missing domain fields can allow valid messages to be replayed across chains, contracts, or message types.",
        status: "Needs invariant",
        severity: "critical",
        relatedProperties: [],
        relatedFunctions: resolveFunctionNames(map, ["sendMessage", "relayMessage", "receiveMessage"])
      }
    );
  }

  return assumptions;
}

export function linkAssumptionsToProperties(assumptions: Assumption[], properties: Property[]): Assumption[] {
  return assumptions.map((assumption) => ({
    ...assumption,
    relatedProperties: unique([
      ...assumption.relatedProperties,
      ...properties.filter((property) => property.assumptions.includes(assumption.id)).map((property) => property.id)
    ])
  }));
}

function claimFromLlmCandidate(candidate: unknown, map: ProtocolMap, path: string, issues: string[]): Claim | undefined {
  if (!isRecord(candidate)) {
    issues.push(`${path} must be an object.`);
    return undefined;
  }

  const title = requiredText(candidate.title, `${path}.title`, issues);
  const text = requiredText(candidate.text, `${path}.text`, issues);
  const source = stringList(candidate.source, `${path}.source`, issues);
  const severity = severityFromValue(candidate.severity, `${path}.severity`, issues);
  const confidence = confidenceFromValue(candidate.confidence, `${path}.confidence`, issues);

  if (!title || !text || !severity || confidence === undefined || source.length === 0) {
    return undefined;
  }

  return {
    id: `claim_llm_${slug(title)}`,
    title,
    text,
    source,
    confidence,
    relatedContracts: stringList(candidate.relatedContracts, `${path}.relatedContracts`, [], map.contracts.map((contract) => contract.name)),
    relatedFunctions: stringList(candidate.relatedFunctions, `${path}.relatedFunctions`, []),
    severity,
    status: "AI-inferred"
  };
}

function propertyTemplatesForClaim(claim: Claim, map: ProtocolMap): Property[] {
  const base = {
    claimId: claim.id,
    evidence: [],
    skepticStatus: "Needs human review" as const,
    skepticFindings: ["Generated draft requires human review before harness evidence is trusted."],
    verificationLevel: "human_approved" as const
  };
  const normalizedTitle = claim.title.toLowerCase();

  if (normalizedTitle.includes("deposit")) {
    return [
      {
        ...base,
        id: "property_deposit_mint_consistency",
        text: "For equivalent economic inputs, deposit and mint flows should produce consistent accounting outcomes within expected rounding bounds.",
        status: "Draft",
        risk: claim.severity,
        assumptions: ["assumption_standard_erc20", "assumption_no_fee_on_transfer"],
        nextAction: "Generate a Foundry invariant covering deposit and mint equivalence with rounding bounds."
      }
    ];
  }

  if (normalizedTitle.includes("withdraw")) {
    return [
      {
        ...base,
        id: "property_redeemable_assets",
        text: "A user's redeemable assets should never exceed the value permitted by their share ownership and the vault exchange rate.",
        status: "Draft",
        risk: claim.severity,
        assumptions: ["assumption_standard_erc20", "assumption_no_rebase"],
        nextAction: "Generate a multi-actor withdraw/redeem invariant."
      }
    ];
  }

  if (normalizedTitle.includes("shares track") || normalizedTitle.includes("assets")) {
    return [
      {
        ...base,
        id: "property_total_assets_supply_consistency",
        text: "Total assets and total supply should remain consistent with the ERC4626 exchange rate across deposit, mint, withdraw, and redeem flows.",
        status: "Draft",
        risk: claim.severity,
        assumptions: ["assumption_standard_erc20", "assumption_no_rebase"],
        nextAction: "Generate totalAssets/totalSupply accounting invariant."
      }
    ];
  }

  if (normalizedTitle.includes("donation")) {
    return [
      {
        ...base,
        id: "property_donation_inflation_resistance",
        text: "A direct asset donation to the vault should not let an attacker unfairly inflate share value against later depositors.",
        status: "Draft",
        risk: claim.severity,
        assumptions: ["assumption_standard_erc20", "assumption_no_fee_on_transfer"],
        nextAction: "Generate donation scenario with attacker and victim actors."
      }
    ];
  }

  if (normalizedTitle.includes("paused")) {
    return [
      {
        ...base,
        id: "property_pause_behavior",
        text: "Paused state should block user-facing asset movement while preserving explicitly documented emergency behavior.",
        status: "Draft",
        risk: claim.severity,
        assumptions: ["assumption_admin_policy"],
        nextAction: "Generate pause-state invariant for deposit, mint, withdraw, and redeem flows."
      }
    ];
  }

  if (normalizedTitle.includes("owner") || normalizedTitle.includes("admin")) {
    return [
      {
        ...base,
        id: "property_privileged_no_drain",
        text: "Privileged functions should not transfer or strand user assets outside documented emergency and strategy flows.",
        status: "Draft",
        risk: claim.severity,
        assumptions: ["assumption_admin_policy"],
        nextAction: "Generate access-control invariant and review privileged asset movement paths."
      }
    ];
  }

  if (normalizedTitle.includes("staked principal")) {
    return [
      {
        ...base,
        id: "property_staking_principal_conservation",
        text: "Across stake and unstake flows, aggregate user principal should not exceed received staking assets and each user's unstakeable principal should remain bounded by their recorded stake.",
        status: "Draft",
        risk: claim.severity,
        assumptions: ["assumption_standard_erc20", "assumption_unstaking_liquidity"],
        nextAction: "Generate multi-actor stake and unstake accounting invariants."
      }
    ];
  }

  if (normalizedTitle.includes("reward claims")) {
    return [
      {
        ...base,
        id: "property_staking_reward_conservation",
        text: "Across reward accrual and claim flows, cumulative rewards paid should not exceed funded rewards plus documented emissions, within explicit rounding bounds.",
        status: "Draft",
        risk: claim.severity,
        assumptions: ["assumption_rewards_funded", "assumption_standard_erc20"],
        nextAction: "Generate multi-user reward accrual and claim invariants."
      }
    ];
  }

  if (normalizedTitle.includes("sufficiently collateralized")) {
    return [
      {
        ...base,
        id: "property_lending_collateralization",
        text: "After supply, borrow, repay, collateral withdrawal, and price-update flows, each non-liquidatable account should keep debt value within its collateral-factor-adjusted collateral value.",
        status: "Draft",
        risk: claim.severity,
        assumptions: ["assumption_oracle_fresh", "assumption_standard_erc20"],
        nextAction: "Generate multi-actor collateral, borrow, repay, and price-change invariants."
      }
    ];
  }

  if (normalizedTitle.includes("liquidations")) {
    return [
      {
        ...base,
        id: "property_lending_liquidation_bounds",
        text: "A liquidation should only affect an unhealthy borrower, should not repay more than documented close-factor bounds, and should not seize collateral beyond debt value plus the allowed incentive.",
        status: "Draft",
        risk: claim.severity,
        assumptions: ["assumption_oracle_fresh", "assumption_liquidation_execution"],
        nextAction: "Generate healthy/unhealthy borrower and liquidation-bound scenarios."
      }
    ];
  }

  if (normalizedTitle.includes("bad debt")) {
    return [
      {
        ...base,
        id: "property_lending_debt_conservation",
        text: "Across borrow, repay, interest accrual, liquidation, and write-off flows, aggregate debt should equal accounted borrower liabilities plus explicitly recognized bad debt within rounding bounds.",
        status: "Draft",
        risk: claim.severity,
        assumptions: ["assumption_bad_debt_policy", "assumption_oracle_fresh"],
        nextAction: "Generate aggregate debt, reserve, repayment, and bad-debt accounting invariants."
      }
    ];
  }

  if (normalizedTitle.includes("amm reserves")) {
    return [
      {
        ...base,
        id: "property_amm_reserve_consistency",
        text: "After add-liquidity, remove-liquidity, swap, and direct-token-transfer scenarios, recorded reserves should match accounted token balances and preserve the documented pricing invariant within rounding bounds.",
        status: "Draft",
        risk: claim.severity,
        assumptions: ["assumption_amm_reserve_sync", "assumption_standard_erc20"],
        nextAction: "Generate reserve-balance and pricing-invariant scenarios across liquidity and swap flows."
      }
    ];
  }

  if (normalizedTitle.includes("liquidity provider shares")) {
    return [
      {
        ...base,
        id: "property_amm_lp_share_accounting",
        text: "Across liquidity mint and burn flows, LP shares should represent a proportional claim on both reserves and no provider should redeem more than their accounted pool ownership.",
        status: "Draft",
        risk: claim.severity,
        assumptions: ["assumption_amm_reserve_sync", "assumption_standard_erc20"],
        nextAction: "Generate multi-provider add/remove liquidity and rounding invariants."
      }
    ];
  }

  if (normalizedTitle.includes("swap fees")) {
    return [
      {
        ...base,
        id: "property_amm_fee_accounting",
        text: "For every successful swap, the fee charged should stay within configured bounds and the retained fee value should remain explicitly represented in pool or protocol accounting.",
        status: "Draft",
        risk: claim.severity,
        assumptions: ["assumption_amm_fee_policy", "assumption_amm_reserve_sync"],
        nextAction: "Generate swap fee, protocol fee, and reserve-delta invariants."
      }
    ];
  }

  if (normalizedTitle.includes("valid origin evidence")) {
    return [
      {
        ...base,
        id: "property_bridge_message_validity",
        text: "Every relayed or finalized message should match an authorized commitment over source chain, destination chain, sender, receiver, nonce, and payload before any state change or asset release.",
        status: "Draft",
        risk: claim.severity,
        assumptions: ["assumption_bridge_relayer_trust", "assumption_bridge_domain_separation"],
        nextAction: "Generate valid/invalid proof, chain-domain, sender, nonce, and payload scenarios."
      }
    ];
  }

  if (normalizedTitle.includes("cannot be replayed")) {
    return [
      {
        ...base,
        id: "property_bridge_replay_protection",
        text: "Once a message commitment has been successfully processed, every later attempt to process the same domain-separated commitment should revert without additional state change or asset release.",
        status: "Draft",
        risk: claim.severity,
        assumptions: ["assumption_bridge_domain_separation"],
        nextAction: "Generate duplicate relay, duplicate finalization, and cross-domain replay scenarios."
      }
    ];
  }

  if (normalizedTitle.includes("respects finality")) {
    return [
      {
        ...base,
        id: "property_bridge_finality",
        text: "A message should remain non-finalizable until its documented source-chain confirmation, proof, or challenge condition is satisfied, and failed finalization attempts should not consume the message.",
        status: "Draft",
        risk: claim.severity,
        assumptions: ["assumption_bridge_finality", "assumption_bridge_relayer_trust"],
        nextAction: "Generate pre-finality, post-finality, reorg, and challenge-window scenarios."
      }
    ];
  }

  return [
    {
      ...base,
      id: `property_${claim.id.replace(/^claim_/, "")}`,
      text: claim.text,
      status: "Draft",
      risk: claim.severity,
      assumptions: map.tokenDependencies.length > 0 ? ["assumption_standard_erc20"] : [],
      nextAction: "Review and strengthen this property before generating a test harness."
    }
  ];
}

function resolveFunctionNames(map: ProtocolMap, candidates: string[]) {
  const allFunctions = [...map.userFlows, ...map.privilegedFunctions, ...map.contracts.flatMap((contract) => contract.functions)];
  const names = new Set(allFunctions.map((fn) => fn.name));
  return candidates.filter((candidate) => names.has(candidate));
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function hasAnyFunction(functions: ProtocolFunction[], names: string[]) {
  const normalizedNames = names.map((name) => name.toLowerCase());
  return functions.some((fn) => normalizedNames.some((name) => fn.name.toLowerCase().includes(name)));
}

function isErc4626Like(map: ProtocolMap) {
  return (
    map.contracts.some((contract) => contract.inherits.some((item) => item.includes("ERC4626"))) ||
    hasAnyFunction(map.userFlows, ["deposit", "mint", "withdraw", "redeem"])
  );
}

function mentionsAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term.toLowerCase()));
}

function strongerStatus(current: SkepticStatus, next: SkepticStatus): SkepticStatus {
  const rank: Record<SkepticStatus, number> = {
    Acceptable: 0,
    "Needs human review": 1,
    Weak: 2,
    "Needs stronger actor model": 3,
    "Needs adversarial mock": 4,
    Vacuous: 5
  };

  return rank[next] > rank[current] ? next : current;
}

function requiredText(value: unknown, path: string, issues: string[]) {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  issues.push(`${path} must be a non-empty string.`);
  return undefined;
}

function stringList(value: unknown, path: string, issues: string[], fallback: string[] = []) {
  if (value === undefined) {
    return fallback;
  }

  if (Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim().length > 0)) {
    return value.map((item) => item.trim());
  }

  issues.push(`${path} must be a string array.`);
  return [];
}

function severityFromValue(value: unknown, path: string, issues: string[]): Severity | undefined {
  if (value === "low" || value === "medium" || value === "high" || value === "critical") {
    return value;
  }

  issues.push(`${path} must be low, medium, high, or critical.`);
  return undefined;
}

function confidenceFromValue(value: unknown, path: string, issues: string[]) {
  if (typeof value === "number" && value >= 0 && value <= 1) {
    return value;
  }

  issues.push(`${path} must be a number between 0 and 1.`);
  return undefined;
}

function slug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 72);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
