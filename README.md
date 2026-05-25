# ProofBoard

ProofBoard is a web-based protocol assurance workspace for smart contract teams. It turns protocol intent into reviewed claims, candidate invariants, Foundry harness scaffolds, verification evidence, and visible assumption debt.

ProofBoard aligns with Vitalik Buterin's [formal verification](https://vitalik.eth.limo/general/2026/05/18/fv.html) direction: AI should help defenders specify, verify, and protect high-value secure cores, rather than merely generate more code or longer bug lists.

Core operating principle:

> AI proposes. Humans approve. Tools produce evidence.

ProofBoard is not an AI auditor, vulnerability scanner, formal proof engine, or safety guarantee. It is designed to make the evidence trail reviewable: what was inferred, what a human approved, what was generated, what was tested, and what remains unresolved.

## Product Focus

The current MVP targets ERC4626 and vault-like protocols. The goal is to help teams define and test the secure core before broader audit or verification work.

In scope:

- ERC4626-style vault intake through pasted Solidity and protocol notes.
- Protocol map generation for contracts, inheritance, public/external functions, state, events, modifiers, roles, privileged flows, external calls, token dependencies, and vault asset flows.
- Intent review board with template-based claim suggestions, source evidence, confidence metadata, edit/reject/approve workflows, and an explicit human approval gate.
- ERC4626 property engine for share accounting, deposit/mint consistency, withdraw/redeem consistency, total assets versus supply, donation/inflation risk, rounding behavior, access control, pause behavior, fee behavior, and token assumptions.
- Skeptic checks that flag weak, vague, vacuous, under-exercised, or assumption-heavy properties before teams over-trust generated tests.
- Assumption Debt Board with status, severity, linked functions, linked properties, accepted-risk visibility, and out-of-scope visibility.
- Verification Ledger that separates claim status, property status, verification level, evidence, assumptions, risk, and next action.
- Foundry invariant harness generator with invariant test, handler, actor model, standard token mock, fee-on-transfer token mock, rebasing token mock, setup instructions, suggested `forge test` command, code viewer, and downloadable bundle.
- Local and Docker Foundry runner planning with a Node execution package, explicit command preview, and raw output capture boundaries.
- Foundry results parsing from pasted or uploaded raw output, including invariant pass/fail status, counterexample or sequence text, weak handler signals, and evidence updates in the ledger.
- Audit packet exports for the assurance report, ledger JSON, assumption debt, protocol map, approved properties, Foundry scaffold bundle, and audit prep focus.
- No-LLM template mode as a first-class path, with structured local and optional hosted LLM claim boundaries that cannot bypass human review.
- Deterministic release-blocker evals for claim extraction, unsupported structured claims, property coverage, weak invariants, assumption generation, Foundry parser fixtures, audit packet completeness, and demo schema validity.
- ERC4626 demo assets and a completed demo load path for showing claims, invariants, assumption debt, parsed fuzz output, the final ledger, and export prep.

Out of scope for the MVP:

- Claims that a protocol is safe or vulnerability-free.
- Hosted sandbox execution.
- Automatic formal proof generation.
- Full arbitrary DeFi coverage beyond ERC4626 and vault-like secure cores.
- Mandatory paid LLM API or mandatory GitHub App integration.

Deferred scope and next expansion candidates are tracked in `docs/deferred-scope.md`.

## Current Implementation Metrics

### Product Surface

| Metric | Current state |
|---|---|
| npm workspaces | 8: web, shared types, analyzer, property engine, harness generator, verification runner, result parser, evals |
| Workspace boards | 9: Project, Protocol Map, Intent Board, Invariant Board, Assumption Debt, Ledger, Harness, Results, Export |
| Verification levels | 10 modeled, with 8 MVP ledger levels surfaced |
| Assumption statuses | 8 |
| Skeptic statuses | 6 |
| Generated Foundry scaffold artifacts | 7 files under `test/invariants/...` |

### Quality Metrics

