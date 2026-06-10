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

  it("generates staking principal and reward assurance coverage", () => {
    const stakingMap = analyzeSoliditySource({
      id: "source_staking",
      path: "src/StakingVault.sol",
      language: "solidity",
      content: `contract StakingVault {
        IERC20 public stakingToken;
        IERC20 public rewardToken;
        function stake(uint256 assets) external {}
        function unstake(uint256 assets) external {}
        function claimRewards() external {}
      }`
    });
    const claims = suggestClaimsFromProtocolMap(stakingMap);
    const approved = claims.map((claim) => ({ ...claim, status: "Human-approved" as const }));
    const properties = generatePropertiesFromClaims(approved, stakingMap);
    const assumptionIds = suggestTokenAssumptions(stakingMap).map((assumption) => assumption.id);

    expect(claims.map((claim) => claim.id)).toEqual(
      expect.arrayContaining(["claim_staking_principal_accounting", "claim_staking_rewards_conserved"])
    );
    expect(properties.map((property) => property.id)).toEqual(
      expect.arrayContaining(["property_staking_principal_conservation", "property_staking_reward_conservation"])
    );
    expect(assumptionIds).toEqual(expect.arrayContaining(["assumption_unstaking_liquidity", "assumption_rewards_funded"]));
  });

  it("generates lending collateral, liquidation, and bad-debt coverage", () => {
    const lendingMap = analyzeSoliditySource({
      id: "source_lending",
      path: "src/LendingMarket.sol",
      language: "solidity",
      content: `contract LendingMarket {
        IERC20 public collateralToken;
        IERC20 public debtToken;
        function supplyCollateral(uint256 assets) external {}
        function borrow(uint256 assets) external {}
        function repay(uint256 assets) external {}
        function liquidate(address borrower, uint256 assets) external {}
      }`
    });
    const claims = suggestClaimsFromProtocolMap(lendingMap);
    const properties = generatePropertiesFromClaims(
      claims.map((claim) => ({ ...claim, status: "Human-approved" as const })),
      lendingMap
    );
    const assumptionIds = suggestTokenAssumptions(lendingMap).map((assumption) => assumption.id);

    expect(claims.map((claim) => claim.id)).toEqual(
      expect.arrayContaining([
        "claim_lending_collateralization",
        "claim_lending_liquidation_bounds",
        "claim_lending_debt_conservation"
      ])
    );
    expect(properties.map((property) => property.id)).toEqual(
      expect.arrayContaining([
        "property_lending_collateralization",
        "property_lending_liquidation_bounds",
        "property_lending_debt_conservation"
      ])
    );
    expect(assumptionIds).toEqual(
      expect.arrayContaining(["assumption_oracle_fresh", "assumption_liquidation_execution", "assumption_bad_debt_policy"])
    );
  });

  it("generates AMM reserve, LP share, and fee coverage", () => {
    const ammMap = analyzeSoliditySource({
      id: "source_amm",
      path: "src/AmmPool.sol",
      language: "solidity",
      content: `contract AmmPool {
        IERC20 public token0;
        IERC20 public token1;
        uint256 public reserve0;
        uint256 public reserve1;
        uint256 public feeBps;
        function addLiquidity(uint256 amount0, uint256 amount1) external {}
        function removeLiquidity(uint256 shares) external {}
        function swap(uint256 amountIn, address tokenIn) external {}
      }`
    });
    const claims = suggestClaimsFromProtocolMap(ammMap);
    const properties = generatePropertiesFromClaims(
      claims.map((claim) => ({ ...claim, status: "Human-approved" as const })),
      ammMap
    );
    const assumptionIds = suggestTokenAssumptions(ammMap).map((assumption) => assumption.id);

    expect(claims.map((claim) => claim.id)).toEqual(
      expect.arrayContaining(["claim_amm_reserve_consistency", "claim_amm_lp_share_accounting", "claim_amm_fee_accounting"])
    );
    expect(properties.map((property) => property.id)).toEqual(
      expect.arrayContaining(["property_amm_reserve_consistency", "property_amm_lp_share_accounting", "property_amm_fee_accounting"])
    );
    expect(assumptionIds).toEqual(expect.arrayContaining(["assumption_amm_reserve_sync", "assumption_amm_fee_policy"]));
  });

  it("generates bridge message, replay, relayer, and finality coverage", () => {
    const bridgeMap = analyzeSoliditySource({
      id: "source_bridge",
      path: "src/TokenBridge.sol",
      language: "solidity",
      content: `contract TokenBridge {
        mapping(bytes32 => bool) public processedMessages;
        uint256 public finalityDelay;
        function sendMessage(uint256 destinationChainId, bytes calldata payload) external {}
        function relayMessage(bytes32 messageId, bytes calldata payload) external {}
        function finalizeMessage(bytes32 messageId) external {}
      }`
    });
    const claims = suggestClaimsFromProtocolMap(bridgeMap);
    const properties = generatePropertiesFromClaims(
      claims.map((claim) => ({ ...claim, status: "Human-approved" as const })),
      bridgeMap
    );
    const assumptionIds = suggestTokenAssumptions(bridgeMap).map((assumption) => assumption.id);

    expect(claims.map((claim) => claim.id)).toEqual(
      expect.arrayContaining(["claim_bridge_message_validity", "claim_bridge_replay_protection", "claim_bridge_finality"])
    );
    expect(properties.map((property) => property.id)).toEqual(
      expect.arrayContaining(["property_bridge_message_validity", "property_bridge_replay_protection", "property_bridge_finality"])
    );
    expect(assumptionIds).toEqual(
      expect.arrayContaining([
        "assumption_bridge_relayer_trust",
        "assumption_bridge_finality",
        "assumption_bridge_domain_separation"
      ])
    );
  });

  it("generates governance lifecycle, upgrade, storage-layout, and emergency coverage", () => {
    const governanceMap = analyzeSoliditySource({
      id: "source_governance",
      path: "src/GovernorProxy.sol",
      language: "solidity",
      content: `contract GovernorProxy {
        address public implementation;
        uint256 public timelockDelay;
        function propose(bytes calldata actions) external {}
        function castVote(uint256 proposalId, uint8 support) external {}
        function queue(uint256 proposalId) external {}
        function execute(uint256 proposalId) external {}
        function upgradeTo(address nextImplementation) external onlyAdmin {}
        function emergencyPause() external onlyAdmin {}
      }`
    });
    const claims = suggestClaimsFromProtocolMap(governanceMap);
    const properties = generatePropertiesFromClaims(
      claims.map((claim) => ({ ...claim, status: "Human-approved" as const })),
      governanceMap
    );
    const assumptionIds = suggestTokenAssumptions(governanceMap).map((assumption) => assumption.id);

    expect(claims.map((claim) => claim.id)).toEqual(
      expect.arrayContaining([
        "claim_governance_lifecycle",
        "claim_upgrade_authorization",
        "claim_governance_emergency_controls"
      ])
    );
    expect(properties.map((property) => property.id)).toEqual(
      expect.arrayContaining([
        "property_governance_lifecycle",
        "property_upgrade_authorization",
        "property_governance_emergency_scope"
      ])
    );
    expect(assumptionIds).toEqual(
      expect.arrayContaining([
        "assumption_governance_timelock",
        "assumption_upgrade_storage_layout",
        "assumption_governance_emergency_scope"
      ])
    );
  });
});
