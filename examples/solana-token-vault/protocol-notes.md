# Token Vault Intent

- The vault PDA is derived from the literal `vault` seed and the mint public key.
- The vault-authority PDA is derived from the literal `authority` seed and the vault public key.
- Only the recorded admin may pause or unpause the vault.
- Deposits transfer the requested token amount into the vault token account and increase the user's recorded entitlement by the same amount.
- Withdrawals require the user signer, burn no third-party entitlement, and transfer no more than the user's recorded entitlement.
- Token CPIs must use the intended token program, mint, vault token account, user token account, and vault-authority signer seeds.
- Paused vaults reject deposits and withdrawals without changing state.
- Closing a user position is only valid after its entitlement reaches zero.
- Integer accounting uses token base units; no share conversion is implemented in this bounded fixture.
- Upgrade authority and deployed program metadata remain unresolved until supplied from a real deployment.
