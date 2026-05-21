# Evaluations

This directory holds deterministic regression datasets and release-blocker evaluators for AI-assisted ProofBoard behavior.

Recommended structure:

```text
evals/
  datasets/
  evaluators/
  rubrics/
  experiments/
  results/
```

Initial eval targets:

- claim extraction quality
- unsupported claim rejection
- ERC4626 property suggestion coverage
- weak or vacuous invariant detection
- assumption generation
- Foundry output parsing
- audit packet completeness

Run the MVP eval suite from the repository root:

```bash
npm run eval
```

`src/datasets.ts` marks release-blocker cases explicitly. The deterministic evaluator suite covers template claim extraction, unsupported structured LLM claim rejection, ERC4626 property coverage, weak invariant checks, assumption generation, Foundry output fixtures under `fixtures/foundry/`, audit packet completeness, and demo workspace schema validity.

## Current Scorecard

| Signal | Current score | Source |
|---|---:|---|
| Release-blocker dataset cases | 8 | `src/datasets.ts` |
| Release-blocker dataset cases passing | 8 / 8 | `npm run eval` |
| Deterministic fixture accuracy | 100% | Passed release-blocker cases divided by defined release-blocker cases |
| Evaluator assertions | 7 | `src/evaluators.test.ts` |

### Release-Blocker Case Mix

| Eval category | Cases |
|---|---:|
| Claim extraction coverage | 1 |
| Unsupported or malformed claim rejection | 2 |
| ERC4626 property template coverage | 1 |
| Weak invariant rejection | 1 |
| Assumption generation | 1 |
| Foundry parser fixtures | 2 |

The score is a deterministic regression metric for the current fixtures. It is not a model benchmark, vulnerability-detection recall score, or protocol-safety claim. The audit packet and demo schema guard also run in the evaluator suite as assertions outside the counted release-blocker dataset cases.
