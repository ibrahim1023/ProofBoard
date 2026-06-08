# Public Demo

ProofBoard's public demo uses one ERC4626 workspace to show how protocol intent, assumptions, generated properties, and verification evidence remain separate.

The demo is a workflow demonstration. It is not an audit result, vulnerability report, formal proof, or claim that the example vault is safe.

## Start

From the Project board, select **Start completed demo**.

The completed fixture contains:

- human-approved and edited protocol intent
- AI-inferred donation/inflation concern awaiting review
- unresolved token and donation assumptions
- a passed invariant with an unreached-handler warning
- a failed pause invariant with a preserved counterexample
- generated audit-prep artifacts

## Walkthrough

1. **Intent Board**
   Show that withdrawal and pause claims have human-reviewed status while the donation/inflation claim remains AI-inferred. Generated concern is not approved intent.

2. **Invariant Board**
   Open the donation-sensitivity property and its first-depositor actor-model requirement. Explain that it is a candidate property without execution evidence.

3. **Assumption Debt**
   Show the unresolved rebase assumption and the donation-policy assumption marked `Needs invariant`. Point out owners, rationale, revisit dates, and mitigation.

4. **Results**
   Show the preserved Foundry output. The pause invariant fails with a counterexample, while the mint handler is reported as unreached.

5. **Ledger**
   Compare `fuzzed_failed`, `weak_or_vacuous`, and `ai_inferred` entries. Each row should retain its assumptions, evidence, risk, and next action.

6. **Export**
   Show that executive summary, approved intent, unresolved assumptions, verification evidence, failed/fuzzy evidence, auditor questions, and audit prep remain separate downloads.

## Acceptance Criteria

The public demo is ready only when:

- a weak or vacuous invariant signal is visible
- at least one unresolved or test-needed assumption is visible
- donation/inflation sensitivity is represented as a concern, not a finding
- parsed Foundry evidence is linked to properties
- failed evidence preserves its counterexample or sequence
- audit-prep artifacts can be downloaded separately
- the UI and exports state that readiness and passing fuzz output are not safety guarantees

Automated checks protect these criteria through `apps/web/lib/public-demo.test.ts` and the completed-demo Playwright workflow.

## Demo Boundaries

Do not say:

- ProofBoard audited the vault
- the vault is safe because one invariant passed
- the donation concern is a confirmed exploit
- generated properties are approved protocol intent

Say:

- ProofBoard preserved a weak-handler signal
- a human still needs to review the donation/inflation concern
- the failed pause invariant produced evidence requiring investigation
- unresolved assumptions remain part of the audit handoff
