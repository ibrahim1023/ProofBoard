# Verification Runner Package

Owns local and Docker Foundry run planning for generated ProofBoard harnesses.

The runner preserves ProofBoard's evidence boundary: it can produce a command plan and capture raw output, but the ledger should only update after the raw output is parsed and reviewed. A passed runner command is evidence, not proof of protocol safety.

The streaming runner emits stdout and stderr chunks as they arrive, supports abort signals for cancellation, and returns partial output with an explicit `cancelled` status.
