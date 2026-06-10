# Property Engine Package

Owns claim, property, invariant, assumption, and skeptic templates.

Initial focus:

- ERC4626 share accounting
- deposit and mint consistency
- withdraw and redeem consistency
- donation and inflation scenarios
- rounding edge cases
- access control
- pause behavior
- token behavior assumptions

Expanded secure-core templates:

- staking principal, unstaking liquidity, and reward conservation
- lending collateralization, liquidation bounds, oracle freshness, debt conservation, and bad-debt policy
- AMM reserve synchronization, LP share accounting, swap invariants, and fee accounting

Current implementation:

- template-based ERC4626, staking, lending, and AMM claim suggestions from a protocol map
- generated claims remain `AI-inferred`
- structured local or hosted LLM claim payloads validate before they reach human review
- insufficient-evidence LLM responses can refuse unsupported claims
- property generation only uses `Human-approved` or `Edited` claims
- generated properties start as `Draft` with `human_approved` verification level
- domain and token assumption templates for ERC20 behavior, staking liquidity, reward funding, lending oracles and liquidations, and AMM reserve and fee policy
