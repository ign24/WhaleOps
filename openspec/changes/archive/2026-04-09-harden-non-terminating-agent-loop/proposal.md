## Why

Large cross-domain requests currently fail in ways that can terminate progress instead of degrading gracefully. We need deterministic non-terminating execution so guardrails enforce budgets and safety without collapsing the request loop.

## What Changes

- Introduce a non-terminating execution policy: guardrail denials and budget exhaustion become soft-fail signals, never terminal loop aborts.
- Enforce a global per-request subagent spawn budget (request-wide, not per-agent), with explicit continuation behavior when exhausted.
- Harden fallback and recovery paths to be message-type-safe (`AIMessage`/`ToolMessage`) and prevent secondary crashes during error handling.
- Standardize partial-output behavior under constrained budgets so responses remain valid, structured, and machine-consumable.
- Add planning guidance so complex requests are decomposed into smaller subtasks within deterministic execution budgets.

## Capabilities

### New Capabilities
- `non-terminating-execution-policy`: Defines hard guarantees that runtime guardrails cannot terminate the request loop and must always return control for replanning/synthesis.

### Modified Capabilities
- `spawn-agent-tool`: Add global request-level spawn budgeting and explicit soft-fail behavior when budget is exhausted.
- `tool-loop-guard`: Change blocked-call handling to non-interrupting behavior so only offending calls are denied while loop progress continues.
- `deterministic-fallback-policy`: Require type-safe fallback/recovery paths that cannot introduce new runtime failures.
- `structured-partial-response-contract`: Require valid partial outputs under budget/tool denials with explicit completed vs pending scope.
- `prompt-layering`: Add decomposition guidance for complex tasks while keeping budget and loop guarantees deterministic in runtime.

## Impact

- Affected systems: `safe_tool_calling_agent` runtime guards, spawn-agent tool execution policy, fallback/recovery handlers, and mode prompts.
- Affected behavior: multi-step analyze/refactor flows under constrained budgets and heavy tool usage.
- APIs/contracts: response content contract for constrained execution paths; no new external dependencies expected.
