## Why

Context compaction silently breaks tool call/result message pairing, causing NAT to reject the next LLM call with a 400 `Unexpected tool call id` error. Combined with a fallback that does not distinguish error types and no retry strategy for DEGRADED NAT functions, any long-running request against a large repository reliably terminates the agent loop with an empty output instead of recovering.

## What Changes

- Enforce a compaction invariant: any compaction pass that removes a `ToolMessage` must also remove the originating `AIMessage` tool call entry (and vice versa), so the message history never contains orphaned tool call IDs.
- Add error-type classification to the fallback activation path so that `tool_call_id_mismatch` (400 BadRequest) triggers history repair and a clean retry instead of the generic `unknown_runtime` fallback.
- Introduce a DEGRADED function retry policy for `spawn_agent` and `ainvoke` fallback: mark the degraded function ID as unavailable for the session and retry using direct in-process execution instead of remote invocation.

## Capabilities

### New Capabilities
- `compaction-message-pairing`: Invariant that compaction never produces orphaned tool call or tool result messages; enforced at the compaction boundary.
- `error-type-aware-fallback`: Fallback routing that classifies the root error (id_mismatch, budget, degraded_function, unknown) and dispatches a targeted recovery action for each type.
- `degraded-function-recovery`: Policy for handling DEGRADED NAT function responses: session-local blacklist of degraded function IDs, automatic retry via direct execution path.

### Modified Capabilities
- `deterministic-fallback-policy`: Add error classification and per-type recovery dispatch; current policy treats all non-budget failures as `unknown_runtime`.
- `spawn-agent-tool`: Add DEGRADED response handling and direct-execution fallback when remote invocation is unavailable.

## Impact

- Affected systems: `safe_tool_calling_agent` compaction logic, fallback activation path, `spawn_agent` tool implementation.
- Affected behavior: long-running analyze/refactor requests on large repositories; any request that triggers context compaction mid-session.
- APIs/contracts: no new external dependencies; compaction and fallback are internal runtime concerns.
