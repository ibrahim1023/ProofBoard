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
});
