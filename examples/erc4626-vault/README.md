# ERC4626 Vault Example

This directory contains the walkthrough fixture for ProofBoard's ERC4626 demo.

Use it to demonstrate the path from source and protocol notes to reviewed claims, generated invariants, parsed Foundry evidence, the final ledger, and audit packet export:

1. Paste `src/ExampleVault.sol` and use `protocol-notes.md` during intake.
2. Compare suggested claims against `expected-claims.json`.
3. Use `reviewed-claim-state.json`, `generated-invariants.md`, and `assumption-debt.md` to explain the human review gate and assumption debt.
4. Paste `foundry-output.log` into Results or load the completed demo workspace.
5. Compare the Ledger against `final-ledger.json`.
6. Use `audit-export-preview.md` with the Export board.

The fixture is intentionally small. It is not a safety claim about the example vault.
