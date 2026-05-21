# Testing

ProofBoard testing should protect the evidence boundary before adding broader protocol coverage.

## Current Automated Coverage

From the repository root:

```bash
npm test
npm run eval
npm run lint
npm run typecheck
npm run build
```

Current automated checks cover:

- shared schema validation and workspace claim/property/assumption/evidence link integrity
- Solidity analyzer extraction and explicit parser warning cases
- property templates, skeptic checks, assumption linking, and structured LLM claim refusal gates
- Foundry harness artifact paths, traceability, and a generated scaffold compile smoke when `forge` is available
- Foundry output pass/fail, counterexample, parser-error, weak-handler, and unlinked-invariant handling
- web board workflows including intake, review, harness visibility, Results parsing, Ledger updates, Export artifacts, and completed demo state
- deterministic release-blocker eval fixtures for claim, property, assumption, result-parser, audit-packet, and demo schema behavior

## Remaining High-Value Gates

The current repo does not yet have browser E2E automation or a real target-vault Foundry integration run. Before claiming broader support, add:

- Playwright flows for desktop and mobile board navigation, file upload, download actions, and empty/error states
- generated harness compilation and execution against wired ERC4626 fixture constructors and handlers, not only scaffold compilation
- additional ERC4626 fixtures for fees, strategies, donation/inflation sensitivity, non-standard naming, and unsupported Solidity shapes
- realistic Foundry logs from multiple Forge output variants
- manual QA of product wording and exported packet contents before a public demo
