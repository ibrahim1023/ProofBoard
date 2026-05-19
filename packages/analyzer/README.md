# Analyzer Package

Owns static protocol mapping.

Expected responsibilities:

- parse Solidity files
- detect ERC4626 and vault-like contracts
- extract contracts, inheritance, functions, modifiers, state variables, events, external calls, and roles
- identify user flows and privileged flows
- emit structured protocol-map data
