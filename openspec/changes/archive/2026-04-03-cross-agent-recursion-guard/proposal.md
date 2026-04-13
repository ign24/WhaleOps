## Why

`GraphRecursionError` still appears from nested subagents (for example `reader_agent`) even after top-level fallback improvements. This creates inconsistent behavior: the orchestrator is resilient, but subagent failures can still leak as hard errors and break long-running analysis workflows.

## What Changes

- Add deterministic cross-agent failure normalization so subagent recursion/timeout errors are converted into typed fallback signals instead of raw error text.
- Add orchestrator-level handling for subagent failure signals with bounded replan and structured partial continuation.
- Add per-subagent recursion budgets and escalation rules so nested agent failures are handled consistently.
- Add observability for subagent recursion incidents and recovery outcomes (by subagent name/class).
- Add test coverage for nested `reader_agent`/specialist-agent recursion paths and verify graceful continuation.

## Capabilities

### New Capabilities
- `subagent-failure-normalization`: Standardize nested subagent runtime failures into deterministic classes that the orchestrator can recover from.
- `subagent-recovery-escalation`: Define bounded retry/replan/escalation behavior for nested agent failures.

### Modified Capabilities
- `deterministic-fallback-policy`: Extend policy to explicitly include nested subagent failure sources and cross-agent recovery handling.
- `tool-loop-guard`: Extend loop guard semantics to include repeated equivalent delegated subagent calls.

## Impact

- Affected code: `src/cognitive_code_agent/agents/safe_tool_calling_agent.py` and workflow runtime plumbing.
- Affected config: `src/cognitive_code_agent/configs/config.yml` (per-subagent budgets/escalation knobs).
- Affected tests: unit/integration coverage for nested recursion and fallback continuation.
- Affected observability: additional trace fields for `failure_source=subagent`, `subagent_name`, and `recovery_outcome`.
