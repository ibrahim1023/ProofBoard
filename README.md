# ProofBoard

ProofBoard is a protocol assurance workspace for smart contracts.

It helps teams turn protocol intent into executable invariants, verification evidence, and assumption debt.

ProofBoard does not claim a protocol is safe. It shows:

- what the protocol appears to rely on
- which claims humans approved
- which properties have tests
- which properties were fuzzed
- which properties failed
- which assumptions remain unresolved
- which parts of the protocol are still outside the secure core

Core principle:

> AI proposes. Humans approve. Tools produce evidence.

## MVP Focus

The first MVP focuses on ERC4626-style vault assurance:

- protocol map
- intent board
- invariant board
- assumption debt board
- verification ledger
- Foundry invariant harness export
- audit packet export

## Repository Layout

```text
apps/web/                    Web workspace UI
packages/analyzer/           Solidity and project analysis
packages/property-engine/    ERC4626 property and assumption templates
packages/harness-generator/  Foundry invariant harness generation
packages/result-parser/      Foundry output parsing
packages/shared-types/       Shared schemas and types
examples/erc4626-vault/      Demo vault fixture area
docs/                        Architecture and product docs
evals/                       AI and agent behavior evaluations
```

## Development

Install dependencies:

```bash
npm install
```

Run the web app:

```bash
npm run dev
```

Validation:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Status

Phase 0 tooling is configured and Phase 1 contains a static workspace MVP with demo ERC4626 data, project intake, board navigation, and placeholder surfaces for the full assurance workflow.
