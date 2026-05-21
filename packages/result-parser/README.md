# Result Parser Package

Owns parsing verification output and updating evidence records.

Initial focus:

- pasted or uploaded Foundry output
- pass/fail status extraction
- failing test names
- counterexample summaries where available
- property and ledger status updates

`parseFoundryOutput` extracts invariant pass/fail lines, counterexample or sequence text, and weak harness signals from raw Foundry output. `applyFoundryOutput` preserves the raw run and turns linked invariant results into ledger evidence instead of treating a parser summary as proof.
