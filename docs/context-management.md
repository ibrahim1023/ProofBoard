# Context Management

ProofBoard uses explicit repository state to keep coding-agent work bounded, reviewable, and verifiable.

## Required Startup

Every coding-agent session must begin by:

1. Confirming the repository root and current directory.
2. Finding applicable `AGENTS.md` files.
3. Reading root `AGENTS.md`.
4. Reading `task.md`.
5. Inspecting git state when the repository is initialized.
6. Identifying validation commands.
7. Working on one task only.
8. Searching before reading broad files.

## Operational Authority

For agent behavior, follow:

1. direct user instruction for the current task
2. system, developer, and tool constraints
3. nearest applicable `AGENTS.md`
4. root `AGENTS.md`
5. `task.md`
6. `scope.md`
7. other docs

## Factual Source of Truth

For what the system actually does, follow:

1. implementation
2. tests
3. schemas and contracts
4. evals
5. runtime behavior and logs
6. `scope.md`
7. docs
8. generated summaries

## Working Rules

- Search before opening broad files.
- Load only context relevant to the active task.
- Prefer line ranges and symbols over whole-file reads.
- Make small scoped changes.
- Run relevant validation gates.
- Update `task.md` before handoff when project state changes.
- Record durable decisions in `docs/decisions/`.

## State Files

`task.md` is the active durable state file for current work, completed summaries, pending tasks, validation expectations, and next steps.

`progress.md` is no longer maintained in this repository. Do not recreate it for normal task tracking.

## Stop Conditions

Stop and report if:

- applicable instructions conflict
- required files cannot be read
- validation repeatedly fails without new evidence
- the task expands beyond the agreed scope
- required credentials, dependencies, or approvals are missing
