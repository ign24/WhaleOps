## ADDED Requirements

### Requirement: DEGRADED function responses SHALL be detected and blacklisted per request
When a NAT remote function call returns HTTP 400 with a message matching `"DEGRADED function cannot be invoked"`, the runtime SHALL record the function ID in a request-scoped blacklist (`_degraded_function_ids`) and SHALL NOT attempt to invoke that function ID again within the same request.

#### Scenario: DEGRADED function is blacklisted on first failure
- **WHEN** a call to a remote NAT function returns `[400] DEGRADED function <id> cannot be invoked`
- **THEN** the runtime SHALL add `<id>` to `_degraded_function_ids` for this request
- **AND** SHALL NOT retry the same function ID for the remainder of the request

#### Scenario: Subsequent call skips blacklisted function
- **WHEN** a code path would invoke a remote function whose ID is in `_degraded_function_ids`
- **THEN** the runtime SHALL skip the remote call and proceed directly to the in-process fallback execution path

### Requirement: spawn_agent SHALL fall back to direct in-process execution on DEGRADED function
When `spawn_agent` detects that its target NAT function is DEGRADED (either by catching a 400 on invocation or by checking `_degraded_function_ids`), it SHALL execute the task directly using `SafeToolCallAgentGraph.ainvoke` in-process instead of delegating to the remote function.

#### Scenario: spawn_agent uses direct execution when function is DEGRADED
- **WHEN** `spawn_agent` is called and the target function ID is in `_degraded_function_ids`
- **THEN** `spawn_agent` SHALL create a local `SafeToolCallAgentGraph` instance and run the task in-process
- **AND** SHALL return its result identically to the normal remote-execution path
- **AND** SHALL emit a `spawn_agent_degraded_fallback` trace event with the original function ID

#### Scenario: ainvoke fallback checks blacklist before remote call
- **WHEN** the `ainvoke` fallback path is activated and the target function ID is already in `_degraded_function_ids`
- **THEN** the fallback SHALL skip the remote ainvoke call and proceed immediately to in-process execution

### Requirement: DEGRADED function events SHALL be traced
Every time a DEGRADED function is detected, the runtime SHALL emit a `function_degraded` trace event containing the function ID, the invoking path (`spawn_agent` or `ainvoke_fallback`), and whether in-process fallback was used.

#### Scenario: Trace event emitted on DEGRADED detection
- **WHEN** a remote function call returns DEGRADED
- **THEN** a `function_degraded` trace event SHALL be emitted before the fallback path executes
