## Why

When the streaming path fails (whether from a transient 500 "Inference connection error" or a recursion limit), the ainvoke fallback either gets no retries at all (fails on first 500 and yields a partial response immediately) or repeats the same full-budget task that just exhausted the recursion limit — guaranteeing another failure. Both paths produce an unhelpful "Execution budget was exhausted" message for the user.

## What Changes

- Add exponential backoff retry to the ainvoke fallback exception handler for `SERVER_ERROR` and `RATE_LIMITED`, matching the parity already in the streaming path (up to `_RATE_LIMIT_MAX_RETRIES` attempts).
- Detect when the stream failure was `RECURSION_LIMIT` (via `recovery_notes`) and switch the ainvoke fallback to a **synthesis-only** mode: a compact prompt asking for a summary of partial findings, with a reduced `recursion_limit` of 8–12 iterations, instead of re-running the full analysis from scratch.

## Capabilities

### New Capabilities
- `ainvoke-server-error-retry`: Retry logic in the ainvoke fallback for transient 500/429 errors, with exponential backoff, matching the streaming path.
- `ainvoke-recursion-limit-synthesis`: When the stream exhausted its recursion budget, the ainvoke fallback uses a synthesis-only prompt and a capped recursion limit instead of repeating the full task.

### Modified Capabilities

## Impact

- `src/cognitive_code_agent/agents/safe_tool_calling_agent.py` — ainvoke fallback exception handler in `run_and_stream`, `_build_recovery_invoke_state` or a new helper for synthesis-mode state.
- No new dependencies. No config changes required (uses existing `_RATE_LIMIT_MAX_RETRIES` and `_rate_limit_backoff_delay`).
