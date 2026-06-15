# Architecture

ProofBoard is a web-first protocol assurance workspace. The system should make protocol intent, verification evidence, and unresolved assumptions visible in one workspace.

## Initial Product Flow

1. User creates a workspace.
2. User pastes Solidity, selects local repository source files, or imports a bounded public GitHub repository snapshot.
3. User selects ERC4626 vault, staking vault, lending market, AMM pool, or custom vault intake.
4. The analyzer builds a protocol map.
5. The intent workflow proposes claims from code, docs, tests, and user notes.
6. Distinct reviewers approve, edit, reject, or comment on claims under the workspace approval policy.
7. The property engine suggests protocol-specific secure-core properties and assumptions.
8. The harness generator emits Foundry invariant test scaffolding.
9. The runner surfaces local or Docker Foundry command plans.
10. The local server bridge runs structured runner requests and captures stdout/stderr into the Results board.
11. The result parser updates the verification ledger.
12. The user exports an audit-prep packet.

## Recommended Stack

Frontend:
- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- Monaco editor
- React Flow
- Zustand or TanStack Query

Backend and analysis:
- Python FastAPI or Node.js
- SQLite or Postgres for workspace data
- Tree-sitter Solidity parser
- Optional Slither integration
- Local server bridge for Docker or local Foundry execution from structured runner requests

## Package Boundaries

- `packages/analyzer/`: extracts contracts, functions, inheritance, state variables, roles, external calls, and asset flows.
- `packages/property-engine/`: owns ERC4626, staking, lending, and AMM claim, property, assumption, and skeptic templates.
- `packages/harness-generator/`: creates Foundry invariant tests, handlers, actor models, and mocks.
- `packages/verification-runner/`: plans local and Docker Foundry execution and captures raw output in Node workflows.
- `packages/result-parser/`: parses Foundry output and maps results to properties and evidence.
- `packages/shared-types/`: defines workspace, contract, claim, property, assumption, and verification-run schemas.

## Chain-Agnostic Assurance Model

The workspace may include a versioned assurance model alongside the existing Solidity protocol map. The model defines runtime-neutral assurance targets with:

- target identity and kind, such as contract, program, module, or service
- runtime family and execution environment
- source language and linked source records
- operation identifiers independent of Solidity function terminology

Claims and assumptions may link to targets and operations. Properties, verification runs, and evidence may link to targets. Verification runs may also carry a backend descriptor that identifies test, fuzzing, symbolic, formal, manual, or other evidence production without changing the evidence status vocabulary.

The Solidity protocol map and Foundry fields remain supported for backward compatibility and the current executable ERC4626 workflow. Representing a runtime in this model does not imply analyzer, property, execution, parser, or export parity for that runtime.

## EVM Deployment Context

Workspaces may attach one or more EVM deployment records to assurance targets. Each record preserves the network, numeric chain ID, deployed address, block explorer reference, proxy pattern, implementation and administrator addresses, oracle feeds, and bridge dependencies.

Deployment metadata is exported in the ledger and a dedicated deployment inventory. It is review context rather than executed evidence: ProofBoard does not currently verify bytecode, storage layout, proxy slots, administrator ownership, oracle configuration, or bridge configuration against a live chain.

## LLM Modes

ProofBoard supports:

- no LLM mode using deterministic protocol templates
- local LLM mode through the server-side `/api/generate-claims` Ollama-compatible adapter
- an optional hosted LLM validation boundary without a hosted transport implementation

The local adapter keeps its base URL in server configuration, bounds submitted source content, requests non-streaming schema-constrained JSON, and validates the returned envelope with the property engine. Valid claims remain `AI-inferred`; insufficient source evidence is represented as an explicit refusal. Hosted LLMs may improve quality but must not be mandatory for the core workflow.
