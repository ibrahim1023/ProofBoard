import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Home from "./page";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ProofBoard workspace", () => {
  it("offers lending as a protocol intake type", () => {
    render(<Home />);

    expect(screen.getByRole("option", { name: "Lending Market" })).toBeInTheDocument();
  });

  it("offers AMM pools as a protocol intake type", () => {
    render(<Home />);

    expect(screen.getByRole("option", { name: "AMM Pool" })).toBeInTheDocument();
  });

  it("offers bridges as a protocol intake type", () => {
    render(<Home />);

    expect(screen.getByRole("option", { name: "Bridge" })).toBeInTheDocument();
  });

  it("offers governance and upgradeable systems as a protocol intake type", () => {
    render(<Home />);

    expect(screen.getByRole("option", { name: "Governance / Upgradeable" })).toBeInTheDocument();
  });

  it("renders the workspace shell with demo ERC4626 data", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { name: "ProofBoard" })).toBeInTheDocument();
    expect(screen.getAllByText("ExampleVault Assurance")).toHaveLength(2);
    expect(screen.getByLabelText("Evidence boundary")).toBeInTheDocument();
    expect(screen.getByText("Inferred")).toBeInTheDocument();
    expect(screen.getByText("Failed evidence")).toBeInTheDocument();
    expect(screen.getByText("Import local repository files")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import public GitHub repository" })).toBeInTheDocument();
    expect(screen.getByLabelText("Public demo guide")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start completed demo" })).toBeInTheDocument();
    expect(screen.getByText("Donation or inflation concern is represented")).toBeInTheDocument();
  });

  it("loads the completed demo ledger with fuzz evidence", () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Load completed demo" }));

    expect(screen.getAllByText("ExampleVault Completed Demo")).toHaveLength(2);
    expect(screen.getAllByText("fuzzed_failed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("weak_or_vacuous").length).toBeGreaterThan(0);
    expect(screen.getByText(/Foundry invariant_pauseBehavior/)).toBeInTheDocument();
    expect(screen.getByText(/direct donation should not let an early depositor/i)).toBeInTheDocument();
  });

  it("keeps generated claims behind human review controls", () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Intent Board" }));
    expect(screen.getByRole("button", { name: "Generate suggestions" })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Reject" })[0]);
    expect(screen.getByText("Rejected")).toBeInTheDocument();
  });

  it("records reviewer identity, claim rationale, edit history, and property comments", () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Intent Board" }));
    fireEvent.change(screen.getByLabelText("Reviewer"), { target: { value: "Alice Reviewer" } });
    fireEvent.change(screen.getAllByLabelText("Rejection rationale")[0], {
      target: { value: "Claim needs a source-backed emergency policy before approval." }
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Reject" })[0]);

    expect(screen.getByText(/rejected by Alice Reviewer: Claim needs a source-backed emergency policy/)).toBeInTheDocument();

    fireEvent.change(screen.getAllByLabelText("Claim comment")[0], {
      target: { value: "Ask protocol team to link this claim to NatSpec." }
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Add comment" })[0]);
    expect(screen.getByText(/commented by Alice Reviewer: Ask protocol team/)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Record edit" })[0]);
    expect(screen.getByText(/edited by Alice Reviewer: Edited claim text/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Generate invariants" }));
    fireEvent.change(screen.getAllByLabelText("Property comment")[0], {
      target: { value: "Needs multi-actor withdraw coverage before audit handoff." }
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Add property comment" })[0]);

    expect(screen.getByText(/commented by Alice Reviewer: Needs multi-actor withdraw coverage/)).toBeInTheDocument();
  });

  it("requires distinct reviewer quorum before approving claim intent", () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "New blank workspace" }));
    fireEvent.change(screen.getByLabelText("Solidity source"), {
      target: {
        value: `contract QuorumVault is ERC4626 {
          function deposit(uint256 assets, address receiver) external {}
          function withdraw(uint256 assets, address receiver, address owner) external {}
        }`
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Intent Board" }));
    fireEvent.change(screen.getByLabelText("Required approvals"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Reviewer"), { target: { value: "Alice" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Approve" })[0]!);

    expect(screen.getByText(/approved by Alice: Approval 1\/2 recorded/)).toBeInTheDocument();
    expect(screen.getAllByText("AI-inferred").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("Reviewer"), { target: { value: "Bob" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Approve" })[0]!);

    expect(screen.getByText(/approved by Bob: Approval 2\/2 recorded/)).toBeInTheDocument();
    expect(screen.getAllByText("Human-approved").length).toBeGreaterThan(0);
  });

  it("imports a public GitHub repository snapshot into workspace sources", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            ok: true,
            repository: {
              provider: "github",
              repositoryUrl: "https://github.com/example/protocol",
              ref: "main",
              importedAt: "2026-06-10T00:00:00Z",
              files: ["src/Imported.sol"]
            },
            sources: [
              {
                id: "source_imported",
                path: "src/Imported.sol",
                language: "solidity",
                content: "contract Imported { function stake(uint256 assets) external {} }"
              }
            ]
          })
        )
      )
    );
    render(<Home />);

    fireEvent.change(screen.getByLabelText("GitHub repository URL"), {
      target: { value: "https://github.com/example/protocol" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Import public GitHub repository" }));

    expect(await screen.findByText("Imported 1 files from github.")).toBeInTheDocument();
    expect(screen.getByLabelText("Solidity source")).toHaveValue(
      "contract Imported { function stake(uint256 assets) external {} }"
    );
    expect(screen.getByText("github: 1 files at main")).toBeInTheDocument();
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

  it("generates local claims through the Ollama adapter and keeps human review required", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            ok: true,
            model: "llama3.1:8b",
            payload: {
              status: "proposed",
              claims: [
                {
                  title: "Local model claim",
                  text: "A local model claim should remain AI-inferred until a reviewer approves its source-backed intent.",
                  source: ["ExampleVault.sol"],
                  confidence: 0.66,
                  severity: "medium"
                }
              ]
            }
          })
        )
      )
    );
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Intent Board" }));
    fireEvent.change(screen.getByLabelText("Claim mode"), { target: { value: "local_llm" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate with local model" }));

    expect(await screen.findByText("Local model claim")).toBeInTheDocument();
    expect(screen.getAllByText("AI-inferred").length).toBeGreaterThan(0);
    expect((screen.getByLabelText("Structured claim payload") as HTMLTextAreaElement).value).toContain("Local model claim");
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
    expect(screen.getByLabelText("Owner")).toHaveValue("Protocol governance");
    expect(screen.getByLabelText("Accepted-risk justification")).toHaveValue(
      "The team accepts this risk only if the deployed admin path matches the documented emergency policy."
    );

    fireEvent.change(screen.getByLabelText("Owner"), { target: { value: "Security council" } });
    fireEvent.change(screen.getByLabelText("Accepted-risk justification"), {
      target: { value: "Risk accepted for demo only; production deployment needs governance evidence." }
    });
    expect(screen.getByLabelText("Owner")).toHaveValue("Security council");
    expect(screen.getByLabelText("Accepted-risk justification")).toHaveValue(
      "Risk accepted for demo only; production deployment needs governance evidence."
    );

    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "Out of scope" } });
    expect(screen.getByText("No assumptions recorded yet.")).toBeInTheDocument();
  });

  it("renders verification ledger evidence and risk details", () => {
    const { container } = render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Ledger" }));

    expect(screen.getByText("Evidence over confidence")).toBeInTheDocument();
    expect(screen.getByLabelText("Verification readiness")).toBeInTheDocument();
    expect(screen.getByText(/not a safety score/)).toBeInTheDocument();
    expect(screen.getByText("weak evidence")).toBeInTheDocument();
    expect(screen.getAllByText("critical").length).toBeGreaterThan(0);
    expect(screen.getByText("weak_or_vacuous")).toBeInTheDocument();
    expect(container.querySelector('[data-boundary="inferred"]')).toBeInTheDocument();
    expect(container.querySelector('[data-boundary="assumption"]')).toBeInTheDocument();
    expect(container.querySelector('[data-boundary="failed"]')).toBeInTheDocument();
  });

  it("renders generated Foundry harness files and command", () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Harness" }));

    expect(screen.getByLabelText("Harness quality checks")).toBeInTheDocument();
    expect(screen.getByText("Deposit flow")).toBeInTheDocument();
    expect(screen.getByText("Adversarial token mocks")).toBeInTheDocument();
    expect(screen.getAllByText("missing").length).toBeGreaterThan(0);
    expect(screen.getByText("forge test --match-contract ProofboardVaultInvariant")).toBeInTheDocument();
    expect(screen.getAllByText("test/invariants/ProofboardVaultInvariant.t.sol").length).toBeGreaterThan(0);
    expect(screen.getByText("test/invariants/handlers/VaultHandler.sol")).toBeInTheDocument();
    expect(screen.getByText("test/invariants/mocks/FeeOnTransferToken.sol")).toBeInTheDocument();
    expect(screen.getByText("ProofBoard property: property_redeemable_assets", { exact: false })).toBeInTheDocument();
  });

  it("parses Foundry output into ledger evidence", () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Results" }));
    expect(screen.getByLabelText("Invariant vacuity metrics")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Raw Foundry output"), {
      target: {
        value: `[PASS] invariant_redeemableAssets() (runs: 16, calls: 12, reverts: 0)
Sequence:
  handler.deposit(1 ether, 0)`
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Parse Foundry output" }));
    expect(screen.getByText("passed")).toBeInTheDocument();
    expect(screen.getByText("Low call volume")).toBeInTheDocument();
    expect(screen.getByText(/Missing:/)).toBeInTheDocument();

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
    const encoder = new TextEncoder();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                `${JSON.stringify({ type: "output", stream: "stdout", chunk: "[PASS] invariant_redeemableAssets() (runs: 256)" })}\n`
              )
            );
            controller.enqueue(
              encoder.encode(
                `${JSON.stringify({ type: "complete", execution: { status: "passed", exitCode: 0 } })}\n`
              )
            );
            controller.close();
          }
        }),
        { status: 200 }
      )
    );
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
Sequence: handler.deposit(1 ether, alice)
Warning: unreached handler selector handler.mint(uint256,address)`
    );
  });

  it("cancels a streaming runner while preserving partial output", async () => {
    const encoder = new TextEncoder();
    vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) =>
      Promise.resolve(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(
                encoder.encode(`${JSON.stringify({ type: "output", stream: "stdout", chunk: "[PASS] partial invariant\n" })}\n`)
              );
              init?.signal?.addEventListener(
                "abort",
                () => controller.error(new DOMException("The operation was aborted.", "AbortError")),
                { once: true }
              );
            }
          }),
          { status: 200 }
        )
      )
    );
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Results" }));
    fireEvent.click(screen.getByRole("button", { name: "Run planned command" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel run" }));

    expect(await screen.findByText("Runner cancellation requested. Partial output remains available for review.")).toBeInTheDocument();
    expect(screen.getByLabelText("Raw Foundry output")).toHaveValue("[PASS] partial invariant\n");
  });

  it("renders downloadable audit packet artifacts", () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Export" }));

    expect(screen.getByRole("button", { name: /proofboard-report\.md/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /executive-summary\.md/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /auditor-questions\.md/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /verification-readiness\.json/ })).toBeInTheDocument();
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
