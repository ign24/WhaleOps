## 1. Subagent failure normalization

- [x] 1.1 Implement parser/adapter that converts delegated subagent runtime error payloads into deterministic failure classes.
- [x] 1.2 Add failure-source metadata (`failure_source`, `subagent_name`) to fallback trace events when failures originate from nested subagents.
- [x] 1.3 Ensure raw nested runtime error payloads are excluded from confirmed evidence synthesis paths.

## 2. Cross-agent deterministic recovery

- [x] 2.1 Add bounded escalation for recoverable nested failures (single scoped retry/replan only).
- [x] 2.2 Ensure exhausted nested recovery emits structured partial output with blocked scope tied to subagent source.
- [x] 2.3 Add configuration knobs for per-subagent recursion/escalation budgets in `config.yml`.

## 3. Loop guard expansion for delegated calls

- [x] 3.1 Extend loop-signature normalization to include delegation identity (`subagent_name`).
- [x] 3.2 Enforce loop guard for repeated equivalent delegated calls and trigger deterministic escalation.
- [x] 3.3 Emit delegated loop-guard telemetry with hashed signature and subagent metadata.

## 4. Tests and rollout verification

- [x] 4.1 Add unit tests for subagent failure normalization and class mapping.
- [x] 4.2 Add integration tests for nested `reader_agent` recursion/timeout scenarios verifying graceful continuation.
- [x] 4.3 Run full quality gates (`uv run ruff check .`, `uv run ruff format --check .`, `uv run -- python -m pytest -x`).
