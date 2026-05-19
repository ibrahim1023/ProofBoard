# Analyzer Package

Owns static protocol mapping.

Expected responsibilities:

- parse Solidity files
- detect ERC4626 and vault-like contracts
- extract contracts, inheritance, functions, modifiers, state variables, events, external calls, and roles
- identify user flows and privileged flows
- emit structured protocol-map data

Current implementation:

- `analyzeSoliditySource(source)` accepts a Solidity `SourceFile`
- detects contracts and inheritance
- extracts functions, state variables, events, modifiers, and external calls
- classifies ERC4626-style user flows and privileged functions
- detects role-like access controls
- detects basic token dependencies
- emits parser warnings because the current parser is intentionally approximate
