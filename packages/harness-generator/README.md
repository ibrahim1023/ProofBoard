# Harness Generator Package

Owns generated Foundry invariant test artifacts.

The generated Solidity is intentionally scaffold code. It keeps files traceable to selected ProofBoard property ids, but it does not prove safety until a human wires the target vault constructor, actor flows, assertions, and reviews the resulting Foundry evidence.

The package regression suite compiles the untouched scaffold and, when Forge is available, wires a local target vault fixture that executes deposit, withdraw, and donation actions before checking protocol-specific accounting assertions. It also executes the generated fee-on-transfer and rebasing mocks, including a naive-vault fixture that exposes the accounting mismatch caused by minting shares from requested assets instead of received assets. A strategy-aware fixture covers external gain/loss accounting and donation-driven zero-share rounding.

Expected outputs:

- invariant test contracts
- handler contracts
- actor models
- standard mock ERC20 tokens
- adversarial token mocks
- Solidity SMTChecker standard JSON input
- setup instructions
- suggested `forge test` commands
