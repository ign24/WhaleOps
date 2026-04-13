## ADDED Requirements

### Requirement: spawn_agent SHALL handle DEGRADED remote function with in-process fallback
When the remote NAT function targeted by `spawn_agent` is in a DEGRADED state (detected via HTTP 400 or via the request-scoped `_degraded_function_ids` blacklist), `spawn_agent` SHALL execute the task locally using `SafeToolCallAgentGraph` in-process and return the result to the caller without surfacing the remote failure.

#### Scenario: spawn_agent falls back to direct execution on DEGRADED detection
- **WHEN** `spawn_agent` invokes a remote function and receives `[400] DEGRADED function cannot be invoked`
- **THEN** `spawn_agent` SHALL create a local `SafeToolCallAgentGraph` instance with the same task, tools, and max_iterations
- **AND** run it in-process and return its final response as the tool result
- **AND** emit a `spawn_agent_degraded_fallback` trace event with the original function ID and fallback mode

#### Scenario: spawn_agent skips remote call when function already blacklisted
- **WHEN** `spawn_agent` is called and the target function ID is already in `_degraded_function_ids`
- **THEN** `spawn_agent` SHALL skip the remote invocation entirely and proceed directly to in-process execution
- **AND** SHALL emit a `spawn_agent_degraded_fallback` trace event with `reason=blacklisted`

#### Scenario: in-process fallback result is indistinguishable from remote result
- **WHEN** `spawn_agent` completes via in-process fallback
- **THEN** the tool result returned to the orchestrator SHALL have the same shape as a successful remote execution result
- **AND** the orchestrator loop SHALL continue normally without requiring special handling
