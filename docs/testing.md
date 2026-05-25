# Testing

ProofBoard testing should protect the evidence boundary before adding broader protocol coverage.

## Current Automated Coverage

From the repository root:

```bash
npm test
npm run test:e2e
npm run eval
npm run lint
npm run typecheck
npm run build
```

Current automated checks cover:

- shared schema validation and workspace claim/property/assumption/evidence link integrity
- Solidity analyzer extraction and explicit parser warning cases
- property templates, skeptic checks, assumption linking, and structured LLM claim refusal gates
- Foundry harness artifact paths, traceability, and a generated scaffold compile smoke when `forge` is available
- wired generated-harness execution against a local target-vault Foundry fixture when `forge` is available
- Foundry output pass/fail, counterexample, parser-error, weak-handler, and unlinked-invariant handling
- web board workflows including intake, review, harness visibility, Results parsing, Ledger updates, Export artifacts, and completed demo state
- Playwright E2E workflows on desktop and mobile Chrome for project intake, browser navigation, Foundry log upload, parsed ledger evidence, harness download, and audit packet download
- ERC4626 fixture shapes covering fee controls, strategy liquidity assumptions, donation-sensitive token calls, donation/inflation templates, and vault-like sources without explicit ERC4626 inheritance
- deterministic release-blocker eval fixtures for claim, property, assumption, result-parser, audit-packet, and demo schema behavior

## Current Scorecard

### Automated Test Counts

| Surface | Automated checks | Command |
|---|---:|---|
| Web component and export tests | 15 | `npm test` |
| Shared schema and link validation | 6 | `npm test` |
| Solidity analyzer fixtures | 7 | `npm test` |
| ERC4626 property-engine fixtures | 10 | `npm test` |
| Foundry harness-generator fixtures | 4 | `npm test` |
| Foundry verification-runner fixtures | 4 | `npm test` |
| Foundry result-parser fixtures | 5 | `npm test` |
| Deterministic eval assertions | 7 | `npm test` and `npm run eval` |
| Browser E2E checks | 4 | `npm run test:e2e` |

`npm test` currently covers 58 web, package, runner, and eval assertions. Browser E2E checks are listed separately because Playwright runs them against a local production Next server.

### Eval And Validation Metrics

| Metric | Current score | Notes |
|---|---:|---|
| Release-blocker dataset case pass rate | 8 / 8 | Deterministic cases defined in `evals/src/datasets.ts` |
| Deterministic fixture accuracy | 100% | 8 passed release-blocker cases divided by 8 defined cases |
| Validation gates | 4 / 4 | `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` |
| Browser workflow projects | 2 / 2 | Desktop Chrome and mobile Chrome projects |
| Model-backed LLM benchmark accuracy | Not measured | MVP validates structured claim boundaries and deterministic templates only |

## Remaining High-Value Gates

Before claiming broader support, keep adding:

- realistic Foundry logs from multiple Forge output variants
- stronger generated harness fixtures with protocol-specific handlers and assertions beyond the wired constructor smoke
- richer ERC4626 fixture families for unsupported Solidity constructs, non-standard naming, and adversarial strategy behavior
- browser E2E checks for additional empty and error states as the UI surface expands
- manual QA of product wording and exported packet contents before a public demo
