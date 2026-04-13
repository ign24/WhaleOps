## 1. Compaction message-pairing fix

- [x] 1.1 Add `_find_pair_boundary(messages, retain_recent)` helper in `memory/working.py` that walks backward from the naive boundary and expands it to avoid splitting tool call/result pairs, capped at `retain_recent * 2`
- [x] 1.2 Update `compress_state` to call `_find_pair_boundary` before splitting middle/recent, replacing the hardcoded `-retain_recent` slice
- [x] 1.3 Emit `compaction_boundary_adjusted` trace event when boundary is moved, with `original`, `adjusted`, and `reason` fields
- [x] 1.4 Emit `compaction_boundary_capped` trace event when expansion hits the cap
- [x] 1.5 Add unit tests: pair split on ToolMessage at boundary, pair split on AIMessage at boundary, no split (no change), expansion cap, multiple pairs at boundary

## 2. repair_message_history utility

- [x] 2.1 Implement `repair_message_history(messages)` in `memory/working.py` that removes orphaned ToolMessages and strips orphaned tool_calls entries from AIMessages, returns `(repaired_list, was_changed: bool)`
- [x] 2.2 Add unit tests: orphaned ToolMessage removed, orphaned tool_calls entry stripped, AIMessage with one valid + one orphaned call (only orphan removed), no orphans (no change, was_changed=False)

## 3. TOOL_CALL_ID_MISMATCH error classification and recovery

- [x] 3.1 Add `TOOL_CALL_ID_MISMATCH` to the failure taxonomy enum/constants in `safe_tool_calling_agent.py`
- [x] 3.2 Update the error classification logic to detect HTTP 400 + `BadRequestError` + `"Unexpected tool call id"` in message before falling through to `UNKNOWN_RUNTIME`
- [x] 3.3 Add repair-and-retry handler: on `TOOL_CALL_ID_MISMATCH`, call `repair_message_history`, update state, retry LLM call once; if repair made no change or retry fails, escalate to `UNKNOWN_RUNTIME`
- [x] 3.4 Add unit tests: classification of mismatch error, classification of unrelated 400 as UNKNOWN_RUNTIME, repair-and-retry succeeds, repair returns no change → escalates, retry fails → escalates

## 4. DEGRADED function detection and blacklist

- [x] 4.1 Add `_degraded_function_ids: set[str]` as a request-scoped attribute on `SafeToolCallAgentGraph` (initialized empty per request)
- [x] 4.2 Add `DEGRADED_FUNCTION` to the failure taxonomy enum/constants
- [x] 4.3 Update error classification to detect HTTP 400 + `"DEGRADED function cannot be invoked"` and extract the function ID
- [x] 4.4 On `DEGRADED_FUNCTION` detection, add function ID to `_degraded_function_ids` and emit `function_degraded` trace event
- [x] 4.5 Update the `ainvoke` fallback path to check `_degraded_function_ids` before attempting remote invocation; skip to in-process execution if blacklisted

## 5. spawn_agent DEGRADED fallback

- [x] 5.1 Update `spawn_agent` tool implementation to catch DEGRADED function errors and add to `_degraded_function_ids`
- [x] 5.2 Add pre-call check in `spawn_agent`: if target function ID is in `_degraded_function_ids`, skip remote call and go directly to local `SafeToolCallAgentGraph` execution
- [x] 5.3 Ensure local fallback execution uses the same `task`, `tools`, and `max_iterations` as the blocked remote call
- [x] 5.4 Emit `spawn_agent_degraded_fallback` trace event with `function_id` and `reason` (`detected` or `blacklisted`)
- [x] 5.5 Add unit tests: DEGRADED caught → local execution runs → result returned, blacklisted function → remote skipped → local runs, local result shape matches remote result shape

## 6. Verification

- [x] 6.1 Run full test suite (`uv run pytest -x`) and fix any regressions
- [x] 6.2 Run linter (`uv run ruff check . && uv run ruff format --check .`)
- [ ] 6.3 Manual smoke test: trigger a request that would previously fail with `Unexpected tool call id` and confirm loop continues
- [ ] 6.4 Verify trace events appear in the file tracer output for all new event types
