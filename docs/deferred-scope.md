# Deferred Scope

This note captures work that is intentionally outside the current ProofBoard MVP so the next implementation discussion starts from an explicit boundary.

## Current Boundary

ProofBoard's deepest workflow remains ERC4626 and vault-like secure cores. Staking, lending, and AMM intake now add protocol-aware flow mapping, claim templates, property generation, and assumption debt. Generated harness execution and result interpretation remain Foundry-oriented and require target-specific wiring for every protocol family.

The MVP does not claim that a protocol is safe or vulnerability-free. It tracks evidence and unresolved assumptions.

## Explicitly Out Of Scope For The MVP

- Full arbitrary DeFi protocol support beyond the implemented ERC4626, staking, lending, and AMM secure-core templates.
- Bridges, cross-chain messaging, ZK circuits, and multi-chain deployment assurance.
- Hosted sandbox execution.
- Automatic formal proof generation.
- Mandatory paid LLM API access.
- Mandatory GitHub App integration.
- Upgrade verification beyond simple role and privileged-flow detection.

## Strong Next Candidates

These are the most direct follow-ons because they extend workflows already described in the scope:

- Streaming runner output and cancellation controls for long-running Foundry jobs.
- Advanced verification integrations: Halmos, Echidna, Medusa, Solidity SMTChecker, Certora CVL skeleton export, and Scribble annotation export.
- Broader ERC4626 target fixtures and harness wiring for fees, strategies, donation or inflation sensitivity, and adversarial token behavior.
- Browser E2E automation for the current workspace before broadening protocol coverage.

## Remaining Product Expansion Candidates

These require product and threat-model discussion before implementation because they change ProofBoard's supported assurance surface:

- Bridge and cross-chain secure cores with message validity, replay protection, relayer trust, and finality assumptions.
- Upgrade and governance assurance beyond role detection, including timelocks, upgrade authorization, storage-layout risk, and emergency controls.
- Repository import and collaboration workflows, including GitHub intake, review history, and multi-user approval records.

## Still Non-Goals Unless Positioning Changes

- Reframing ProofBoard as an AI auditor or generic vulnerability scanner.
- Treating AI-generated claims as approved protocol intent without human review.
- Treating generated harnesses or passing fuzz runs as proofs of safety.

## Discussion Order

For the next scope discussion, decide in this order:

1. Whether to deepen the current ERC4626 path with E2E and real Foundry execution first.
2. Whether the first verification integration after Foundry should be symbolic, invariant-fuzzing, or proof-artifact export.
3. Whether the next protocol expansion should target bridges, governance and upgrades, or deeper executable harnesses for staking, lending, and AMMs.
