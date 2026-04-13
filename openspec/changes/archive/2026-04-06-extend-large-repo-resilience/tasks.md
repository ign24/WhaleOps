## 1. Per-tool output limits in _guard_tool_outputs

- [x] 1.1 Add `TRUNCATION_MARKER = "[OUTPUT TRUNCATED:"` constant in `safe_tool_calling_agent.py` (or the module containing `_guard_tool_outputs`) to make the marker stable and co-located
- [x] 1.2 Extend `_guard_tool_outputs` signature to accept `per_tool_max_chars: dict[str, int] | None = None`; resolve per-tool limit before applying global cap; include `limit_source` field in the `tool_output_truncated` trace event
- [x] 1.3 Add `per_tool_max_chars: dict[str, int]` field to `SafeToolCallAgentWorkflowConfig` with default `{"directory_tree": 5000, "fs_tools__directory_tree": 5000}`
- [x] 1.4 Update `SafeToolCallAgentGraph.__init__` and all call sites of `_guard_tool_outputs` to pass `per_tool_max_chars` from config
- [x] 1.5 Add unit tests: per-tool limit applied when name matches, global fallback when name absent, `None` per-tool config unchanged behavior, `limit_source` field in trace event for both cases

## 2. Config defaults

- [x] 2.1 Add `per_tool_max_chars` under each mode's agent config in `config.yml` with default values `{"directory_tree": 5000, "fs_tools__directory_tree": 5000}`

## 3. Prompt updates for directory_tree depth guidance

- [x] 3.1 Update `<directory_tree_policy>` section in `src/cognitive_code_agent/prompts/system/analyze.md` to require `maxDepth: 3` by default and `maxDepth: 2` when repo was cloned shallow
- [x] 3.2 Update `<directory_tree_policy>` section in `src/cognitive_code_agent/prompts/system/execute.md` with the same depth guidance

## 4. Context-reduction retry on SERVER_ERROR

- [x] 4.1 In the `SERVER_ERROR` branch of `run_and_stream`, add logic to detect whether the last ToolMessage in state ends with `TRUNCATION_MARKER`; if so, halve its content and retry the LLM call once (no backoff delay)
- [x] 4.2 Emit `server_error_context_reduction` trace event with `original_chars`, `reduced_chars`, and `tool_name` fields before the retry
- [x] 4.3 If the context-reduction retry succeeds, continue the loop normally; if it also fails, fall through to the existing exponential backoff loop with the halved content in state
- [x] 4.4 Add unit tests: truncated message detected → halved → retry succeeds → loop continues, truncated message detected → halved → retry fails → escalates to backoff, non-truncated SERVER_ERROR → skips context-reduction → goes to backoff directly

## 5. Verification

- [x] 5.1 Run full test suite (`uv run python -m pytest -x`) and fix any regressions
- [x] 5.2 Run linter (`uv run ruff check . && uv run ruff format --check .`)
- [ ] 5.3 Manual smoke test: confirm directory_tree output on a large repo is capped at 5000 chars in the trace log
- [ ] 5.4 Verify `tool_output_truncated` events include `limit_source` field in file tracer output
