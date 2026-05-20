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
});
