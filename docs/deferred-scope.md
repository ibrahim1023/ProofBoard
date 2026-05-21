# Deferred Scope

This note captures work that is intentionally outside the current ProofBoard MVP so the next implementation discussion starts from an explicit boundary.

## Current Boundary

ProofBoard currently focuses on ERC4626 and vault-like secure cores. The implemented workflow is a reviewable assurance workspace: protocol mapping, claim review, candidate properties, assumption debt, Foundry harness generation, Foundry output parsing, verification evidence, and audit packet export.

The MVP does not claim that a protocol is safe or vulnerability-free. It tracks evidence and unresolved assumptions.

## Explicitly Out Of Scope For The MVP

- Full arbitrary DeFi protocol support beyond ERC4626 and vault-like systems.
- Lending protocols, AMMs, bridges, cross-chain messaging, ZK circuits, and multi-chain deployment assurance.
- Hosted sandbox execution or an automatic verification runner.
- Automatic formal proof generation.
- Mandatory paid LLM API access.
- Mandatory GitHub App integration.
- Upgrade verification beyond simple role and privileged-flow detection.

## Strong Next Candidates

These are the most direct follow-ons because they extend workflows already described in the scope:

- Local or Docker-based Foundry execution with captured output and ledger updates.
- Advanced verification integrations: Halmos, Echidna, Medusa, Solidity SMTChecker, Certora CVL skeleton export, and Scribble annotation export.
- Broader ERC4626 target fixtures and harness wiring for fees, strategies, donation or inflation sensitivity, and adversarial token behavior.
- Browser E2E automation for the current workspace before broadening protocol coverage.

## Product Expansion Candidates

These require product and threat-model discussion before implementation because they change ProofBoard's supported assurance surface:

- Lending-market secure cores such as collateral accounting, liquidation, oracle freshness, and bad-debt assumptions.
- AMM secure cores such as reserve accounting, swap invariants, fee accounting, and LP share behavior.
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
3. Whether protocol expansion should start with staking vaults, lending, AMMs, or governance and upgrade assurance.
