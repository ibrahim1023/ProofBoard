# Harness Generator Package

Owns generated Foundry invariant test artifacts.

The generated Solidity is intentionally scaffold code. It keeps files traceable to selected ProofBoard property ids, but it does not prove safety until a human wires the target vault constructor, actor flows, assertions, and reviews the resulting Foundry evidence.

Expected outputs:

- invariant test contracts
- handler contracts
- actor models
- standard mock ERC20 tokens
- adversarial token mocks
- setup instructions
- suggested `forge test` commands
