import { expect, test } from "@playwright/test";

const source = `contract BrowserVault is ERC4626 {
  function deposit(uint256 assets, address receiver) public returns (uint256 shares) {}
  function withdraw(uint256 assets, address receiver, address owner) public returns (uint256 shares) {}
}`;

test("moves a vault from intake through uploaded evidence and exports", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "ProofBoard" })).toBeVisible();
  await page.getByRole("button", { name: "New blank workspace" }).click();
  await page.getByLabel("Solidity source").fill(source);

  await page.getByRole("button", { name: "Intent Board" }).click();
  await expect(page.getByText("Deposits mint proportional shares")).toBeVisible();
  await page.getByRole("button", { name: "Approve" }).first().click();
  await page.getByRole("button", { name: "Generate invariants" }).click();
  await expect(page.getByText(/deposit and mint flows should produce consistent accounting outcomes/i)).toBeVisible();

  await page.getByRole("button", { name: "Results" }).click();
  await page.locator('input[accept=".log,.txt"]').setInputFiles({
    name: "browser-foundry.log",
    mimeType: "text/plain",
    buffer: Buffer.from("[PASS] invariant_depositMintConsistency() (runs: 256)")
  });
  await expect(page.getByLabel("Raw Foundry output")).toHaveValue(/invariant_depositMintConsistency/);
  await page.getByRole("button", { name: "Parse Foundry output" }).click();
  await expect(page.getByText("passed", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Invariant vacuity metrics")).toBeVisible();
  await expect(page.getByText("Vacuity review")).toBeVisible();

  await page.getByRole("button", { name: "Ledger" }).click();
  await expect(page.getByText("Foundry invariant_depositMintConsistency")).toBeVisible();

  await page.getByRole("button", { name: "Harness" }).click();
  const harnessDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download bundle" }).click();
  await expect((await harnessDownload).suggestedFilename()).toBe("generated-foundry-invariants.json");

  await page.getByRole("button", { name: "Export" }).click();
  const packetDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: /proofboard-ledger\.json/ }).click();
  await expect((await packetDownload).suggestedFilename()).toBe("proofboard-ledger.json");
});

test("keeps workspace navigation usable across configured viewports", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Protocol Map" }).click();
  await expect(page.getByRole("heading", { name: "Contracts and flows" })).toBeVisible();

  await page.getByRole("button", { name: "Assumption Debt" }).click();
  await expect(page.getByRole("heading", { name: "Assumption Debt" })).toBeVisible();
  await expect(page.getByLabel("Filter")).toBeVisible();
});

test("runs the completed public demo without implying safety", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByLabel("Public demo guide")).toBeVisible();
  await page.getByRole("button", { name: "Start completed demo" }).click();

  await expect(page.getByText(/direct donation should not let an early depositor/i)).toBeVisible();
  await expect(page.getByText("weak_or_vacuous", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("fuzzed_failed", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Assumption Debt" }).click();
  await expect(page.getByText(/Direct donations and first-depositor exchange-rate manipulation/)).toBeVisible();
  await expect(page.getByText("Underlying token does not rebase.")).toBeVisible();

  await page.getByRole("button", { name: "Results" }).click();
  await expect(page.getByLabel("Raw Foundry output")).toHaveValue(/unreached handler selector handler\.mint/);
  await expect(page.getByText("Vacuity review")).toBeVisible();

  await page.getByRole("button", { name: "Export" }).click();
  await expect(page.getByText(/not a safety score/i)).toBeVisible();
  const packetDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: /audit-prep\.md/ }).click();
  await expect((await packetDownload).suggestedFilename()).toBe("audit-prep.md");
});

test("shows runner plans and parser errors without creating evidence", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Results" }).click();
  await expect(page.getByText("Runner plan")).toBeVisible();
  await expect(page.getByText(/docker run --rm/)).toBeVisible();
  await expect(page.getByText(/Captured Docker output must be parsed before it updates ProofBoard evidence/)).toBeVisible();

  await page.getByLabel("Runner mode").selectOption("local");
  await expect(page.getByText("forge test --match-contract ProofboardVaultInvariant")).toBeVisible();
  await expect(page.getByText(/Captured local Forge output must be parsed before it updates ProofBoard evidence/)).toBeVisible();

  await page.getByLabel("Raw Foundry output").fill("No tests match the provided pattern: ProofboardVaultInvariant");
  await page.getByRole("button", { name: "Parse Foundry output" }).click();
  await expect(page.getByText("Parser notes")).toBeVisible();
  await expect(page.getByText("No invariant pass or fail results were found in the Foundry output.")).toBeVisible();
});

test("keeps an empty workspace explicit across review boards", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "New blank workspace" }).click();
  await expect(page.getByRole("heading", { name: "New ProofBoard workspace" })).toBeVisible();

  await page.getByRole("button", { name: "Protocol Map" }).click();
  await expect(page.getByText("Paste Solidity or load the demo.")).toBeVisible();
  await expect(page.getByText("No functions detected. Add Solidity or load the demo workspace.")).toBeVisible();

  await page.getByRole("button", { name: "Intent Board" }).click();
  await expect(page.getByText("No claims yet. ProofBoard will propose claims, but humans approve intent.")).toBeVisible();

  await page.getByRole("button", { name: "Ledger" }).click();
  await expect(page.getByText("Not ready", { exact: true })).toBeVisible();
  await expect(page.getByText("No ledger entries yet.")).toBeVisible();
});

test("rejects malformed and unsupported structured claim payloads", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Intent Board" }).click();
  await page.getByLabel("Claim mode").selectOption("local_llm");

  await page.getByLabel("Structured claim payload").fill("{not valid json");
  await page.getByRole("button", { name: "Validate claim payload" }).click();
  await expect(page.getByText("Structured claim payload must be valid JSON.")).toBeVisible();

  await page.getByLabel("Structured claim payload").fill(
    JSON.stringify({
      status: "proposed",
      claims: [
        {
          title: "Unsupported claim",
          text: "A claim without source grounding should not enter review.",
          source: "README.md",
          confidence: 0.9,
          severity: "high"
        }
      ]
    })
  );
  await page.getByRole("button", { name: "Validate claim payload" }).click();
  await expect(page.getByText("claims.0.source must be a string array.")).toBeVisible();
  await expect(page.locator("article").filter({ hasText: "Unsupported claim" })).toHaveCount(0);
});
