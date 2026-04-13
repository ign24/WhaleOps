## 1. Deterministic failure policy core

- [x] 1.1 Add a centralized failure taxonomy and classifier in `safe_tool_calling_agent.py` for recursion, timeout, validation, memory-degraded, evidence-insufficient, and unknown-runtime outcomes.
- [x] 1.2 Implement policy mapping table (class -> action) with deterministic behavior for retry/no-retry, replan, and partial finalization.
- [x] 1.3 Add a bounded recovery pass (max one scoped retry) for recoverable classes and ensure no second retry occurs in the same request.

## 2. Loop guard and budget protection

- [x] 2.1 Implement equivalent tool-call normalization and keying (tool name + normalized args) for per-request tracking.
- [x] 2.2 Add loop-guard threshold checks that block repeated equivalent calls and force replan or partial finalization.
- [x] 2.3 Emit structured loop-guard trace events with tool name, threshold, normalized key hash, and chosen action.

## 3. Structured partial response and evidence gate

- [x] 3.1 Implement structured partial-response contract sections (`Verified`, `Unverified`, `Blocked By`, `Next Steps`) for exhausted recovery paths.
- [x] 3.2 Add evidence-gate validator for security/audit synthesis requiring path/line, snippet/context, and source tool.
- [x] 3.3 Ensure non-evidenced findings are labeled `unconfirmed` and include deterministic verification next steps.

## 4. Memory and instruction hierarchy alignment

- [x] 4.1 Update base prompt instruction-priority contract to include runtime execution controls precedence.
- [x] 4.2 Add bounded request-local recovery context integration (failed attempts/completed checks) as non-directive context during recovery.
- [x] 4.3 Ensure recovery context usage preserves memory-policy invariants (informational only, no directive override).

## 5. Observability, tests, and rollout safety

- [x] 5.1 Add trace events/counters for fallback activation, recovery success/failure, partial-output rate, and evidence-gate downgrades.
- [x] 5.2 Add unit tests for each failure class transition, bounded retry behavior, and loop-guard blocking.
- [x] 5.3 Add integration tests for long analysis requests demonstrating graceful continuation after recursion/timeout and evidence-safe synthesis.
- [x] 5.4 Run quality gates (`uv run ruff check .`, `uv run ruff format --check .`, `uv run pytest -x`) and document rollout/rollback toggles.
