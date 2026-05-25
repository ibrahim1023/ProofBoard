# Architecture

ProofBoard is a web-first protocol assurance workspace. The system should make protocol intent, verification evidence, and unresolved assumptions visible in one workspace.

## Initial Product Flow

1. User creates a workspace.
2. User uploads Solidity files or a repository zip.
3. User selects a protocol type, initially ERC4626 vault.
4. The analyzer builds a protocol map.
5. The intent workflow proposes claims from code, docs, tests, and user notes.
6. The user approves, edits, or rejects claims.
7. The property engine suggests ERC4626-specific invariants and assumptions.
8. The harness generator emits Foundry invariant test scaffolding.
9. The runner surfaces local or Docker Foundry command plans and can capture raw output in Node workflows.
10. The user pastes or uploads captured output for parsing.
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
- Docker-based Foundry execution planning, with browser execution deferred to a backend or local worker

## Package Boundaries

- `packages/analyzer/`: extracts contracts, functions, inheritance, state variables, roles, external calls, and asset flows.
- `packages/property-engine/`: owns ERC4626 claim, property, invariant, assumption, and skeptic templates.
- `packages/harness-generator/`: creates Foundry invariant tests, handlers, actor models, and mocks.
- `packages/verification-runner/`: plans local and Docker Foundry execution and captures raw output in Node workflows.
- `packages/result-parser/`: parses Foundry output and maps results to properties and evidence.
- `packages/shared-types/`: defines workspace, contract, claim, property, assumption, and verification-run schemas.

## LLM Modes

ProofBoard should support:

- no LLM mode using ERC4626 templates
- local LLM mode through Ollama-compatible models
- optional hosted LLM mode

Hosted LLMs may improve quality but must not be mandatory for the core workflow.
