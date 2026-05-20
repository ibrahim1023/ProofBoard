import { describe, expect, it } from "vitest";
import { analyzeSoliditySource } from "@proofboard/analyzer";
import {
  generatePropertiesFromClaims,
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
  });

  it("suggests token assumptions for vault maps", () => {
    const assumptions = suggestTokenAssumptions(protocolMap);

    expect(assumptions.map((assumption) => assumption.id)).toEqual([
      "assumption_standard_erc20",
      "assumption_no_fee_on_transfer",
      "assumption_no_rebase"
    ]);
  });
});
