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
