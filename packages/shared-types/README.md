# Shared Types Package

Owns shared schemas and data contracts.

Initial entities:

- workspace
- versioned assurance model
- runtime-neutral assurance target
- verification backend descriptor
- EVM deployment and dependency metadata
- contract
- claim
- property
- assumption
- review record
- verification run
- evidence record
- audit packet export

The optional assurance model separates target identity, runtime family, source language, operations, and verification backends from Solidity-specific protocol-map records. Existing EVM workspaces remain valid without it.

EVM deployment records attach chain IDs, addresses, proxy/admin metadata, oracle feeds, bridge dependencies, and explorer references to assurance targets without treating those records as verification evidence.
