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

Current implementation:

- template-based ERC4626 claim suggestions from a protocol map
- generated claims remain `AI-inferred`
- property generation only uses `Human-approved` or `Edited` claims
- generated properties start as `Draft` with `human_approved` verification level
- token behavior assumption templates for ERC20, fee-on-transfer, and rebasing risks
