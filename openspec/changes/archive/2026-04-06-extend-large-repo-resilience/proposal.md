## Why

The archived `large-repo-resilience` and `adaptive-clone-strategy` changes hardened the global tool output guard and added shallow clone support, but three gaps remain: the global 30K char cap is too permissive for `directory_tree` (home-assistant-core produces 3.2M chars, still 30K after truncation, which crashes devstral with 500 EngineCore), the `directory_tree_policy` prompt never mentions depth limits, and the `SERVER_ERROR` retry path resends the same oversized context that caused the crash in the first place.

## What Changes

- Add `per_tool_max_chars` configuration to `_guard_tool_outputs` so `directory_tree` is capped at 5,000 chars (independent of the global 30K guard).
- Update `directory_tree_policy` in `analyze.md` and `execute.md` to require `maxDepth: 3` by default, with explicit guidance to use `maxDepth: 2` when the repo was cloned shallow.
- Add context-reduction retry for `SERVER_ERROR`: when the failing turn has a `tool_output_truncated` event in the trace, halve the truncated output of the offending message and retry the LLM call once before escalating to partial finalization.

## Capabilities

### New Capabilities
- `per-tool-output-limits`: Per-tool char cap configuration in `_guard_tool_outputs`, with `directory_tree` defaulting to 5,000 chars.
- `server-error-context-reduction`: On `SERVER_ERROR` retry, detect whether a tool output was truncated in the previous turn and halve it before the retry, preventing identical context resubmission.

### Modified Capabilities
- `tool-control-output-filtering`: Existing spec covers global truncation; requirements change to add per-tool limits as a first-class configuration with per-tool trace events.
- `tool-loop-guard`: No requirement change — no modification needed.

## Impact

- `src/cognitive_code_agent/agents/safe_tool_calling_agent.py` — `_guard_tool_outputs` signature and logic, `SERVER_ERROR` retry path in `run_and_stream`, `SafeToolCallAgentWorkflowConfig` config field.
- `src/cognitive_code_agent/prompts/system/analyze.md` — `<directory_tree_policy>` section.
- `src/cognitive_code_agent/prompts/system/execute.md` — `<directory_tree_policy>` section.
- `src/cognitive_code_agent/configs/config.yml` — new `per_tool_max_chars` config values under each mode.
- No new external dependencies.
