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
  if (map.tokenDependencies.length === 0) {
    return [];
  }

  return [
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
    }
  ];
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
