# ProofBoard Agent Instructions

## Mission
ProofBoard is a web-based protocol assurance workspace for smart contract teams. Quality here means the product keeps protocol intent, approved claims, generated properties, assumptions, and verification evidence visibly separate and reviewable.

## Rule Loading
- Read this file before any code or documentation changes.
- Before editing files in a subdirectory, check that directory and its parents for another `AGENTS.md`.
- Local `AGENTS.md` files override this file for their subtree.
- If instructions conflict, stop and report the conflict.
- Read `task.md` and `progress.md` before starting implementation work.

## Project Layout
- `apps/web/`: Proofboard web application surface.
- `packages/analyzer/`: Solidity and project analysis logic.
- `packages/property-engine/`: ERC4626 claim, property, invariant, and assumption templates.
- `packages/harness-generator/`: Foundry invariant harness generation.
- `packages/result-parser/`: Foundry output parsing and ledger updates.
- `packages/shared-types/`: Shared schemas and TypeScript types.
- `examples/erc4626-vault/`: Example vault input for demos and regression fixtures.
- `docs/`: Architecture, product, verification, and decision records.
- `evals/`: AI and agent behavior datasets, evaluators, experiments, and results.

## Commands
Use npm workspaces from the repository root.

Install:
- `npm install`

Test:
- `npm test`

Lint:
- `npm run lint`

Typecheck:
- `npm run typecheck`

Build:
- `npm run build`

Eval:
- `npm run eval`

## Product Rules
- Proofboard is not an AI auditor, vulnerability scanner, or safety guarantee.
- AI may propose intent; humans approve intent; tools produce evidence.
- Assumptions are first-class records, not hidden caveats.
- Verification status must describe evidence, not vague confidence.
- Start narrow with ERC4626 and vault-like protocols before broadening.
- Generated claims and properties must remain editable, rejectable, and traceable to sources.

## Coding Rules
- Use existing patterns before introducing new abstractions.
- Keep changes minimal and scoped to the current task.
- Do not refactor unrelated files.
- Add or update tests for behavior changes once test infrastructure exists.
- Do not change public contracts, schemas, or exported data formats without updating tests and docs.
- Prefer structured schemas for workspace, contract, claim, property, assumption, and verification-run data.
- Do not introduce new dependencies without approval.
- Update `README.md` after major phase or feature implementations, keeping it feature-oriented and professional instead of phase-log oriented.

## Validation Gates
Before completion:
- Run targeted tests for changed behavior.
- Run `npm run lint`, `npm run typecheck`, and `npm run build` for web changes.
- For documentation-only changes, inspect changed files and report that automated gates are not configured.
- Confirm `README.md` reflects major completed feature work when implementation scope changes.
- Update `task.md` and `progress.md` with commands run, results, risks, and next step.

## Permissions
Allowed without approval:
- read files
- search code
- edit files directly related to the task
- create or update project state docs
- run configured local tests, lint, typecheck, build, and evals

Requires approval:
- deleting files or directories
- changing dependencies
- network calls that mutate external state
- changing secrets or credentials
- publishing releases
- pushing commits to remotes
- broad rewrites outside the current task

## Definition of Done
A task is done only when:
- the requested scope is implemented or the blocker is documented
- relevant validation has been run, or missing validation is explicitly noted
- `task.md` and `progress.md` reflect current state
- unresolved risks and next steps are recorded
