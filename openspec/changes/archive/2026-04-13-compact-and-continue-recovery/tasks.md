## 1. Progress measurement

- [x] 1.1 Add `_measure_progress(messages, checkpoint_idx)` helper in `safe_tool_calling_agent.py` that returns True if any ToolMessage since checkpoint has `status != "error"` and `len(content) > 50`
- [x] 1.2 Add unit tests for `_measure_progress`: useful tool output returns True, error-only returns False, no new messages returns False, empty content returns False

## 2. CONTEXT_OVERFLOW policy change

- [x] 2.1 Change `FAILURE_POLICIES[FailureClass.CONTEXT_OVERFLOW]` to `retryable=True, action="compact_and_continue"`
- [x] 2.2 Update unit test `test_failure_policy_context_overflow_not_retryable` to verify retryable=True

## 3. Recovery loop config

- [x] 3.1 Add `max_recovery_rounds` field to `ModeConfig` with default value 3
- [x] 3.2 Add `max_recovery_rounds` to each mode in `config.yml` (analyze: 3, execute: 3, chat: 1, refactor: 3)
- [x] 3.3 Add unit test for `ModeConfig.from_dict` reading `max_recovery_rounds` and defaulting to 3

## 4. _RecoverableFailure sentinel

- [x] 4.1 Add `_RecoverableFailure` exception class with `failure_class` and `state` attributes
- [x] 4.2 Add `_is_compact_recoverable(failure_class, has_progress)` helper that returns True for RECURSION_LIMIT (always), CONTEXT_OVERFLOW (always), SERVER_ERROR (if progress), RATE_LIMITED (if progress)
- [x] 4.3 Add unit tests for `_is_compact_recoverable` covering all FailureClass values

## 5. Recovery loop implementation

- [x] 5.1 Refactor `_response_fn` to wrap the astream+ainvoke block in an outer `for recovery_round in range(max_recovery_rounds)` loop with checkpoint tracking
- [x] 5.2 On recoverable failure: call `_measure_progress`, if True call `compress_state` with round-appropriate `compaction_retain_recent` (4, 2, 1), reset `recursion_cfg` to original budget, continue loop
- [x] 5.3 On no-progress or max rounds exhausted: emit synthesis-only response using `_build_synthesis_invoke_state`
- [x] 5.4 Replace top-level `GraphRecursionError` handler with entry into the recovery loop (remove budget halving + single ainvoke attempt)
- [x] 5.5 Emit `recovery_round` trace event with round, progress_tool_count, messages_before_compact, messages_after_compact, retain_recent_used

## 6. Integration tests

- [x] 6.1 Add integration test: stream raises GraphRecursionError with progress in state → recovery loop compacts and retries → ainvoke succeeds on second round
- [x] 6.2 Add integration test: stream raises GraphRecursionError with no progress → synthesis-only fires immediately (no recovery loop)
- [x] 6.3 Add integration test: CONTEXT_OVERFLOW classified → recovery loop compacts and retries
- [x] 6.4 Add integration test: max_recovery_rounds=2 exhausted → synthesis emitted

## 7. Verification

- [ ] 7.1 Run full test suite (`uv run pytest -x`) and fix regressions
- [ ] 7.2 Run linter (`uv run ruff check . && uv run ruff format --check .`)
- [ ] 7.3 Verify existing fallback tests still pass (deterministic_fallback_policy, spawn_agent_integration)
