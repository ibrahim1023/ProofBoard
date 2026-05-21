# ExampleVault Protocol Notes

ExampleVault is an ERC4626-style vault with a single underlying ERC20 asset.

- Deposits and withdrawals should preserve share ownership and exchange-rate accounting.
- The owner can pause user-facing asset movement during an emergency.
- The owner can update a fee recipient, but the demo does not define fee charging behavior.
- Underlying token behavior remains an explicit assumption: standard ERC20 behavior, no fee-on-transfer loss, and no unexpected rebase.
- The demo is meant to produce reviewable claims, candidate invariants, Foundry scaffold evidence, and unresolved assumption debt.
