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
- normalizes inheritance constructor arguments
- recognizes common vault flow naming variants such as `depositAssets` and `withdrawAssets`
- extracts immutable and constant state declarations
- warns on interfaces, libraries, inline assembly, and low-level calls that require manual review
- emits parser warnings because the current parser is intentionally approximate
