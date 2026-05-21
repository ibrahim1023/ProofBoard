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
