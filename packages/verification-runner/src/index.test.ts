import { describe, expect, it } from "vitest";
import { generateFoundryHarnessBundle } from "@proofboard/harness-generator";
import type { Workspace } from "@proofboard/shared-types";
import { createFoundryRunPlan, runFoundryPlan } from "./index";

const workspace = {
  id: "workspace_runner",
  name: "Runner Vault",
  protocolType: "erc4626_vault",
  description: "A runner fixture.",
  sources: [],
  protocolMap: {
    contracts: [],
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
      id: "property_redeemable_assets",
      claimId: "claim_withdraw_ownership",
      text: "Redeemable assets stay bounded by share ownership.",
      status: "Generated",
      skepticStatus: "Acceptable",
      skepticFindings: [],
      verificationLevel: "test_generated",
      risk: "critical",
      assumptions: [],
      evidence: [],
      nextAction: "Run Foundry."
    }
  ],
  assumptions: [],
  verificationRuns: [],
  evidence: []
} satisfies Workspace;

describe("verification runner", () => {
  it("plans local Foundry execution without hiding the evidence boundary", () => {
    const plan = createFoundryRunPlan(workspace, generateFoundryHarnessBundle(workspace), {
      mode: "local",
      projectPath: "/tmp/proofboard"
    });

    expect(plan.executable).toBe("forge");
    expect(plan.args).toEqual(["test", "--match-contract", "ProofboardVaultInvariant"]);
    expect(plan.command).toBe("forge test --match-contract ProofboardVaultInvariant");
    expect(plan.evidenceBoundary).toContain("parsed before it updates ProofBoard evidence");
    expect(plan.warnings).toContain("Generated harnesses must be reviewed and wired before run output counts as strong evidence.");
  });

  it("plans Docker Foundry execution with a mounted workspace", () => {
    const plan = createFoundryRunPlan(workspace, generateFoundryHarnessBundle(workspace), {
      mode: "docker",
      projectPath: "/tmp/proofboard",
      dockerImage: "foundry:local"
    });

    expect(plan.executable).toBe("docker");
    expect(plan.args).toEqual([
      "run",
      "--rm",
      "-v",
      "/tmp/proofboard:/workspace",
      "-w",
      "/workspace",
      "foundry:local",
      "forge",
      "test",
      "--match-contract",
      "ProofboardVaultInvariant"
    ]);
    expect(plan.command).toContain("docker run --rm");
  });

  it("captures raw output from a runner executor", async () => {
    const plan = createFoundryRunPlan(workspace, generateFoundryHarnessBundle(workspace), {
      mode: "local",
      projectPath: "/tmp/proofboard"
    });
    const execution = await runFoundryPlan(plan, async () => ({
      stdout: "[PASS] invariant_redeemableAssets() (runs: 256)",
      stderr: "",
      exitCode: 0
    }));

    expect(execution.status).toBe("passed");
    expect(execution.rawOutput).toContain("invariant_redeemableAssets");
  });

  it("refuses execution when the project path is missing", async () => {
    const plan = createFoundryRunPlan(workspace, generateFoundryHarnessBundle(workspace), {
      mode: "local",
      projectPath: ""
    });

    await expect(runFoundryPlan(plan)).resolves.toMatchObject({
      status: "errored",
      rawOutput: "Project path is required before running Foundry."
    });
  });
});
