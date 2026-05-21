import { describe, expect, it } from "vitest";
import { analyzeSoliditySource } from "@proofboard/analyzer";
import {
  generatePropertiesFromClaims,
  applySkepticReview,
  claimSuggestionBoundaries,
  linkAssumptionsToProperties,
  suggestClaimsFromProtocolMap,
  suggestTokenAssumptions,
  validateLlmClaimEnvelope
} from "./index";

const protocolMap = analyzeSoliditySource({
  id: "source_1",
  path: "src/ExampleVault.sol",
  language: "solidity",
  content: `contract ExampleVault is ERC4626, Ownable {
    function deposit(uint256 assets, address receiver) public returns (uint256 shares) {}
    function withdraw(uint256 assets, address receiver, address owner) public returns (uint256 shares) {}
    function pause() external onlyOwner {}
  }`
});

describe("property engine", () => {
  it("suggests ERC4626 claims without approving them", () => {
    const claims = suggestClaimsFromProtocolMap(protocolMap);

    expect(claims.map((claim) => claim.id)).toContain("claim_deposit_shares");
    expect(claims.map((claim) => claim.id)).toContain("claim_withdraw_ownership");
    expect(claims.every((claim) => claim.status === "AI-inferred")).toBe(true);
  });

  it("generates properties only from approved or edited claims", () => {
    const claims = suggestClaimsFromProtocolMap(protocolMap).map((claim) =>
      claim.id === "claim_withdraw_ownership" ? { ...claim, status: "Human-approved" as const } : claim
    );

    const properties = generatePropertiesFromClaims(claims, protocolMap);

    expect(properties).toHaveLength(1);
    expect(properties[0]?.id).toBe("property_redeemable_assets");
    expect(properties[0]?.status).toBe("Draft");
    expect(properties[0]?.skepticStatus).toBe("Needs adversarial mock");
    expect(properties[0]?.skepticFindings.length).toBeGreaterThan(0);
  });

  it("suggests token assumptions for vault maps", () => {
    const assumptions = suggestTokenAssumptions(protocolMap);

    expect(assumptions.map((assumption) => assumption.id)).toContain("assumption_standard_erc20");
    expect(assumptions.map((assumption) => assumption.id)).toContain("assumption_no_fee_on_transfer");
    expect(assumptions.map((assumption) => assumption.id)).toContain("assumption_no_reentrant_token");
    expect(assumptions.map((assumption) => assumption.id)).toContain("assumption_admin_policy");
  });

  it("flags vague properties as weak or vacuous", () => {
    const reviewed = applySkepticReview(
      {
        id: "property_vague",
        claimId: "claim_vague",
        text: "Things should be consistent.",
        status: "Draft",
        skepticStatus: "Needs human review",
        skepticFindings: [],
        verificationLevel: "human_approved",
        risk: "medium",
        assumptions: [],
        evidence: [],
        nextAction: "Review property."
      },
      protocolMap
    );

    expect(["Weak", "Vacuous"]).toContain(reviewed.skepticStatus);
  });

  it("links assumptions to generated properties", () => {
    const claims = suggestClaimsFromProtocolMap(protocolMap).map((claim) =>
      claim.id === "claim_deposit_shares" ? { ...claim, status: "Human-approved" as const } : claim
    );
    const properties = generatePropertiesFromClaims(claims, protocolMap);
    const assumptions = linkAssumptionsToProperties(suggestTokenAssumptions(protocolMap), properties);

    expect(assumptions.find((assumption) => assumption.id === "assumption_no_fee_on_transfer")?.relatedProperties).toContain(
      "property_deposit_mint_consistency"
    );
  });

  it("keeps template, local, and hosted claim boundaries explicit", () => {
    expect(claimSuggestionBoundaries.map((boundary) => boundary.mode)).toEqual(["template", "local_llm", "hosted_llm"]);
    expect(claimSuggestionBoundaries.find((boundary) => boundary.mode === "hosted_llm")?.needsApiKey).toBe(true);
  });

  it("validates LLM claims into human-review suggestions only", () => {
    const validated = validateLlmClaimEnvelope(
      {
        status: "proposed",
        claims: [
          {
            title: "Donation ordering matters",
            text: "Donation ordering should not unfairly dilute the next depositor.",
            source: ["deposit flow", "token dependency"],
            confidence: 0.71,
            severity: "critical",
            relatedFunctions: ["deposit"]
          }
        ]
      },
      protocolMap
    );

    expect(validated.issues).toEqual([]);
    expect(validated.claims[0]).toMatchObject({ id: "claim_llm_donation_ordering_matters", status: "AI-inferred" });
  });

  it("supports insufficient-evidence refusals and rejects invalid payloads", () => {
    expect(validateLlmClaimEnvelope({ status: "insufficient_evidence", reason: "No source evidence." }, protocolMap).refusal).toBe(
      "No source evidence."
    );
    expect(validateLlmClaimEnvelope({ status: "proposed", claims: [{ title: "Missing fields" }] }, protocolMap).issues.length).toBeGreaterThan(0);
  });

  it("keeps strategy fixtures tied to admin and liquidity assumptions", () => {
    const strategyMap = analyzeSoliditySource({
      id: "source_strategy",
      path: "src/StrategyVault.sol",
      language: "solidity",
      content: `contract StrategyVault is ERC4626, Ownable {
        function deposit(uint256 assets, address receiver) public returns (uint256 shares) {}
        function redeem(uint256 shares, address receiver, address owner) public returns (uint256 assets) {}
        function setStrategy(address nextStrategy) external onlyOwner {}
      }`
    });
    const assumptionIds = suggestTokenAssumptions(strategyMap).map((assumption) => assumption.id);

    expect(assumptionIds).toContain("assumption_admin_policy");
    expect(assumptionIds).toContain("assumption_strategy_returns_funds");
  });

  it("keeps donation and vault-like fixtures on ERC4626 claim templates", () => {
    const vaultLikeMap = analyzeSoliditySource({
      id: "source_vault_like",
      path: "src/VaultLikeAdapter.sol",
      language: "solidity",
      content: `contract VaultLikeAdapter {
        IERC20 public assetToken;

        function deposit(uint256 assets, address receiver) external returns (uint256 shares) {}
        function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares) {}
        function donate(uint256 assets) external { assetToken.transferFrom(msg.sender, address(this), assets); }
      }`
    });
    const claimIds = suggestClaimsFromProtocolMap(vaultLikeMap).map((claim) => claim.id);

    expect(claimIds).toContain("claim_exchange_rate_consistency");
    expect(claimIds).toContain("claim_donation_inflation_resistance");
  });
});
