## 1. Tool Output Guard

- [x] 1.1 Add `_guard_tool_outputs(state, max_chars)` function to `safe_tool_calling_agent.py` that iterates `ToolMessage` entries in state and truncates content exceeding threshold
- [x] 1.2 Integrate guard call in `SafeToolCallAgentGraph.tool_node()` — invoke `_guard_tool_outputs` after `super().tool_node(state)` returns
- [x] 1.3 Add `tool_output_guard.max_chars` config field to `SafeToolCallAgentWorkflowConfig` with default 30000
- [x] 1.4 Write unit tests for `_guard_tool_outputs`: within-limit passthrough, single truncation, multiple tool calls, edge cases (empty content, non-string content)

## 2. Prompt Hardening

- [x] 2.1 Add `<directory_tree_policy>` section to `analyze.md` with excludePatterns list and reader_agent preference
- [x] 2.2 Add `<directory_tree_policy>` section to `refactor.md` with the same excludePatterns guidance
- [x] 2.3 Update `full_analysis_protocol` Phase 0 in `analyze.md` to explicitly forbid direct `fs_tools__directory_tree` calls and require `reader_agent`

## 3. Real Token Metrics

- [x] 3.1 Add `_extract_usage_metadata(state)` helper that reads `usage_metadata` from the last `AIMessage` in state
- [x] 3.2 Accumulate real token counts in the streaming loop after each `agent_node` cycle using `_extract_message_token` events or post-ainvoke state inspection
- [x] 3.3 Replace word-count estimation (lines 790-797) with accumulated real values, falling back to word-count when metadata is absent
- [x] 3.4 Write unit tests: metadata present, metadata absent (fallback), mixed turns, accumulation correctness

## 4. Structured Trace Events

- [x] 4.1 Add `_emit_trace_event(event_type, payload)` helper that writes a structured JSON line to the NAT file tracer
- [x] 4.2 Emit `tool_output_truncated` event from `_guard_tool_outputs` when truncation occurs
- [x] 4.3 Emit `context_overflow` event in the `BadRequestError` catch path (streaming fallback) and `GraphRecursionError` handler
- [x] 4.4 Emit `session_token_usage` event at session end (before final yield) with accumulated token counts, model, and mode
- [x] 4.5 Write unit tests for each event emission path

## 5. Integration Validation

- [x] 5.1 Run full test suite (`uv run pytest -x`) confirming no regressions (232 unit tests pass; 1 pre-existing e2e failure in shell_execute unrelated)
- [x] 5.2 Run `uv run ruff check . && uv run ruff format --check .` confirming lint compliance (all changed files clean; 1 pre-existing F541 in scripts/run_judge_eval.py unrelated)
- [x] 5.3 Manual smoke test: start the agent, run `/analyze` on a large cloned repo, verify no context overflow and truncation notice appears in response
- [x] 5.4 Verify JSONL traces contain new event types after a session
