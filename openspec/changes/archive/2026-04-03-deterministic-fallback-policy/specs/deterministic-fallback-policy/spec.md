## ADDED Requirements

### Requirement: Runtime failures SHALL be classified deterministically
The workflow SHALL classify runtime failures into a deterministic taxonomy before deciding fallback actions. Supported classes SHALL include: `RECURSION_LIMIT`, `TOOL_TIMEOUT`, `TOOL_VALIDATION_ERROR`, `MEMORY_DEGRADED`, `EVIDENCE_INSUFFICIENT`, and `UNKNOWN_RUNTIME`.

#### Scenario: Recursion limit is classified
- **WHEN** graph execution raises `GraphRecursionError`
- **THEN** the workflow SHALL classify the event as `RECURSION_LIMIT`
- **AND** emit a trace event with the class and active mode

#### Scenario: Tool timeout is classified
- **WHEN** tool execution exceeds configured timeout budget
- **THEN** the workflow SHALL classify the event as `TOOL_TIMEOUT`
- **AND** include tool name and timeout budget in the event metadata

### Requirement: Recoverable failures SHALL use bounded recovery
For recoverable classes (`RECURSION_LIMIT`, `TOOL_TIMEOUT`), the workflow SHALL attempt at most one scoped recovery pass before finalizing output.

#### Scenario: Single recovery attempt on recursion
- **WHEN** the first attempt ends with `RECURSION_LIMIT`
- **THEN** the workflow SHALL execute exactly one scoped replan/retry
- **AND** SHALL NOT execute a second retry for the same class in the same request

#### Scenario: Recovery exhausted
- **WHEN** the scoped retry also fails for a recoverable class
- **THEN** the workflow SHALL finalize with structured partial response output

### Requirement: Non-retryable failures SHALL avoid blind retries
For `TOOL_VALIDATION_ERROR` and `UNKNOWN_RUNTIME`, the workflow SHALL not re-run the same failing action with identical arguments.

#### Scenario: Validation error avoids identical retry
- **WHEN** a tool returns a non-retryable validation error
- **THEN** the workflow SHALL avoid invoking the same tool with materially identical arguments in the same request
- **AND** proceed to alternative action or partial finalization
