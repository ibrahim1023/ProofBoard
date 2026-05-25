import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Home from "./page";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ProofBoard workspace", () => {
  it("renders the workspace shell with demo ERC4626 data", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { name: "ProofBoard" })).toBeInTheDocument();
    expect(screen.getAllByText("ExampleVault Assurance")).toHaveLength(2);
    expect(screen.getByText("Repo zip upload placeholder")).toBeInTheDocument();
  });

  it("loads the completed demo ledger with fuzz evidence", () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Load completed demo" }));

    expect(screen.getAllByText("ExampleVault Completed Demo")).toHaveLength(2);
    expect(screen.getAllByText("fuzzed_failed").length).toBeGreaterThan(0);
    expect(screen.getByText(/Foundry invariant_pauseBehavior/)).toBeInTheDocument();
  });

  it("keeps generated claims behind human review controls", () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Intent Board" }));
    expect(screen.getByRole("button", { name: "Generate suggestions" })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Reject" })[0]);
    expect(screen.getByText("Rejected")).toBeInTheDocument();
  });

  it("validates local LLM claim payloads before review", () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Intent Board" }));
    fireEvent.change(screen.getByLabelText("Claim mode"), { target: { value: "local_llm" } });
    fireEvent.change(screen.getByLabelText("Structured claim payload"), {
      target: {
        value: JSON.stringify({
          status: "proposed",
          claims: [
            {
              title: "Adapters preserve user claims",
              text: "Adapter output should stay source-backed until a reviewer approves intent.",
              source: ["local adapter"],
              confidence: 0.64,
              severity: "medium"
            }
          ]
        })
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Validate claim payload" }));

    expect(screen.getByText("Adapters preserve user claims")).toBeInTheDocument();
    expect(screen.getAllByText("AI-inferred").length).toBeGreaterThan(0);
  });

  it("reports insufficient LLM evidence without adding claims", () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Intent Board" }));
    fireEvent.change(screen.getByLabelText("Claim mode"), { target: { value: "hosted_llm" } });
    fireEvent.click(screen.getByRole("button", { name: "Validate claim payload" }));

    expect(screen.getByText("Claim payload notes")).toBeInTheDocument();
    expect(screen.getByText(/Insufficient evidence:/)).toBeInTheDocument();
  });

  it("lets users filter and update assumption debt", () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Assumption Debt" }));
    expect(screen.getByText("Underlying token behaves like a standard ERC20.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter"), { target: { value: "Accepted risk" } });
    expect(screen.getByText("Admin actions follow the documented emergency policy.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "Out of scope" } });
    expect(screen.getByText("Out of scope")).toBeInTheDocument();
  });

  it("renders verification ledger evidence and risk details", () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Ledger" }));

    expect(screen.getByText("Evidence over confidence")).toBeInTheDocument();
    expect(screen.getByText("weak evidence")).toBeInTheDocument();
    expect(screen.getAllByText("critical").length).toBeGreaterThan(0);
    expect(screen.getByText("weak_or_vacuous")).toBeInTheDocument();
  });

  it("renders generated Foundry harness files and command", () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Harness" }));

    expect(screen.getByText("forge test --match-contract ProofboardVaultInvariant")).toBeInTheDocument();
    expect(screen.getAllByText("test/invariants/ProofboardVaultInvariant.t.sol").length).toBeGreaterThan(0);
    expect(screen.getByText("test/invariants/handlers/VaultHandler.sol")).toBeInTheDocument();
    expect(screen.getByText("test/invariants/mocks/FeeOnTransferToken.sol")).toBeInTheDocument();
    expect(screen.getByText("ProofBoard property: property_redeemable_assets", { exact: false })).toBeInTheDocument();
  });

  it("parses Foundry output into ledger evidence", () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Results" }));
    fireEvent.change(screen.getByLabelText("Raw Foundry output"), {
      target: { value: "[PASS] invariant_redeemableAssets() (runs: 256)" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Parse Foundry output" }));
    expect(screen.getByText("passed")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ledger" }));
    expect(screen.getAllByText("fuzzed_passed").length).toBeGreaterThan(0);
    expect(screen.getByText("human-approved claim, Foundry invariant_redeemableAssets")).toBeInTheDocument();
  });

  it("reports Foundry parser failures clearly", () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Results" }));
    fireEvent.change(screen.getByLabelText("Raw Foundry output"), { target: { value: "build complete" } });
    fireEvent.click(screen.getByRole("button", { name: "Parse Foundry output" }));

    expect(screen.getByText("Parser notes")).toBeInTheDocument();
    expect(screen.getByText("No invariant pass or fail results were found in the Foundry output.")).toBeInTheDocument();
  });

  it("shows Docker and local Foundry runner plans without treating them as evidence", () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Results" }));

    expect(screen.getByText("Runner plan")).toBeInTheDocument();
    expect(screen.getByText(/docker run --rm/)).toBeInTheDocument();
    expect(screen.getByText(/Captured Docker output must be parsed before it updates ProofBoard evidence/)).toBeInTheDocument();
    expect(screen.getByText(/Capture stdout\/stderr into proofboard-foundry-output\.log/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Runner mode"), { target: { value: "local" } });

    expect(screen.getByText("forge test --match-contract ProofboardVaultInvariant")).toBeInTheDocument();
    expect(screen.getByText(/Captured local Forge output must be parsed before it updates ProofBoard evidence/)).toBeInTheDocument();
  });

  it("captures runner output before parsing it into evidence", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        execution: {
          status: "passed",
          rawOutput: "[PASS] invariant_redeemableAssets() (runs: 256)",
          exitCode: 0
        }
      })
    } as Response);
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Results" }));
    fireEvent.click(screen.getByRole("button", { name: "Run planned command" }));

    expect(await screen.findByText("Runner finished with status passed and exit code 0.")).toBeInTheDocument();
    expect(screen.getByLabelText("Raw Foundry output")).toHaveValue("[PASS] invariant_redeemableAssets() (runs: 256)");
    expect(screen.getByText("Review the captured output, then parse it to update the ledger.")).toBeInTheDocument();
  });

  it("shows runner validation failures without changing output", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({
        ok: false,
        errors: ["projectPath must be an absolute local path."]
      })
    } as Response);
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Results" }));
    fireEvent.change(screen.getByLabelText("Foundry project path"), { target: { value: "relative-path" } });
    fireEvent.click(screen.getByRole("button", { name: "Run planned command" }));

    expect(await screen.findByText("projectPath must be an absolute local path.")).toBeInTheDocument();
    expect(screen.getByLabelText("Raw Foundry output")).toHaveValue(
      `[PASS] invariant_redeemableAssets() (runs: 256)
[FAIL. Reason: assertion failed] invariant_pauseBehavior()
Counterexample: paused vault accepted a deposit
Sequence: handler.deposit(1 ether, alice)`
    );
  });

  it("renders downloadable audit packet artifacts", () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Export" }));

    expect(screen.getByRole("button", { name: /proofboard-report\.md/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generated-foundry-invariants\.json/ })).toBeInTheDocument();
    expect(screen.getByText(/suggested audit focus separately/i)).toBeInTheDocument();
  });

  it("walks a blank ERC4626 workspace from source intake to ledger export", () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "New blank workspace" }));
    fireEvent.change(screen.getByLabelText("Solidity source"), {
      target: {
        value: `contract IntakeVault is ERC4626 {
          function deposit(uint256 assets, address receiver) public returns (uint256 shares) {}
          function withdraw(uint256 assets, address receiver, address owner) public returns (uint256 shares) {}
        }`
      }
    });

    fireEvent.click(screen.getByRole("button", { name: "Intent Board" }));
    expect(screen.getByText("Deposits mint proportional shares")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Approve" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Generate invariants" }));
    expect(screen.getByText(/deposit and mint flows should produce consistent accounting outcomes/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Harness" }));
    expect(screen.getAllByText(/property_deposit_mint_consistency/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Results" }));
    fireEvent.change(screen.getByLabelText("Raw Foundry output"), {
      target: { value: "[PASS] invariant_depositMintConsistency() (runs: 256)" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Parse Foundry output" }));

    fireEvent.click(screen.getByRole("button", { name: "Ledger" }));
    expect(screen.getAllByText("fuzzed_passed").length).toBeGreaterThan(0);
    expect(screen.getByText("Foundry invariant_depositMintConsistency")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    expect(screen.getByRole("button", { name: /proofboard-ledger\.json/ })).toBeInTheDocument();
  });
});