| Metric | Score or count | Measurement |
|---|---:|---|
| Unit and eval assertions | 64 passing | `npm test` |
| Browser E2E checks | 6 passing | `npm run test:e2e` on desktop and mobile Chrome projects |
| Deterministic release-blocker eval cases | 8 / 8 passing | `npm run eval` |
| Deterministic eval fixture accuracy | 100% | 8 passed release-blocker fixture cases / 8 defined cases |
| Repo validation gates | 4 / 4 passing | lint, typecheck, test, production build |
| Foundry generated-harness checks | 2 passing modes | scaffold compile smoke and wired offline fixture execution when local `forge` is available |

The eval score is a deterministic fixture score for the current release-blocker suite. ProofBoard does not yet report a model-backed LLM accuracy benchmark over real protocol corpora.

## Feature Map

### Workspace UI

The web app in `apps/web` is the main ProofBoard surface. It provides project intake, demo workspace loading, board navigation, editable protocol notes, Solidity paste input, and board-specific review workflows.

### Shared Data Model

`packages/shared-types` defines the structured workspace model for sources, protocol maps, contracts, functions, state variables, events, modifiers, external calls, claims, properties, assumptions, verification runs, evidence, and audit packets.

### Protocol Analyzer

`packages/analyzer` provides deterministic Solidity source analysis for the MVP. It is intentionally approximate and surfaces parser warnings instead of hiding limitations.

### Property Engine

`packages/property-engine` generates template-based ERC4626 claims, properties, token assumptions, property-to-assumption links, and skeptic review findings. It also validates structured local or hosted LLM claim payloads and accepts insufficient-evidence refusals. Generated claims and properties never become approved or proven automatically.

### Harness Generator

`packages/harness-generator` emits Foundry scaffold code organized like:

```text
test/invariants/ProofboardVaultInvariant.t.sol
test/invariants/handlers/VaultHandler.sol
test/invariants/actors/VaultActors.sol
test/invariants/mocks/MockERC20.sol
test/invariants/mocks/FeeOnTransferToken.sol
test/invariants/mocks/RebasingToken.sol
test/invariants/README.md
```

Generated harnesses are traceable to selected ProofBoard property ids. They are scaffold code, not proof of safety; teams must wire constructors, handlers, actor roles, and protocol-specific assertions before treating Foundry output as verification evidence.

### Results And Audit Exports

`packages/verification-runner` plans local or Docker Foundry commands for generated harnesses and can execute them from Node-based workflows. The web Results board exposes the command plan and evidence boundary, while `packages/result-parser` preserves raw Foundry output and extracts invariant pass/fail lines, failing test names, counterexample or sequence text, and weak handler warnings. Parsed evidence is attached to linked properties, and the Export board produces a separated audit packet for claims, properties, evidence, assumptions, protocol map data, and suggested audit focus.

### Evaluations And Demo

`evals` runs deterministic release-blocker checks before ProofBoard expands claim, property, parser, or export behavior. `examples/erc4626-vault` provides the demo vault, protocol notes, expected claims, reviewed claim state, generated invariant examples, assumption debt, sample Foundry output, final ledger fixture, and export preview used for the MVP walkthrough.

## Repository Layout

```text
apps/web/                    Web workspace UI
packages/analyzer/           Solidity and project analysis
packages/property-engine/    ERC4626 property and assumption templates
packages/harness-generator/  Foundry invariant harness generation
packages/verification-runner/ Local and Docker Foundry run planning
packages/result-parser/      Foundry output parsing and ledger updates
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

Run validation:

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

Run a package-specific test:

```bash
npm --workspace @proofboard/harness-generator run test
```

Run release-blocker evals:

```bash
npm run eval
```

Testing strategy and remaining high-value gates are tracked in `docs/testing.md`. Current coverage includes desktop and mobile Playwright workflows, generated Foundry scaffold compilation, and wired generated-harness execution when `forge` is available locally.

## Evidence Boundaries

ProofBoard uses evidence labels instead of vague confidence claims. Human-approved intent, generated tests, fuzz pass/fail output, weak or vacuous checks, accepted assumptions, and out-of-scope areas remain separate in the UI and data model.

The product should help teams prepare stronger verification work and audits, not replace expert review.
