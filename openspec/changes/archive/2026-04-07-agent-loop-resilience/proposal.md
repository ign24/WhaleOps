## Why

When the NAT remote function becomes DEGRADED mid-session (after tools like clone_repository have already succeeded), the agent produces zero useful output. The clone tool is not idempotent so retries fail, the `direct_execution_fallback` policy action is declared but never executed at the main agent level, and the ainvoke fallback is skipped entirely when stream detects DEGRADED. This causes complete session failure on transient platform issues that could otherwise be recovered from.

## What Changes

- Make `clone_repository` idempotent: detect existing valid clones and return success with `"already_cloned"` status instead of failing with non-retryable error.
- Implement a single-attempt ainvoke probe when stream detects DEGRADED, before giving up. The function may have recovered between stream and ainvoke attempts.
- Replace the hard skip of ainvoke on DEGRADED with a guarded single-attempt path that falls back to structured partial response only after the probe fails.
- Add `retryable=True` hint to the "destination already exists" clone error when the existing directory is a valid matching git repo.

## Capabilities

### New Capabilities
- `idempotent-clone`: Clone tool returns success when target directory already contains a valid clone of the requested repo, enabling safe retries and loop restarts.
- `degraded-function-recovery`: Single-attempt ainvoke probe after stream DEGRADED detection, replacing the current hard skip with a guarded recovery path.

### Modified Capabilities
- `shallow-clone-support`: Existing clone validation now includes shallow clone detection and matching.
- `deterministic-fallback-policy`: DEGRADED_FUNCTION policy execution path changes from "skip ainvoke" to "probe ainvoke once, then skip".

## Impact

- `src/cognitive_code_agent/tools/clone_tools.py` — idempotent destination resolution
- `src/cognitive_code_agent/agents/safe_tool_calling_agent.py` — DEGRADED recovery path in stream/ainvoke flow
- `tests/unit/test_clone_tools.py` — new idempotency test cases
- `tests/unit/test_safe_tool_calling_agent.py` — DEGRADED recovery test cases
- No API changes, no config.yml changes, no breaking changes.
