# Solana Token Vault Fixture

This directory is a bounded review fixture for ProofBoard's proposed Solana assurance workflow.

It contains:

- `programs/token-vault/src/lib.rs`: small Anchor-style token-vault source covering initialization, deposit, withdrawal, pause, unpause, and close behavior.
- `idl/token_vault.json`: a minimal instruction and account-shape fixture.
- `protocol-notes.md`: intended authority, custody, rounding, CPI, lifecycle, and emergency behavior.
- `proofboard-workspace.json`: a chain-agnostic ProofBoard workspace snapshot with a Solana program target, approved claim, candidate property, assumptions, and a planned LiteSVM run.
- `expected-assurance.json`: expected Solana claim, property, and assumption template IDs.

The fixture is intentionally not a buildable Anchor workspace yet. It adds no Rust dependencies and produces no executed evidence. The planned LiteSVM run remains `not_run` until ProofBoard has an approved Solana execution adapter and result parser.

This fixture validates that non-EVM sources, targets, properties, assumptions, review records, and backend descriptors remain separate without weakening the ERC4626 workflow.
