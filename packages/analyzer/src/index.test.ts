import { describe, expect, it } from "vitest";
import { analyzeSoliditySource } from "./index";

const source = {
  id: "source_example",
  path: "src/ExampleVault.sol",
  language: "solidity" as const,
  content: `contract ExampleVault is ERC4626, Ownable {
    bool public paused;
    address public feeRecipient;
    event FeeRecipientUpdated(address indexed recipient);

    function deposit(uint256 assets, address receiver) public override returns (uint256 shares) {
      require(!paused, "paused");
      shares = super.deposit(assets, receiver);
    }

    function withdraw(uint256 assets, address receiver, address owner) external override returns (uint256 shares) {
      shares = super.withdraw(assets, receiver, owner);
    }

    function pause() external onlyOwner {
      paused = true;
    }

    function setFeeRecipient(address nextRecipient) external onlyOwner {
      feeRecipient = nextRecipient;
    }
  }`
};

describe("analyzeSoliditySource", () => {
  it("extracts ERC4626 contract structure and flows", () => {
    const map = analyzeSoliditySource(source);

    expect(map.contracts[0]?.name).toBe("ExampleVault");
    expect(map.contracts[0]?.inherits).toEqual(["ERC4626", "Ownable"]);
    expect(map.userFlows.map((fn) => fn.name)).toEqual(["deposit", "withdraw"]);
    expect(map.privilegedFunctions.map((fn) => fn.name)).toEqual(["pause", "setFeeRecipient"]);
    expect(map.criticalState.map((state) => state.name)).toEqual(["paused", "feeRecipient"]);
    expect(map.externalCalls.map((call) => call.expression)).toContain("super.deposit(assets, receiver)");
    expect(map.tokenDependencies[0]?.name).toBe("underlyingToken");
  });

  it("surfaces parser limitations for empty input", () => {
    const map = analyzeSoliditySource({
      ...source,
      content: ""
    });

    expect(map.contracts).toEqual([]);
    expect(map.parserWarnings).toContain("No contracts were detected in the supplied Solidity source.");
  });

  it("reports unsupported sources instead of analyzing them as Solidity", () => {
    const map = analyzeSoliditySource({
      ...source,
      language: "markdown"
    });

    expect(map.contracts).toEqual([]);
    expect(map.parserWarnings).toEqual(["Unsupported source language: markdown."]);
  });

  it("warns when an incomplete contract body cannot be closed", () => {
    const map = analyzeSoliditySource({
      ...source,
      content: "contract BrokenVault is ERC4626 { function deposit(uint256 assets, address receiver) public {"
    });

    expect(map.contracts).toEqual([]);
    expect(map.parserWarnings).toContain("Could not find closing brace for contract BrokenVault.");
  });

  it("maps fee and strategy vault controls as privileged fixture flows", () => {
    const map = analyzeSoliditySource({
      ...source,
      path: "src/FeeStrategyVault.sol",
      content: `contract FeeStrategyVault is ERC4626, Ownable {
        uint256 public withdrawalFeeBps;
        address public strategy;

        function deposit(uint256 assets, address receiver) public returns (uint256 shares) {}
        function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares) {}
        function setWithdrawalFeeBps(uint256 nextFeeBps) external onlyOwner { withdrawalFeeBps = nextFeeBps; }
        function setStrategy(address nextStrategy) external onlyOwner { strategy = nextStrategy; }
      }`
    });

    expect(map.criticalState.map((state) => state.name)).toEqual(["withdrawalFeeBps", "strategy"]);
    expect(map.privilegedFunctions.map((fn) => fn.name)).toEqual(["setWithdrawalFeeBps", "setStrategy"]);
    expect(map.roles[0]?.privilegedFunctions).toHaveLength(2);
  });

  it("keeps donation-sensitive token calls visible in a vault fixture", () => {
    const map = analyzeSoliditySource({
      ...source,
      path: "src/DonationVault.sol",
      content: `contract DonationVault is ERC4626 {
        IERC20 public assetToken;

        function deposit(uint256 assets, address receiver) public returns (uint256 shares) {}
        function mint(uint256 shares, address receiver) public returns (uint256 assets) {}
        function donate(uint256 assets) external {
          assetToken.transferFrom(msg.sender, address(this), assets);
        }
      }`
    });

    expect(map.contracts[0]?.functions.map((fn) => fn.name)).toContain("donate");
    expect(map.userFlows.map((fn) => fn.name)).toEqual(["deposit", "mint"]);
    expect(map.externalCalls.map((call) => call.expression)).toContain("assetToken.transferFrom(msg.sender, address(this), assets)");
    expect(map.tokenDependencies[0]?.assumptions).toContain("no fee-on-transfer behavior");
  });

  it("recognizes vault-like source shapes without ERC4626 inheritance", () => {
    const map = analyzeSoliditySource({
      ...source,
      path: "src/AdapterVault.sol",
      content: `contract AdapterVault {
        IERC20 public underlying;

        function deposit(uint256 assets, address receiver) external returns (uint256 shares) {}
        function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {}
      }`
    });

    expect(map.contracts[0]?.inherits).toEqual([]);
    expect(map.userFlows.map((fn) => fn.name)).toEqual(["deposit", "redeem"]);
    expect(map.tokenDependencies[0]?.source).toBe("ERC20 reference");
  });
});
