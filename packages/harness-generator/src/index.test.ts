import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Workspace } from "@proofboard/shared-types";
import { generateFoundryHarnessBundle } from "./index";

const workspace = {
  id: "workspace_test",
  name: "Test Vault",
  protocolType: "erc4626_vault",
  description: "A test vault.",
  sources: [],
  protocolMap: {
    contracts: [
      {
        id: "contract_vault",
        name: "TestVault",
        path: "src/TestVault.sol",
        inherits: [],
        functions: [],
        stateVariables: [],
        events: [],
        modifiers: [],
        externalCalls: []
      }
    ],
    roles: [],
    criticalState: [],
    assetFlows: [],
    externalCalls: [],
    privilegedFunctions: [],
    userFlows: [],
    tokenDependencies: [],
    parserWarnings: []
  },
  claims: [],
  properties: [
    {
      id: "property_share_accounting",
      claimId: "claim_share_accounting",
      text: "Share accounting should preserve user ownership through deposits and withdrawals.",
      status: "Generated",
      skepticStatus: "Acceptable",
      skepticFindings: [],
      verificationLevel: "test_generated",
      risk: "critical",
      assumptions: [],
      evidence: [],
      nextAction: "Run harness."
    }
  ],
  assumptions: [],
  verificationRuns: [],
  evidence: []
} satisfies Workspace;

