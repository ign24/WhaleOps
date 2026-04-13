## Why

The `clone_repository` tool has a hardcoded 120-second timeout that causes failures on large repos (Django, Rails, etc.), and the agent has no way to choose a shallow clone even when git history is not needed. Combined with an unconstrained `reader_agent` that lacks decision criteria for file selection, analysis runs on large repos consistently time out or overflow context. Since Devstral 2-123B is a code expert, it should drive these decisions based on task requirements rather than having them hardcoded in infrastructure.

## What Changes

- `clone_repository` tool gains two new optional parameters: `shallow` (bool, default `False`) and `timeout_seconds` (int, default `120`) so the agent can calibrate both per request
- Timeout error response gains a `hint` field with actionable guidance (`"consider shallow=true for large repos"`) so Devstral can self-correct on retry
- `analyze.md` orchestrator prompt gains decision criteria (not rules) for clone strategy and sub-agent selection — Devstral assesses the task and chooses the right approach
- `reader_agent` system prompt gains decision criteria for file selection: how to prioritize and when to stop, based on task type

## Capabilities

### New Capabilities

- `shallow-clone-support`: Expose `shallow` and `timeout_seconds` parameters on `clone_repository`, include actionable hint in timeout error response
- `agent-driven-analysis-planning`: Decision criteria in `analyze.md` and `reader_agent` prompt so Devstral self-selects clone strategy, sub-agents, and file reading scope based on task type

### Modified Capabilities

- `tool-control-output-filtering`: Timeout error response shape changes — adds `hint` field (additive, non-breaking)

## Impact

- `src/cognitive_code_agent/tools/clone_tools.py` — new parameters, updated timeout error payload
- `src/cognitive_code_agent/prompts/system/analyze.md` — decision criteria section added
- `src/cognitive_code_agent/configs/config.yml` — reader_agent system_prompt updated with file selection criteria
- `tests/unit/tools/test_clone_tools.py` — new test cases for shallow and timeout_seconds parameters
- No breaking changes to existing callers (new params are optional with existing defaults)
