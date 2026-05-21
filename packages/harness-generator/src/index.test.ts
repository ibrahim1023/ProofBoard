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
      "test/invariants/README.md"
    ]);
  });

  it("keeps generated code traceable to selected properties", () => {
    const bundle = generateFoundryHarnessBundle(workspace);
    const invariant = bundle.files.find((file) => file.path.endsWith("ProofboardVaultInvariant.t.sol"));

    expect(invariant?.propertyIds).toContain("property_share_accounting");
    expect(invariant?.content).toContain("ProofBoard property: property_share_accounting");
    expect(invariant?.content).toContain("not proof of safety");
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

  it.runIf(forgeAvailable())("executes generated invariants after wiring the target vault fixture", () => {
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

      generateFoundryHarnessBundle(wiredWorkspace).files.forEach((file) => {
        write(root, file.path, wireFixtureVault(file.path, file.content));
      });

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
  write(root, "src/FixtureVault.sol", `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.24;\ncontract FixtureVault {}`);
  write(
    root,
    "lib/forge-std/src/Test.sol",
    `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.24;\ncontract Test { function targetContract(address) internal {} }`
  );
}

function wireFixtureVault(path: string, content: string) {
  if (!path.endsWith("ProofboardVaultInvariant.t.sol")) {
    return content;
  }

  return content.replace("// vault = new FixtureVault(...);", "vault = new FixtureVault();");
}
