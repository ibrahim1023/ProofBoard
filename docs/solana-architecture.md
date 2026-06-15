# Solana Assurance Architecture

## Status

This document defines the proposed Solana intake and assurance boundary. It does not claim that ProofBoard currently analyzes, executes, or verifies Solana programs.

The existing chain-agnostic assurance model can represent a Solana program target with Rust sources and runtime-neutral claims, properties, assumptions, evidence, and verification backends. Solana support still requires a dedicated analyzer, property templates, execution adapters, result parsers, fixtures, and export parity.

## Why Solana Needs A Separate Intake Model

Solana programs are stateless executable accounts. Mutable protocol state lives in separate accounts, and the runtime controls account ownership, signer privileges, writable privileges, and cross-program invocation behavior. The assurance model therefore cannot treat a program as an EVM contract with renamed functions.

The Solana protocol map should make these records first-class:

- programs and declared program IDs
- instructions and instruction arguments
- account inputs for each instruction
- signer, writable, executable, owner, address, and custom account constraints
- account data types, discriminators, size, initialization, reallocation, and close behavior
- PDA seeds, bump handling, derivation program, and PDA signing use
- CPI targets, forwarded privileges, signer seeds, and trusted external programs
- token mint, token account, associated-token-account, mint-authority, and freeze-authority constraints
- program upgrade authority, ProgramData account, deployment slot, and immutability status

## Proposed Intake Sources

The first bounded intake should accept:

- `Anchor.toml`
- workspace and program `Cargo.toml` files
- Rust program sources under `programs/*/src`
- generated Anchor IDL JSON when available
- deployment metadata supplied by the user or captured from `solana program show`
- protocol notes and tests as supporting sources

The IDL is useful for instruction and account shape, but it is not sufficient evidence for source-level constraints, manual validation, CPI behavior, arithmetic, or lifecycle logic. ProofBoard should preserve whether each extracted fact came from Rust source, Anchor attributes, IDL, deployment metadata, tests, or user notes.

## Proposed Solana Protocol Map

### Program

- program ID and source location
- Anchor or native Rust classification
- instruction list
- account data types
- emitted events and custom errors
- declared external program dependencies
- upgrade authority status

### Instruction

- name and arguments
- source span
- required accounts in declaration order
- signer and writable requirements
- linked PDA, authority, token, and custom constraints
- CPI calls
- accounts created, reallocated, or closed
- arithmetic and asset-flow notes

### Account Requirement

- account name and expected type
- signer, writable, executable, optional, and unchecked status
- expected owner or fixed address
- `has_one` and custom constraint expressions
- token mint and authority relationships
- initialization payer and allocated space
- close recipient
- reallocation payer, size, and zeroing behavior

### PDA Definition

- target account
- seed expressions and their source
- bump source and whether the canonical bump is required
- derivation program
- instructions that validate the PDA
- CPIs where the PDA signs

### CPI Dependency

- called program and instruction when statically identifiable
- account privileges forwarded to the callee
- PDA signer seeds
- expected program ID or executable-account constraint
- trust assumption when the target is configurable or unchecked

### Deployment Record

- cluster and program ID
- loader and ProgramData account
- upgrade authority or immutable status
- last deployed slot
- verifiable-build or binary reference when available

Deployment metadata remains review context until a tool retrieves and compares live-chain state.

## Extraction Strategy

The initial analyzer should use structured Rust syntax and Anchor IDL parsing rather than regular expressions.

1. Discover Anchor workspace and program crates.
2. Parse declared program IDs and instruction modules.
3. Parse `#[derive(Accounts)]` structures and account attributes.
4. Resolve each instruction `Context<T>` to its ordered account requirements.
5. Extract account data structures and lifecycle operations.
6. Extract PDA seeds, bumps, authority relationships, and `invoke_signed` use.
7. Build a CPI dependency graph from Anchor CPI helpers and native invocation calls.
8. Preserve unresolved macros, dynamic program IDs, unchecked accounts, and unsupported syntax as parser warnings.
9. Merge IDL and deployment metadata without allowing either to overwrite contradictory source facts silently.

## Required Assumption Debt

The analyzer and property engine should create explicit assumptions when they cannot establish:

- account ownership or discriminator validation
- signer or authority binding
- PDA seed completeness and canonical bump handling
- fixed CPI program identity
- token mint, token authority, or freeze authority constraints
- upgrade authority governance or immutability
- account initialization uniqueness
- close-recipient safety and reinitialization resistance
- reallocation size, payer, and zeroing safety
- rent or lamport balance expectations
- arithmetic bounds, decimals, and rounding behavior
- clock, epoch, sysvar, oracle, or external-program trust

## Evidence Boundary

Solana evidence must use the existing ProofBoard labels:

- extracted source and IDL facts are inferred
- approved claims remain human-approved intent
- generated tests or properties remain generated artifacts
- LiteSVM, Mollusk, Anchor, validator, fuzzing, symbolic, or formal results become executed evidence only after a parser preserves the command, backend, target, result, logs, and counterexample or failing account state
- passing tests do not imply proof of safety

Backend-specific result records should link to the Solana target and instruction or property IDs through the chain-agnostic assurance model.

## Staged Implementation

### Stage 1: Read-Only Intake

- accept Rust, TOML, IDL, and notes
- identify Anchor program crates and program IDs
- map instructions, account types, and basic account constraints
- export the Solana protocol map and parser warnings

### Stage 2: Authority And Dependency Analysis

- extract PDA derivations and signer use
- map CPI dependencies and privilege forwarding
- identify token authorities and configurable external programs
- capture supplied upgrade-authority metadata

### Stage 3: Property And Evidence Parity

- use the implemented Solana token-vault templates for custody, account ownership, authority binding, PDA integrity, CPI boundaries, rounding, account lifecycle, upgrade authority, and emergency controls
- generate backend-specific test scaffolds
- parse executed evidence into the verification ledger
- add Solana-aware audit packet sections

### Stage 4: Bounded Fixture

Add a small Anchor token-vault fixture only after Stages 1 through 3 preserve the same separation between intent, assumptions, generated properties, and executed evidence as the ERC4626 workflow.

## Release Gate

Do not advertise Solana support until all of the following work for the bounded token-vault fixture:

- source and IDL intake
- account, PDA, authority, CPI, lifecycle, and upgrade mapping
- editable and reviewable claims
- Solana-specific assumptions and properties
- at least one executable backend
- parsed result evidence with failure detail
- separated audit exports

## Primary References

- [Solana accounts](https://solana.com/docs/core/accounts)
- [Solana programs](https://solana.com/docs/core/programs)
- [Program Derived Addresses](https://solana.com/docs/core/pda)
- [Cross-Program Invocation](https://solana.com/docs/core/cpi)
- [Deploying and managing programs](https://solana.com/docs/programs/deploying)
- [Anchor account constraints](https://www.anchor-lang.com/docs/references/account-constraints)
- [Anchor LiteSVM testing](https://www.anchor-lang.com/docs/testing/litesvm)
- [Anchor Mollusk testing](https://www.anchor-lang.com/docs/testing/mollusk)
