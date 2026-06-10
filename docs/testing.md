# Testing

ProofBoard testing should protect the evidence boundary before adding broader protocol coverage.

## Current Automated Coverage

From the repository root:

```bash
npm test
npm run test:e2e
npm run test:ollama
npm run eval:ollama
npm run eval
npm run lint
npm run typecheck
npm run build
```

Current automated checks cover:

- shared schema validation and workspace claim/property/assumption/evidence link integrity
- Solidity analyzer extraction, inheritance arguments, naming variants, immutable state, unusual token calls, and explicit unsupported-syntax warnings
- property templates, skeptic checks, assumption linking, structured LLM claim refusal gates, and mocked Ollama adapter responses
- opt-in live Ollama proposal/refusal smoke coverage, gated by `OLLAMA_SMOKE=1` and local model availability
- strict model-backed Ollama evaluation for schema validity, source grounding, refusal accuracy, usefulness, concept coverage, latency, and token usage
- Foundry harness artifact paths, traceability, and a generated scaffold compile smoke when `forge` is available
- wired generated-harness execution against a local target-vault Foundry fixture, including deposit, withdraw, donation, and accounting assertions, when `forge` is available
- Foundry output pass/fail, counterexample, parser-error, weak-handler, and unlinked-invariant handling
- streamed Foundry stdout/stderr, cancellation status, and partial-output preservation
- web board workflows including intake, review, harness visibility, Results parsing, Ledger updates, Export artifacts, and completed demo state
- public-demo acceptance checks for weak invariants, unresolved assumptions, donation/inflation concern visibility, parsed Foundry evidence, and separated exports
- Playwright E2E workflows on desktop and mobile Chrome for project intake, browser navigation, Foundry log upload, parsed ledger evidence, completed public demo, harness download, and audit packet download
- ERC4626 fixture shapes covering fee controls, strategy liquidity assumptions, donation-sensitive token calls, donation/inflation templates, and vault-like sources without explicit ERC4626 inheritance
- deterministic release-blocker eval fixtures for claim, property, assumption, result-parser, audit-packet, and demo schema behavior

## Current Scorecard

### Automated Test Counts

| Surface | Automated checks | Command |
|---|---:|---|
| Web component, API, export, and demo tests | 37 | `npm test` |
| Shared schema and link validation | 7 | `npm test` |
| Solidity analyzer fixtures | 10 | `npm test` |
| ERC4626 property-engine fixtures | 10 | `npm test` |
| Foundry harness-generator fixtures | 11 | `npm test` |
| Foundry verification-runner fixtures | 9 | `npm test` |
| Foundry result-parser fixtures | 8 | `npm test` |
| Deterministic eval assertions | 8 | `npm test` and `npm run eval` |
| Browser E2E checks | 12 | `npm run test:e2e` |

`npm test` currently covers 100 web, API, package, runner, parser, and eval assertions. Browser E2E checks are listed separately because Playwright runs them against a local production Next server.

### Eval And Validation Metrics

| Metric | Current score | Notes |
|---|---:|---|
| Release-blocker dataset case pass rate | 8 / 8 | Deterministic cases defined in `evals/src/datasets.ts` |
| Deterministic fixture accuracy | 100% | 8 passed release-blocker cases divided by 8 defined cases |
| Validation gates | 4 / 4 | `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` |
| Browser workflow projects | 2 / 2 | Desktop Chrome and mobile Chrome projects |
| Model-backed LLM benchmark accuracy | Not measured | MVP validates structured claim boundaries and deterministic templates only |

### Opt-In Ollama Smoke

`npm run test:ollama` probes `OLLAMA_BASE_URL` (default `http://127.0.0.1:11434`) for `OLLAMA_MODEL` (default `llama3.1:8b`). If available, it checks a source-backed proposal and an unsupported-input refusal. The run reports model, prompt version, dataset version, date, latency, and Ollama token metrics. It is not part of deterministic release gates and is not a quality benchmark.

`npm run eval:ollama` is the stricter model-backed suite. Unlike the smoke command, it fails when Ollama or the selected model is unavailable. It evaluates two source-backed ERC4626 cases and one refusal case, requires 100% schema validity and refusal accuracy, at least 75% source grounding and usefulness, and at least 50% expected-concept coverage. Runtime varies by local hardware and is reported rather than used as a release threshold.

Latest local run on June 9, 2026 used `llama3.1:8b` with prompt `ollama-claims-v2` and dataset `erc4626-claims-v1`: 100% schema validity, 100% refusal accuracy, 80% source grounding, 100% usefulness, 50% concept coverage, and 10.25 seconds average latency across three cases. `qwen2.5-coder:7b` failed the proposal smoke by refusing analyzed Solidity evidence, so it is not the default model.

## Remaining High-Value Gates

Before claiming broader support, keep adding:

- realistic Foundry logs from multiple Forge output variants
- richer ERC4626 fixture families for adversarial strategy behavior and multi-contract source relationships
- browser E2E checks for future runner cancellation against a deliberately long-running local fixture
- repeat manual QA of product wording and exported packet contents before each public release
