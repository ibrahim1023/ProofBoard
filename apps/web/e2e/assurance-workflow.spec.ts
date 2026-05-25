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
  await expect(page.getByText("passed")).toBeVisible();

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
