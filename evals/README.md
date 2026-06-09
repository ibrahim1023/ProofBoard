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
- local-model schema validity, source grounding, refusal behavior, usefulness, and runtime metrics

Run the MVP eval suite from the repository root:

```bash
npm run eval
```

`src/datasets.ts` marks release-blocker cases explicitly. The deterministic evaluator suite covers template claim extraction, unsupported structured LLM claim rejection, ERC4626 property coverage, weak invariant checks, assumption generation, Foundry output fixtures under `fixtures/foundry/`, audit packet completeness, and demo workspace schema validity.

The optional model-backed suite is separate from release blockers:

```bash
npm run eval:ollama
```

It requires a running Ollama service. `OLLAMA_MODEL` selects an installed model; otherwise the evaluator prefers common Qwen, Llama, or DeepSeek coding/instruct models and falls back to the first installed model. The versioned dataset covers vault accounting claims, pause/admin claims, and unsupported-evidence refusal. Reports are written to `evals/results/latest-ollama-eval.json` and include model, prompt version, dataset version, run date, case scores, latency, and token metrics.

The latest measured passing baseline is `llama3.1:8b` with prompt `ollama-claims-v2`: 100% schema validity, 100% refusal accuracy, 80% source grounding, 100% usefulness, 50% concept coverage, and 10.25 seconds average latency. The accounting case met grounding/usefulness requirements but missed the stricter expected-concept groups, so broader claim coverage remains a quality target rather than a completed capability.

## Current Scorecard

| Signal | Current score | Source |
|---|---:|---|
| Release-blocker dataset cases | 8 | `src/datasets.ts` |
| Release-blocker dataset cases passing | 8 / 8 | `npm run eval` |
| Deterministic fixture accuracy | 100% | Passed release-blocker cases divided by defined release-blocker cases |
| Evaluator assertions | 8 | `src/evaluators.test.ts` |

### Release-Blocker Case Mix

| Eval category | Cases |
|---|---:|
| Claim extraction coverage | 1 |
| Unsupported or malformed claim rejection | 2 |
| ERC4626 property template coverage | 1 |
| Weak invariant rejection | 1 |
| Assumption generation | 1 |
| Foundry parser fixtures | 2 |

The score is a deterministic regression metric for the current fixtures. It is not a model benchmark, vulnerability-detection recall score, or protocol-safety claim. The audit packet, demo schema guard, and model-report scoring logic also run in the evaluator suite as assertions outside the counted release-blocker dataset cases. Live Ollama scores are reported separately and never replace deterministic release gates.
