## 1. Module-level constant and synthesis helper

- [x] 1.1 Add `_STREAM_FAILURE_RECURSION = "stream_failure:recursion_limit"` constant in `safe_tool_calling_agent.py` and replace the inline string in `recovery_notes.append(...)` with the constant
- [x] 1.2 Add `_SYNTHESIS_RECURSION_LIMIT = 12` constant for the capped recursion budget used in synthesis-only ainvoke
- [x] 1.3 Add `_build_synthesis_invoke_state(mode, messages)` helper that builds an invoke state with the synthesis instruction ("Summarize partial findings. Do not re-run tools.") and returns it alongside the `_SYNTHESIS_RECURSION_LIMIT` config

## 2. ainvoke retry for SERVER_ERROR and RATE_LIMITED

- [x] 2.1 Wrap the `await rt.graph.ainvoke(invoke_state, config=recursion_cfg)` call in a retry loop (`for attempt in range(_RATE_LIMIT_MAX_RETRIES)`); on `SERVER_ERROR` or `RATE_LIMITED`, emit `rate_limit_backoff` trace event, sleep with `_rate_limit_backoff_delay(attempt)`, and retry; on non-retryable class or final attempt, break to partial response
- [x] 2.2 Add unit tests: SERVER_ERROR on first attempt then success → response yielded, all attempts fail SERVER_ERROR → partial response emitted, UNKNOWN_RUNTIME → no retry (immediate partial), trace event emitted per retry attempt

## 3. Recursion-limit synthesis path in ainvoke fallback

- [x] 3.1 In the ainvoke fallback, before building `invoke_state`, check if `_STREAM_FAILURE_RECURSION in recovery_notes`; if so, call `_build_synthesis_invoke_state` and override `recursion_cfg` with `{"recursion_limit": _SYNTHESIS_RECURSION_LIMIT}`
- [x] 3.2 If synthesis ainvoke succeeds, yield the content normally; if it fails, yield partial response with `failure_class=RECURSION_LIMIT` and `blocked_by` indicating both the stream limit and synthesis failure
- [x] 3.3 Add unit tests: recursion-limit marker in recovery_notes → synthesis state used and small recursion_limit, no marker → normal state used, synthesis ainvoke succeeds → content yielded, synthesis ainvoke fails → partial response with RECURSION_LIMIT

## 4. Verification

- [x] 4.1 Run full test suite (`uv run python -m pytest -x`) and fix any regressions
- [x] 4.2 Run linter (`uv run ruff check . && uv run ruff format --check .`)
- [ ] 4.3 Manual smoke test: trigger an ainvoke 500 scenario and confirm retry attempts appear in trace log
- [ ] 4.4 Manual smoke test: trigger a recursion-limit failure and confirm synthesis path is used (small recursion_limit in trace, synthesis instruction visible)
