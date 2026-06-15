# Solana Verification Backend Evaluation

## Decision

ProofBoard should implement Solana evidence support in layers:

1. LiteSVM as the first executable transaction-level backend.
2. Mollusk as the deterministic instruction and account-fixture backend.
3. Trident as the stateful fuzzing backend after deterministic fixtures work.
4. Anchor tests with `solana-test-validator` only for RPC or validator behavior that in-process backends do not model.
5. Certora Solana Prover as an optional formal tier, not a mandatory local workflow.

No backend result is a safety verdict. ProofBoard should only upgrade a property to executed evidence after preserving the backend, command, target, property mapping, configuration, result, logs, and reproducible failure material.

## Evaluation Criteria

Each backend was evaluated for:

- support for Anchor and Rust programs
- account, signer, PDA, CPI, token, and lifecycle scenarios
- deterministic local execution
- multi-instruction or stateful flows
- reproducible failure artifacts
- structured result parsing potential
- runtime fidelity
- setup and dependency cost
- suitability for local-first ProofBoard workflows

## Backend Matrix

| Backend | Best use | Evidence to preserve | Important boundary | Recommendation |
|---|---|---|---|---|
| LiteSVM | Fast transaction-level program and client tests | command, versions, program binary hash, transaction sequence, account snapshots, logs, error, compute budget | In-process VM is less like a real RPC node | First executable backend |
| Mollusk | Deterministic single-instruction and instruction-chain checks | instruction bytes, explicit input accounts, checks, resulting accounts, inner instructions, compute units, fixture | Minified SVM is not a validator; instruction chains are not equivalent to transactions | First fixture backend |
| Trident | Stateful, manually guided fuzzing across instruction flows | seed, campaign config, flow sequence, generated inputs, invariant failure, account state, corpus/regression artifact, coverage | Active development and generated campaigns still depend on human-authored invariants and flow strategy | Add after deterministic paths |
| Anchor plus test validator | RPC, validator, deployment, and client integration behavior | validator version/config, deployed program hash, transaction signatures, logs, account snapshots | Slower and less isolated; ordinary passing tests provide limited exploration | Use only for fidelity gaps |
| Certora Solana Prover | Bounded formal rules over Rust/Solana program behavior | rule/config, tool versions, assumptions, summaries/mocks, pass/fail, sanity result, counterexample trace, report reference | Requires specifications and modeling; cloud execution can upload source; counterexamples may be spurious under over-approximation | Optional formal tier |

## LiteSVM

LiteSVM embeds a Solana VM in Rust, TypeScript/JavaScript, or Python tests. It supports adding compiled programs, sending transactions, inspecting accounts, changing compute behavior, and controlling runtime state.

Use it first because it matches ProofBoard's local-first workflow and can exercise:

- initialization, deposit, withdrawal, pause, unpause, and close transactions
- signer substitution and missing signatures
- wrong mint, token account, owner, PDA, and program accounts
- multi-transaction user flows
- time or sysvar-dependent scenarios
- post-transaction account and token-balance assertions

Required parser output:

- transaction result and program error
- program logs
- instruction sequence
- signer set
- before and after account summaries
- linked property IDs
- replay command and fixture location

LiteSVM results should be labeled as VM-executed evidence, not validator or mainnet evidence.

## Mollusk

Mollusk directly executes a program ELF in a minified SVM environment with explicit account inputs. Its checks and fixture support fit ProofBoard's need for reviewable, deterministic evidence.

Use it for:

- one-instruction account-constraint failures
- exact account owner, lamport, data, and token-state deltas
- PDA signer and CPI checks
- compute-unit regression records
- serialized regression fixtures
- differential fixtures across program versions

ProofBoard must retain Mollusk's explicit account list because the backend does not load an AccountsDB. Instruction chains must not be labeled as transaction-equivalent evidence.

## Trident

Trident provides manually guided, stateful fuzzing with custom flows, invariants, coverage, and regression support.

