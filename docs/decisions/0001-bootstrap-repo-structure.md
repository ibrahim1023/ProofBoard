# Decision: Bootstrap ProofBoard Repository Structure

Date: 2026-05-19
Status: accepted

## Context

The repository began with product scope in `scope.md` and agent operating guidance in `agent_context.md`, but no base files, task state, docs structure, app scaffold, or package boundaries.

## Decision

Create a scaffold-only repository that follows the recommended ProofBoard monorepo shape:

- `apps/web` for the web workspace
- `packages/analyzer` for Solidity/project analysis
- `packages/property-engine` for ERC4626 property logic
- `packages/harness-generator` for Foundry output generation
- `packages/result-parser` for Foundry result parsing
- `packages/shared-types` for shared schemas
- `examples/erc4626-vault` for the first demo fixture
- `evals` for AI and agent behavior evaluation
- `docs` for architecture, verification levels, ERC4626 properties, and decisions

Also create `AGENTS.md`, `task.md`, and `progress.md` so future agent sessions have explicit operational state.

## Alternatives Considered

- Generate a full Next.js application immediately.
- Start with a backend-first API scaffold.
- Keep only documentation files until a stack is selected.

## Consequences

- Future implementation can proceed with clear boundaries.
- No dependencies are introduced before stack confirmation.
- Validation remains limited until package tooling is configured.

## Validation

Manual inspection of generated files and directories. Automated tests, lint, typecheck, and build are not configured yet.
