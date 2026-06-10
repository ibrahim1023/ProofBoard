# Architecture

ProofBoard is a web-first protocol assurance workspace. The system should make protocol intent, verification evidence, and unresolved assumptions visible in one workspace.

## Initial Product Flow

1. User creates a workspace.
2. User uploads Solidity files or a repository zip.
3. User selects ERC4626 vault, staking vault, lending market, AMM pool, or custom vault intake.
4. The analyzer builds a protocol map.
5. The intent workflow proposes claims from code, docs, tests, and user notes.
6. The user approves, edits, or rejects claims.
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

## LLM Modes

ProofBoard supports:

- no LLM mode using deterministic protocol templates
- local LLM mode through the server-side `/api/generate-claims` Ollama-compatible adapter
- an optional hosted LLM validation boundary without a hosted transport implementation

The local adapter keeps its base URL in server configuration, bounds submitted source content, requests non-streaming schema-constrained JSON, and validates the returned envelope with the property engine. Valid claims remain `AI-inferred`; insufficient source evidence is represented as an explicit refusal. Hosted LLMs may improve quality but must not be mandatory for the core workflow.
