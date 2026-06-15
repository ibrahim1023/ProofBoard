# Deferred Scope

This note captures work that is intentionally outside the current ProofBoard MVP so the next implementation discussion starts from an explicit boundary.

## Current Boundary

ProofBoard's deepest workflow remains ERC4626 and vault-like secure cores. Staking, lending, AMM, bridge, and governance intake add protocol-aware flow mapping, claim templates, property generation, and assumption debt. Repository intake supports bounded public GitHub imports and local source selection, while collaboration supports review history and distinct-reviewer approval quorum. A chain-agnostic assurance model and EVM deployment inventory preserve runtime, target, chain, proxy, oracle, bridge, and explorer context. Generated harness execution and result interpretation remain Foundry-oriented and require target-specific wiring for every protocol family.

The MVP does not claim that a protocol is safe or vulnerability-free. It tracks evidence and unresolved assumptions.

## Explicitly Out Of Scope For The MVP

- Full arbitrary DeFi protocol support beyond the implemented ERC4626, staking, lending, AMM, bridge, and governance secure-core templates.
- Live-chain validation of deployment bytecode, proxy slots, administrators, oracle configuration, or bridge configuration.
- Solana intake, property generation, execution, evidence parsing, and export parity.
- Hosted sandbox execution.
- Automatic formal proof generation.
- Mandatory paid LLM API access.
- Mandatory GitHub App integration.

## Remaining Product Expansion Candidates

These require product and threat-model discussion before implementation because they change ProofBoard's supported assurance surface:

- Authenticated private-repository and GitHub App workflows beyond bounded public-repository import.
- Persistent multi-user storage, identity-provider integration, notifications, and concurrent editing.

## Still Non-Goals Unless Positioning Changes

- Reframing ProofBoard as an AI auditor or generic vulnerability scanner.
- Treating AI-generated claims as approved protocol intent without human review.
- Treating generated harnesses or passing fuzz runs as proofs of safety.

## Discussion Order

For the next scope discussion, decide in this order:

1. Define the Solana intake and account-model boundary without weakening evidence labels.
2. Select reviewable Solana test, fuzzing, and symbolic backends.
3. Build a bounded token-vault fixture only after the data model and export boundary are validated.
