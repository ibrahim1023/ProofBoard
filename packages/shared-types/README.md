# Shared Types Package

Owns shared schemas and data contracts.

Initial entities:

- workspace
- versioned assurance model
- runtime-neutral assurance target
- verification backend descriptor
- contract
- claim
- property
- assumption
- review record
- verification run
- evidence record
- audit packet export

The optional assurance model separates target identity, runtime family, source language, operations, and verification backends from Solidity-specific protocol-map records. Existing EVM workspaces remain valid without it.
