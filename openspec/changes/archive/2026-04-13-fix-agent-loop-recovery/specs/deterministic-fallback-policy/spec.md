## MODIFIED Requirements

### Requirement: Runtime failures SHALL be classified deterministically
The workflow SHALL classify runtime failures into a deterministic taxonomy before deciding fallback actions. Supported classes SHALL include: `RECURSION_LIMIT`, `TOOL_TIMEOUT`, `TOOL_VALIDATION_ERROR`, `TOOL_CALL_ID_MISMATCH`, `DEGRADED_FUNCTION`, `MEMORY_DEGRADED`, `EVIDENCE_INSUFFICIENT`, and `UNKNOWN_RUNTIME`.

Classification SHALL be attempted in priority order: `TOOL_CALL_ID_MISMATCH` and `DEGRADED_FUNCTION` SHALL be checked before `UNKNOWN_RUNTIME` for any HTTP 400 error.

#### Scenario: Recursion limit is classified
- **WHEN** graph execution raises `GraphRecursionError`
- **THEN** the workflow SHALL classify the event as `RECURSION_LIMIT`
- **AND** emit a trace event with the class and active mode

#### Scenario: Tool timeout is classified
- **WHEN** tool execution exceeds configured timeout budget
- **THEN** the workflow SHALL classify the event as `TOOL_TIMEOUT`
- **AND** include tool name and timeout budget in the event metadata

#### Scenario: Tool call ID mismatch is classified
- **WHEN** an API call returns HTTP 400 with `BadRequestError` type and message containing `"Unexpected tool call id"`
- **THEN** the workflow SHALL classify the event as `TOOL_CALL_ID_MISMATCH`
- **AND** SHALL NOT classify it as `UNKNOWN_RUNTIME`

#### Scenario: Degraded function is classified
- **WHEN** a remote function call returns HTTP 400 with message matching `"DEGRADED function cannot be invoked"`
- **THEN** the workflow SHALL classify the event as `DEGRADED_FUNCTION`
- **AND** SHALL NOT classify it as `UNKNOWN_RUNTIME`

### Requirement: Recoverable failures SHALL use bounded recovery
For recoverable classes (`RECURSION_LIMIT`, `TOOL_TIMEOUT`, `TOOL_CALL_ID_MISMATCH`), the workflow SHALL attempt at most one scoped recovery pass before finalizing output.

#### Scenario: Single recovery attempt on recursion
- **WHEN** the first attempt ends with `RECURSION_LIMIT`
- **THEN** the workflow SHALL execute exactly one scoped replan/retry
- **AND** SHALL NOT execute a second retry for the same class in the same request

#### Scenario: Recovery exhausted
- **WHEN** the scoped retry also fails for a recoverable class
- **THEN** the workflow SHALL finalize with structured partial response output

#### Scenario: Single repair-and-retry on tool call ID mismatch
- **WHEN** the first attempt ends with `TOOL_CALL_ID_MISMATCH`
- **THEN** the workflow SHALL run `repair_message_history` and retry exactly once
- **AND** SHALL NOT attempt a second repair-and-retry for `TOOL_CALL_ID_MISMATCH` in the same request

### Requirement: Non-retryable failures SHALL avoid blind retries
For `TOOL_VALIDATION_ERROR`, `DEGRADED_FUNCTION`, and `UNKNOWN_RUNTIME`, the workflow SHALL not re-run the same failing action with identical arguments.

#### Scenario: Validation error avoids identical retry
- **WHEN** a tool returns a non-retryable validation error
- **THEN** the workflow SHALL avoid invoking the same tool with materially identical arguments in the same request
- **AND** proceed to alternative action or partial finalization

#### Scenario: Degraded function avoids remote retry
- **WHEN** a remote function call is classified as `DEGRADED_FUNCTION`
- **THEN** the workflow SHALL NOT retry the same remote function ID in the same request
- **AND** SHALL proceed to in-process fallback execution
