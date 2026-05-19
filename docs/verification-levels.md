# Verification Levels

ProofBoard uses explicit verification levels instead of vague confidence labels.

| Level | Meaning |
|---|---|
| `claimed_only` | Mentioned in docs or inferred, but not checked. |
| `ai_inferred` | Suggested by AI, not approved. |
| `human_approved` | Approved as real protocol intent. |
| `test_generated` | Test or invariant generated. |
| `fuzzed_passed` | Fuzzer found no counterexample. |
| `fuzzed_failed` | Fuzzer found a violating sequence. |
| `symbolically_checked` | Checked with symbolic execution. |
| `formally_proven` | Proved with a formal verifier. |
| `weak_or_vacuous` | Existing check may not meaningfully prove anything. |
| `out_of_scope` | Known but intentionally not checked. |

## MVP Levels

The MVP should support:

- `claimed_only`
- `ai_inferred`
- `human_approved`
- `test_generated`
- `fuzzed_passed`
- `fuzzed_failed`
- `weak_or_vacuous`
- `out_of_scope`

## Product Rule

A passing test is not automatically strong evidence. The product must expose weak, vacuous, or assumption-heavy checks separately from meaningful verification evidence.
