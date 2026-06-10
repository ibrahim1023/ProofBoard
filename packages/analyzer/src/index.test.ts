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

  it("normalizes inheritance constructor arguments without splitting nested commas", () => {
    const map = analyzeSoliditySource({
      ...source,
      path: "src/ConfiguredVault.sol",
      content: `contract ConfiguredVault is ERC4626(IERC20(asset_)), Ownable(initialOwner) {
        function deposit(uint256 assets, address receiver) external returns (uint256 shares) {}
      }`
    });

    expect(map.contracts[0]?.inherits).toEqual(["ERC4626", "Ownable"]);
    expect(map.roles[0]?.name).toBe("owner");
    expect(map.tokenDependencies[0]?.source).toBe("ERC4626 inheritance");
  });

  it("extracts immutable token state and vault flow naming variations", () => {
    const map = analyzeSoliditySource({
      ...source,
      path: "src/NamedFlowVault.sol",
      content: `contract NamedFlowVault {
        IERC20 public immutable assetToken;
        uint256 public constant MAX_FEE_BPS = 1000;

        function depositAssets(uint256 assets, address receiver) external returns (uint256 shares) {
          assetToken.safeTransferFrom(msg.sender, address(this), assets);
        }

        function withdrawAssets(uint256 assets, address receiver) external returns (uint256 shares) {
          assetToken.safeTransfer(receiver, assets);
        }
      }`
    });

    expect(map.criticalState.map((state) => state.name)).toEqual(["assetToken", "MAX_FEE_BPS"]);
    expect(map.userFlows.map((fn) => fn.name)).toEqual(["depositAssets", "withdrawAssets"]);
    expect(map.assetFlows.map((flow) => flow.kind)).toEqual(["deposit", "withdraw"]);
    expect(map.externalCalls.map((call) => call.expression)).toEqual(
      expect.arrayContaining([
        "assetToken.safeTransferFrom(msg.sender, address(this), assets)",
        "assetToken.safeTransfer(receiver, assets)"
      ])
    );
  });

  it("warns when unsupported Solidity constructs require manual review", () => {
    const map = analyzeSoliditySource({
      ...source,
      path: "src/UnsupportedShapes.sol",
      content: `interface IStrategy {
        function totalAssets() external view returns (uint256);
      }

      library VaultMath {
        function scale(uint256 value) internal pure returns (uint256) { return value; }
      }

      contract UnsupportedShapes is ERC4626 {
        function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
          assembly { shares := assets }
        }

        function execute(address target, bytes calldata payload) external {
          target.delegatecall(payload);
        }
      }`
    });

    expect(map.contracts.map((contract) => contract.name)).toEqual(["UnsupportedShapes"]);
    expect(map.parserWarnings).toEqual(
      expect.arrayContaining([
        "Interfaces are not analyzed as protocol contracts by the current static parser.",
        "Libraries are not analyzed as protocol contracts by the current static parser.",
        "Inline assembly is not interpreted by the current static parser.",
        "Low-level call targets and calldata are not fully resolved by the current static parser."
      ])
    );
  });

  it("maps staking principal and reward flows", () => {
    const map = analyzeSoliditySource({
      ...source,
      path: "src/StakingVault.sol",
      content: `contract StakingVault {
        IERC20 public stakingToken;
        IERC20 public rewardToken;
        uint256 public rewardRate;

        function stake(uint256 assets) external {}
        function unstake(uint256 assets) external {}
        function claimRewards() external {}
        function setRewardRate(uint256 nextRate) external onlyOwner {}
      }`
    });

    expect(map.userFlows.map((fn) => fn.name)).toEqual(["stake", "unstake", "claimRewards"]);
    expect(map.assetFlows.map((flow) => flow.kind)).toEqual(["stake", "unstake", "claim_rewards", "privileged"]);
    expect(map.privilegedFunctions.map((fn) => fn.name)).toEqual(["setRewardRate"]);
  });

  it("maps lending collateral, debt, repayment, and liquidation flows", () => {
    const map = analyzeSoliditySource({
      ...source,
      path: "src/LendingMarket.sol",
      content: `contract LendingMarket {
        IERC20 public collateralToken;
        IERC20 public debtToken;
        address public priceOracle;

        function supplyCollateral(uint256 assets) external {}
        function borrow(uint256 assets) external {}
        function repay(uint256 assets) external {}
        function liquidate(address borrower, uint256 repayAssets) external {}
      }`
    });

    expect(map.userFlows.map((fn) => fn.name)).toEqual(["supplyCollateral", "borrow", "repay", "liquidate"]);
    expect(map.assetFlows.map((flow) => flow.kind)).toEqual(["supply", "borrow", "repay", "liquidate"]);
    expect(map.criticalState.map((state) => state.name)).toEqual(["collateralToken", "debtToken", "priceOracle"]);
  });

  it("maps AMM liquidity and swap flows", () => {
    const map = analyzeSoliditySource({
      ...source,
      path: "src/AmmPool.sol",
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

    expect(map.userFlows.map((fn) => fn.name)).toEqual(["addLiquidity", "removeLiquidity", "swap"]);
    expect(map.assetFlows.map((flow) => flow.kind)).toEqual(["add_liquidity", "remove_liquidity", "swap"]);
    expect(map.criticalState.map((state) => state.name)).toEqual(["token0", "token1", "reserve0", "reserve1", "feeBps"]);
  });
});