Use it after the LiteSVM and Mollusk fixtures establish valid setup and expected state transitions. Initial campaigns should cover:

- repeated small deposits and rounding accumulation
- alternating users and authority substitution
- pause/unpause interleavings
- close or reinitialization attempts
- wrong CPI program and token-account substitution
- cross-vault PDA confusion
- deposit and withdrawal sequences near integer boundaries

ProofBoard should preserve the campaign seed, exact flow sequence, generated account/input values, invariant failure, and minimized or regression fixture. A run without a preserved seed or failing sequence is weak evidence.

## Anchor And Validator Tests

Anchor client tests backed by `solana-test-validator` remain useful when a scenario depends on:

- RPC methods or subscription behavior
- transaction loading and validator behavior
- deployment and program upgrade flows
- features unsupported by LiteSVM
- integration with external programs that are difficult to model in-process

These tests should not be the default backend because they are slower and ordinary example tests do not provide fuzz or formal coverage.

## Certora Solana Prover

The Certora Solana Prover verifies Rust Solana programs using CVLR rules and Solana-specific account helpers. It can produce pass/fail rule results, sanity checks, and counterexample traces.

ProofBoard should integrate it only after executable properties are stable. Each formal evidence record must include:

- CVLR rule and linked ProofBoard property
- assumptions, nondeterministic inputs, mocks, inlining, and summaries
- source or prebuilt verification mode
- prover and crate versions
- rule sanity result to detect vacuous proofs
- counterexample trace for failed rules
- private report reference or exported result artifact

The integration must warn that source configurations can upload source files to Certora's cloud and that counterexamples require feasibility review because over-approximation can produce spurious paths.

## Rejected As First Backend

- `solana-test-validator`: too heavy for the first deterministic local path.
- Trident: valuable, but fuzzing before deterministic setup fixtures makes failures harder to interpret and reproduce.
- Certora: requires specifications, modeling, and external service configuration; it cannot be the baseline local workflow.
- Hand-rolled SVM execution: existing backends already provide the runtime behavior, fixtures, and tooling ProofBoard needs.

## ProofBoard Evidence Contract

Every Solana verification run should preserve:

- backend ID, kind, version, and runtime family
- exact command and working directory
- target program ID or binary hash
- linked claim and property IDs
- fixture, seed, rule, or campaign identifier
- account and signer setup summary
- status: passed, failed, errored, or not run
- raw output and structured findings
- counterexample, failing sequence, or failing account-state delta
- explicit modeling limitations

Generated tests, fuzz campaigns, and formal rules remain generated artifacts until executed. Passing evidence remains scoped to the captured backend and model.

## Implementation Order

1. Define parser-neutral Solana run and failure fixtures using the existing verification backend descriptor.
2. Add LiteSVM scaffolding and result parsing for the bounded token vault.
3. Add Mollusk account fixtures for constraint and CPI failures.
4. Add a Trident campaign with preserved seed and regression sequence.
5. Add validator-backed tests only for identified fidelity gaps.
6. Add optional Certora CVLR skeleton export after property IDs stabilize.

## Primary References

- [Anchor testing overview](https://www.anchor-lang.com/docs/testing)
- [Anchor LiteSVM documentation](https://www.anchor-lang.com/docs/testing/litesvm)
- [LiteSVM documentation](https://www.litesvm.com/)
- [Anchor Mollusk documentation](https://www.anchor-lang.com/docs/testing/mollusk)
- [Mollusk repository](https://github.com/anza-xyz/mollusk)
- [Trident documentation](https://ackee.xyz/trident/docs/latest/)
- [Trident repository](https://github.com/Ackee-Blockchain/trident)
- [Certora Solana Prover](https://docs.certora.com/en/latest/docs/solana/index.html)
- [Certora Solana output and sanity checks](https://docs.certora.com/en/latest/docs/solana/output.html)
