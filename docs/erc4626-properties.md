# ERC4626 Property Notes

The first ProofBoard MVP targets ERC4626-style vaults, simple staking vaults, and vault-like systems with deposits and withdrawals.

## Property Categories

1. Share accounting invariants
2. Deposit and mint consistency
3. Withdraw and redeem consistency
4. Total assets vs total supply consistency
5. Donation and inflation attack checks
6. Rounding edge cases
7. Access-control constraints
8. Pause and emergency behavior
9. Fee behavior
10. Token assumption checks

## Example Properties

Share accounting:

```text
A user's redeemable assets should be consistent with their share balance and the vault's exchange rate.
```

Deposit and mint consistency:

```text
For equivalent economic inputs, deposit and mint flows should produce consistent accounting outcomes within expected rounding bounds.
```

Withdraw and redeem consistency:

```text
For equivalent economic outputs, withdraw and redeem flows should burn consistent shares within expected rounding bounds.
```

Donation and inflation resistance:

```text
A direct token donation to the vault should not allow an attacker to unfairly inflate share value against later depositors.
```

Access control:

```text
Privileged functions should not allow the owner or admin to transfer user assets except through explicitly approved emergency or strategy flows.
```

Token behavior:

```text
The vault's accounting assumptions should be explicitly tested or marked out of scope for fee-on-transfer, rebasing, and reentrant tokens.
```

## Common Assumptions

- Underlying token behaves like a standard ERC20.
- Underlying token has no fee-on-transfer behavior.
- Underlying token does not rebase.
- Underlying token does not reenter.
- Admin keys are honest or constrained by explicit policy.
- Strategy integrations can return funds as expected.
- Decimals and rounding behavior are compatible with the vault accounting model.
