# Web App

This directory contains the ProofBoard Next.js and React workspace.

Expected surfaces:

- landing page
- project upload screen
- protocol map
- intent board
- invariant board
- assumption debt board
- verification ledger
- generated harness screen
- results screen
- guided ERC4626 public demo with explicit acceptance criteria
- separated audit packet exports for executive review, approved intent, assumption debt, evidence, failed/fuzzy results, and auditor questions

Recommended stack:

- Next.js
- TypeScript
- CSS modules/global CSS for the current scaffold
- shadcn/ui, Monaco editor, and React Flow in later phases

Current implementation:

- project intake form
- protocol type selector
- Solidity paste area
- disabled repo zip upload placeholder
- seeded ERC4626 demo workspace
- navigation for all MVP boards
- interactive protocol map, intent board, invariant board, assumption debt, ledger, harness, results, and export views
- reviewer identity, claim/property comments, approval/edit/rejection history, and rejected-claim rationale
- parsed Foundry evidence, verification readiness, harness quality, and vacuity review
- Ollama-compatible local claim generation with schema validation, insufficient-evidence refusal handling, and mandatory human review

Local claim generation defaults to `http://127.0.0.1:11434` and model `llama3.1:8b`. Set `OLLAMA_BASE_URL` on the Next.js server to use another Ollama-compatible endpoint; the model can be changed from the Intent Board.

Run `npm run test:ollama` for the opt-in live smoke test. Set `OLLAMA_MODEL` when using another installed model. The smoke test probes local availability before checking one source-backed proposal and one insufficient-evidence refusal.