describe("generateFoundryHarnessBundle", () => {
  it("organizes Foundry invariant scaffold files under test/invariants", () => {
    const bundle = generateFoundryHarnessBundle(workspace);

    expect(bundle.suggestedCommand).toBe("forge test --match-contract ProofboardVaultInvariant");
    expect(bundle.files.map((file) => file.path)).toEqual([
      "test/invariants/ProofboardVaultInvariant.t.sol",
      "test/invariants/handlers/VaultHandler.sol",
      "test/invariants/actors/VaultActors.sol",
      "test/invariants/mocks/MockERC20.sol",
      "test/invariants/mocks/FeeOnTransferToken.sol",
      "test/invariants/mocks/RebasingToken.sol",
      "test/invariants/README.md",
      "verification/smtchecker.json",
      "verification/scribble/ANNOTATIONS.md",
      "verification/certora/Proofboard.conf",
      "verification/certora/Proofboard.spec",
      "verification/echidna/echidna.yaml",
      "verification/echidna/PROPERTIES.md",
      "verification/halmos/CHECKS.md"
    ]);
  });

  it("keeps generated code traceable to selected properties", () => {
    const bundle = generateFoundryHarnessBundle(workspace);
    const invariant = bundle.files.find((file) => file.path.endsWith("ProofboardVaultInvariant.t.sol"));

    expect(invariant?.propertyIds).toContain("property_share_accounting");
    expect(invariant?.content).toContain("ProofBoard property: property_share_accounting");
    expect(invariant?.content).toContain("not proof of safety");
  });

  it("generates a Solidity SMTChecker standard JSON input for the target source", () => {
    const bundle = generateFoundryHarnessBundle(workspace);
    const generated = bundle.files.find((file) => file.path === "verification/smtchecker.json");
    const input = JSON.parse(generated?.content ?? "{}");

    expect(generated?.propertyIds).toEqual(["property_share_accounting"]);
    expect(input.sources["src/TestVault.sol"].urls).toEqual(["src/TestVault.sol"]);
    expect(input.settings.modelChecker).toMatchObject({
      engine: "chc",
      invariants: ["contract", "reentrancy"],
      showUnproved: true
    });
    expect(input.settings.modelChecker.targets).toContain("assert");
  });

  it("generates reviewed Scribble annotation templates without executable placeholders", () => {
    const bundle = generateFoundryHarnessBundle(workspace);
    const generated = bundle.files.find((file) => file.path === "verification/scribble/ANNOTATIONS.md");

    expect(generated?.propertyIds).toEqual(["property_share_accounting"]);
    expect(generated?.content).toContain("Target contract: `TestVault`");
    expect(generated?.content).toContain("Target source: `src/TestVault.sol`");
    expect(generated?.content).toContain('/// #invariant {:msg "ProofBoard property_share_accounting"} <BOOLEAN_EXPRESSION>;');
    expect(generated?.content).toContain("not verification evidence");
    expect(generated?.content).not.toContain('"} true;');
  });

  it("generates an inactive Certora configuration and property-linked CVL worksheet", () => {
    const bundle = generateFoundryHarnessBundle(workspace);
    const configuration = bundle.files.find((file) => file.path === "verification/certora/Proofboard.conf");
    const specification = bundle.files.find((file) => file.path === "verification/certora/Proofboard.spec");
    const config = JSON.parse(configuration?.content ?? "{}");

    expect(config.files).toEqual(["src/TestVault.sol"]);
    expect(config.verify).toBe("TestVault:verification/certora/Proofboard.spec");
    expect(specification?.propertyIds).toEqual(["property_share_accounting"]);
    expect(specification?.content).toContain("rule pb_property_share_accounting");
    expect(specification?.content).toContain("assert <BOOLEAN_EXPRESSION>");
    expect(specification?.content).toContain("contains no active rules");
    expect(specification?.content).not.toContain("assert true");
  });

  it("generates an Echidna property-mode configuration and inactive property worksheet", () => {
    const bundle = generateFoundryHarnessBundle(workspace);
    const configuration = bundle.files.find((file) => file.path === "verification/echidna/echidna.yaml");
    const properties = bundle.files.find((file) => file.path === "verification/echidna/PROPERTIES.md");

    expect(configuration?.content).toContain("testMode: property");
    expect(configuration?.content).toContain("corpusDir: corpus-echidna");
    expect(properties?.propertyIds).toEqual(["property_share_accounting"]);
    expect(properties?.content).toContain("function echidna_pb_property_share_accounting()");
    expect(properties?.content).toContain("return <BOOLEAN_EXPRESSION>;");
    expect(properties?.content).toContain("not fuzzing evidence");
    expect(properties?.content).not.toContain("return true;");
  });

  it("generates an inactive Halmos symbolic-test worksheet with property traceability", () => {
    const bundle = generateFoundryHarnessBundle(workspace);
    const checks = bundle.files.find((file) => file.path === "verification/halmos/CHECKS.md");

    expect(checks?.propertyIds).toEqual(["property_share_accounting"]);
    expect(checks?.content).toContain("function check_pb_property_share_accounting(<SYMBOLIC_PARAMETERS>)");
    expect(checks?.content).toContain("vm.assume(<VALID_INPUT_CONDITIONS>)");
    expect(checks?.content).toContain("assert(<BOOLEAN_EXPRESSION>);");
    expect(checks?.content).toContain("not symbolic-execution evidence");
    expect(checks?.content).not.toContain("assert(true)");
  });

  it.runIf(forgeAvailable())("compiles generated scaffold contracts in a Foundry fixture", () => {
    const root = mkdtempSync(join(tmpdir(), "proofboard-harness-"));
    const compileWorkspace = {
      ...workspace,
      protocolMap: {
        ...workspace.protocolMap,
        contracts: [{ ...workspace.protocolMap.contracts[0]!, name: "FixtureVault", path: "src/FixtureVault.sol" }]
      }
    } satisfies Workspace;

    try {
      writeFoundryFixture(root);

      generateFoundryHarnessBundle(compileWorkspace).files.forEach((file) => write(root, file.path, file.content));

      const output = execFileSync("forge", ["build"], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"]
      });

      expect(output).toContain("Compiling");
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it.runIf(forgeAvailable())("executes handler actions and protocol-specific assertions against a target vault fixture", () => {
    const root = mkdtempSync(join(tmpdir(), "proofboard-wired-harness-"));
    const wiredWorkspace = {
      ...workspace,
      protocolMap: {
        ...workspace.protocolMap,
        contracts: [{ ...workspace.protocolMap.contracts[0]!, name: "FixtureVault", path: "src/FixtureVault.sol" }]
      }
    } satisfies Workspace;

    try {
      writeFoundryFixture(root);

      const wiredFiles = generateFoundryHarnessBundle(wiredWorkspace).files.map((file) => ({
        ...file,
        content: wireFixtureVault(file.path, file.content)
      }));
      wiredFiles.forEach((file) => {
        write(root, file.path, file.content);
      });

      expect(wiredFiles.find((file) => file.path.endsWith("ProofboardVaultInvariant.t.sol"))?.content).toContain(
        "handler.deposit(100 ether, 0);"
      );
      expect(wiredFiles.find((file) => file.path.endsWith("VaultHandler.sol"))?.content).toContain(
        "FixtureVault(vault).deposit(assets, address(this));"
      );
      expect(wiredFiles.find((file) => file.path.endsWith("VaultHandler.sol"))?.content).toContain(
        "target.totalAssets() >= target.totalSupply()"
      );

      const output = execFileSync("forge", ["test", "--offline", "--match-contract", "ProofboardVaultInvariant"], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"]
      });

      expect(output).toContain("invariant_shareAccounting");
      expect(output).toContain("Suite result: ok");
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it.runIf(forgeAvailable())("exercises generated fee-on-transfer and rebasing token semantics", () => {
    const root = mkdtempSync(join(tmpdir(), "proofboard-adversarial-tokens-"));

    try {
      writeFoundryFixture(root);

      generateFoundryHarnessBundle(workspace)
        .files.filter((file) => file.path.includes("/mocks/"))
        .forEach((file) => write(root, file.path, file.content));
      write(root, "test/AdversarialTokenFixture.t.sol", adversarialTokenFixture());

      const output = execFileSync("forge", ["test", "--offline", "--match-contract", "AdversarialTokenFixture"], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"]
      });

      expect(output).toContain("testFeeOnTransferAccruesConfiguredFee");
      expect(output).toContain("testNaiveVaultAccountingExposesTransferFee");
      expect(output).toContain("testRebaseChangesBalanceAndSupply");
      expect(output).toContain("Suite result: ok");
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it.runIf(forgeAvailable())("exercises strategy accounting and donation-driven inflation sensitivity", () => {
    const root = mkdtempSync(join(tmpdir(), "proofboard-strategy-inflation-"));

    try {
      writeFoundryFixture(root);

      generateFoundryHarnessBundle(workspace)
        .files.filter((file) => file.path.endsWith("/MockERC20.sol"))
        .forEach((file) => write(root, file.path, file.content));
      write(root, "test/StrategyAndInflationFixture.t.sol", strategyAndInflationFixture());

      const output = execFileSync("forge", ["test", "--offline", "--match-contract", "StrategyAndInflationFixture"], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"]
      });

      expect(output).toContain("testStrategyGainAndLossChangeManagedAssets");
      expect(output).toContain("testDonationCanRoundVictimDepositToZeroShares");
      expect(output).toContain("Suite result: ok");
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });
});

function forgeAvailable() {
  try {
    execFileSync("forge", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function write(root: string, path: string, content: string) {
  const file = join(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function writeFoundryFixture(root: string) {
  write(root, "foundry.toml", `[profile.default]\nsrc = "src"\ntest = "test"\nlibs = ["lib"]\n`);
  write(
    root,
    "src/FixtureVault.sol",
    `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Fixture {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract FixtureVault {
    IERC20Fixture public immutable asset;
    uint256 public totalSupply;
    uint256 public depositCalls;
    uint256 public withdrawCalls;
    mapping(address => uint256) public balanceOf;

    constructor(address asset_) {
        asset = IERC20Fixture(asset_);
    }

    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        require(asset.transferFrom(msg.sender, address(this), assets), "TRANSFER_FROM");
        shares = assets;
        balanceOf[receiver] += shares;
        totalSupply += shares;
        depositCalls += 1;
    }

    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares) {
        shares = assets;
        require(balanceOf[owner] >= shares, "SHARES");
        balanceOf[owner] -= shares;
        totalSupply -= shares;
        withdrawCalls += 1;
        require(asset.transfer(receiver, assets), "TRANSFER");
    }

    function totalAssets() external view returns (uint256) {
        return asset.balanceOf(address(this));
    }
}`
  );
  write(
    root,
    "lib/forge-std/src/Test.sol",
    `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.24;\ncontract Test { function targetContract(address) internal {} }`
  );
}

function wireFixtureVault(path: string, content: string) {
  if (path.endsWith("ProofboardVaultInvariant.t.sol")) {
    return content
      .replace("// vault = new FixtureVault(...);", "vault = new FixtureVault(address(asset));")
      .replace(
        "handler = new VaultHandler(address(vault), address(asset), actors);",
        `handler = new VaultHandler(address(vault), address(asset), actors);
        handler.deposit(100 ether, 0);
        handler.withdraw(40 ether, 0);
        handler.donate(10 ether);`
      );
  }

  if (path.endsWith("VaultHandler.sol")) {
    return content
      .replace(
        'import {MockERC20} from "../mocks/MockERC20.sol";',
        'import {MockERC20} from "../mocks/MockERC20.sol";\nimport {FixtureVault} from "../../../src/FixtureVault.sol";'
      )
      .replace(
        "// TODO: prank actor, approve vault, and call deposit.",
        `actor;
        MockERC20(asset).mint(address(this), assets);
        MockERC20(asset).approve(vault, assets);
        FixtureVault(vault).deposit(assets, address(this));`
      )
      .replace(
        `actor;
        // TODO: prank actor and call withdraw/redeem with bounded owned shares.`,
        `actor;
        uint256 ownedShares = FixtureVault(vault).balanceOf(address(this));
        assets = assets > ownedShares ? ownedShares : assets;
        if (assets > 0) FixtureVault(vault).withdraw(assets, address(this), address(this));`
      )
      .replace(
        "return vault != address(0) && asset != address(0);",
        `FixtureVault target = FixtureVault(vault);
        return target.depositCalls() > 0
            && target.withdrawCalls() > 0
            && target.totalAssets() >= target.totalSupply()
            && target.balanceOf(address(this)) == target.totalSupply();`
      );
  }

  return content;
}

function adversarialTokenFixture() {
  return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FeeOnTransferToken} from "./invariants/mocks/FeeOnTransferToken.sol";
import {RebasingToken} from "./invariants/mocks/RebasingToken.sol";

contract NaiveFeeVault {
    FeeOnTransferToken public immutable asset;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;

    constructor(FeeOnTransferToken asset_) {
        asset = asset_;
    }

    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        require(asset.transferFrom(msg.sender, address(this), assets), "TRANSFER_FROM");
        shares = assets;
        balanceOf[receiver] += shares;
        totalSupply += shares;
    }

    function totalAssets() external view returns (uint256) {
        return asset.balanceOf(address(this));
    }
}

contract AdversarialTokenFixture {
    function testFeeOnTransferAccruesConfiguredFee() external {
        FeeOnTransferToken token = new FeeOnTransferToken();
        address receiver = address(0xBEEF);

        token.mint(address(this), 200 ether);
        require(token.transfer(receiver, 100 ether), "TRANSFER");
        require(token.balanceOf(receiver) == 99 ether, "DEFAULT_NET");
        require(token.balanceOf(address(0xFEE)) == 1 ether, "DEFAULT_FEE");

        token.setFeeBps(250);
        require(token.transfer(receiver, 100 ether), "TRANSFER_CONFIGURED");
        require(token.balanceOf(receiver) == 196.5 ether, "CONFIGURED_NET");
        require(token.balanceOf(address(0xFEE)) == 3.5 ether, "CONFIGURED_FEE");
    }

    function testRebaseChangesBalanceAndSupply() external {
        RebasingToken token = new RebasingToken();
        address holder = address(0xCAFE);

        token.mint(holder, 100 ether);
        token.positiveRebase(holder, 20 ether);
        require(token.balanceOf(holder) == 120 ether, "POSITIVE_BALANCE");
        require(token.totalSupply() == 120 ether, "POSITIVE_SUPPLY");

        token.negativeRebase(holder, 30 ether);
        require(token.balanceOf(holder) == 90 ether, "NEGATIVE_BALANCE");
        require(token.totalSupply() == 90 ether, "NEGATIVE_SUPPLY");
    }

    function testNaiveVaultAccountingExposesTransferFee() external {
        FeeOnTransferToken token = new FeeOnTransferToken();
        NaiveFeeVault vault = new NaiveFeeVault(token);

        token.mint(address(this), 100 ether);
        require(token.approve(address(vault), 100 ether), "APPROVE");
        uint256 shares = vault.deposit(100 ether, address(this));

        require(shares == 100 ether, "SHARES");
        require(vault.totalSupply() == 100 ether, "SUPPLY");
        require(vault.totalAssets() == 99 ether, "RECEIVED_ASSETS");
        require(vault.totalAssets() < vault.totalSupply(), "ACCOUNTING_MISMATCH");
    }
}
`;
}

function strategyAndInflationFixture() {
  return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MockERC20} from "./invariants/mocks/MockERC20.sol";

contract StrategyFixture {
    MockERC20 public immutable asset;

    constructor(MockERC20 asset_) {
        asset = asset_;
    }

    function totalAssets() external view returns (uint256) {
        return asset.balanceOf(address(this));
    }

    function realizeLoss(uint256 assets) external {
        require(asset.transfer(address(0xDEAD), assets), "LOSS_TRANSFER");
    }
}

contract StrategyAwareVault {
    MockERC20 public immutable asset;
    StrategyFixture public immutable strategy;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;

    constructor(MockERC20 asset_) {
        asset = asset_;
        strategy = new StrategyFixture(asset_);
    }

    function totalAssets() public view returns (uint256) {
        return asset.balanceOf(address(this)) + strategy.totalAssets();
    }

    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        uint256 managedAssets = totalAssets();
        shares = totalSupply == 0 ? assets : (assets * totalSupply) / managedAssets;
        require(asset.transferFrom(msg.sender, address(this), assets), "TRANSFER_FROM");
        balanceOf[receiver] += shares;
        totalSupply += shares;
    }

    function donate(uint256 assets) external {
        require(asset.transferFrom(msg.sender, address(this), assets), "DONATION_TRANSFER");
    }

    function deployToStrategy(uint256 assets) external {
        require(asset.transfer(address(strategy), assets), "STRATEGY_TRANSFER");
    }
}

contract StrategyAndInflationFixture {
    function testStrategyGainAndLossChangeManagedAssets() external {
        MockERC20 token = new MockERC20("Asset", "AST", 18);
        StrategyAwareVault vault = new StrategyAwareVault(token);

        token.mint(address(this), 100 ether);
        require(token.approve(address(vault), 100 ether), "APPROVE");
        require(vault.deposit(100 ether, address(this)) == 100 ether, "INITIAL_SHARES");

        vault.deployToStrategy(60 ether);
        require(vault.totalAssets() == 100 ether, "DEPLOYMENT_ACCOUNTING");

        token.mint(address(vault.strategy()), 20 ether);
        require(vault.totalAssets() == 120 ether, "STRATEGY_GAIN");

        vault.strategy().realizeLoss(30 ether);
        require(vault.totalAssets() == 90 ether, "STRATEGY_LOSS");
    }

    function testDonationCanRoundVictimDepositToZeroShares() external {
        MockERC20 token = new MockERC20("Asset", "AST", 18);
        StrategyAwareVault vault = new StrategyAwareVault(token);
        address attacker = address(0xA11CE);
        address victim = address(0xB0B);

        token.mint(address(this), 201);
        require(token.approve(address(vault), 201), "APPROVE");
        require(vault.deposit(1, attacker) == 1, "ATTACKER_SHARES");
        vault.donate(100);

        uint256 victimShares = vault.deposit(100, victim);
        require(victimShares == 0, "ZERO_SHARE_ROUNDING");
        require(vault.totalAssets() == 201, "DONATED_ASSETS");
        require(vault.totalSupply() == 1, "DILUTED_SUPPLY");
    }
}
`;
}
