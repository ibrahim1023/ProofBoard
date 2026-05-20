import { describe, expect, it } from "vitest";
import { analyzeSoliditySource } from "@proofboard/analyzer";
import {
  generatePropertiesFromClaims,
  applySkepticReview,
  linkAssumptionsToProperties,
  suggestClaimsFromProtocolMap,
  suggestTokenAssumptions
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
});
