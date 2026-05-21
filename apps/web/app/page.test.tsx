import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("ProofBoard workspace", () => {
  it("renders the workspace shell with demo ERC4626 data", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { name: "ProofBoard" })).toBeInTheDocument();
    expect(screen.getAllByText("ExampleVault Assurance")).toHaveLength(2);
    expect(screen.getByText("Repo zip upload placeholder")).toBeInTheDocument();
  });

  it("keeps generated claims behind human review controls", () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Intent Board" }));
    expect(screen.getByRole("button", { name: "Generate suggestions" })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Reject" })[0]);
    expect(screen.getByText("Rejected")).toBeInTheDocument();
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

  it("renders downloadable audit packet artifacts", () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Export" }));

    expect(screen.getByRole("button", { name: /proofboard-report\.md/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generated-foundry-invariants\.json/ })).toBeInTheDocument();
    expect(screen.getByText(/suggested audit focus separately/i)).toBeInTheDocument();
  });
});
