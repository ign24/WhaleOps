## MODIFIED Requirements

### Requirement: Recoverable failures SHALL use bounded recovery
For recoverable classes (`RECURSION_LIMIT`, `TOOL_TIMEOUT`, `CONTEXT_OVERFLOW`, `SERVER_ERROR`, `RATE_LIMITED`), the workflow SHALL attempt recovery via the compact-and-continue loop before finalizing output. The loop provides up to `max_recovery_rounds` of compaction + fresh budget, replacing the previous single scoped retry.

#### Scenario: Recovery via compact-and-continue on recursion
- **WHEN** the first attempt ends with `RECURSION_LIMIT`
- **THEN** the workflow SHALL enter the compact-and-continue recovery loop
- **AND** SHALL compact state, reset budget, and retry up to `max_recovery_rounds` times
- **AND** SHALL finalize with synthesis only when no progress is detected or max rounds exhausted

#### Scenario: Recovery via compact-and-continue on context overflow
- **WHEN** the execution fails with `CONTEXT_OVERFLOW`
- **THEN** the workflow SHALL enter the compact-and-continue recovery loop
- **AND** SHALL compact state aggressively before retrying

#### Scenario: Recovery exhausted
- **WHEN** all recovery rounds fail or no progress is detected
- **THEN** the workflow SHALL finalize with structured partial response output

### Requirement: CONTEXT_OVERFLOW SHALL be retryable
The failure policy for `CONTEXT_OVERFLOW` SHALL have `retryable=True` and `action="compact_and_continue"`. Context overflow is caused by state size — compaction directly addresses the root cause.

#### Scenario: CONTEXT_OVERFLOW policy is retryable
- **WHEN** a failure is classified as `CONTEXT_OVERFLOW`
- **THEN** `FAILURE_POLICIES[FailureClass.CONTEXT_OVERFLOW].retryable` SHALL be True
- **AND** `FAILURE_POLICIES[FailureClass.CONTEXT_OVERFLOW].action` SHALL be `"compact_and_continue"`

### Requirement: Synthesis-only SHALL be the last resort
The synthesis-only fallback (budget=12, no tools) SHALL only be used when: (a) `_measure_progress()` returns False for the current recovery round, OR (b) `max_recovery_rounds` is exhausted. It SHALL NOT be the first fallback after a recursion limit.

#### Scenario: Recursion limit with progress does not trigger immediate synthesis
- **WHEN** the stream path hits recursion limit
- **AND** progress has been made (useful ToolMessages exist)
- **THEN** the workflow SHALL compact and continue with fresh budget
- **AND** SHALL NOT invoke synthesis-only mode

#### Scenario: No progress triggers synthesis
- **WHEN** the stream path hits recursion limit
- **AND** no progress has been made since the last checkpoint
- **THEN** the workflow SHALL invoke synthesis-only mode as the final response

### Requirement: Non-retryable failures SHALL avoid blind retries
For `TOOL_VALIDATION_ERROR` and `UNKNOWN_RUNTIME`, the workflow SHALL not re-run the same failing action with identical arguments. For `DEGRADED_FUNCTION`, the workflow SHALL execute a single bounded ainvoke probe before finalizing, rather than skipping ainvoke entirely. The probe tests platform recovery without constituting a blind retry (different execution path, single attempt).

#### Scenario: Validation error avoids identical retry
- **WHEN** a tool returns a non-retryable validation error
- **THEN** the workflow SHALL avoid invoking the same tool with materially identical arguments in the same request
- **AND** proceed to alternative action or partial finalization

#### Scenario: DEGRADED function executes bounded probe before finalization
- **WHEN** streaming fails with DEGRADED_FUNCTION
- **THEN** the workflow SHALL execute exactly one ainvoke probe (not a retry of the same stream path)
- **AND** if the probe fails, SHALL finalize with structured partial response
- **AND** SHALL NOT execute additional probes or retries for the same DEGRADED function

### Requirement: Runtime failures SHALL be classified deterministically
The workflow SHALL classify runtime failures into a deterministic taxonomy before deciding fallback actions. Supported classes SHALL include: `RECURSION_LIMIT`, `TOOL_TIMEOUT`, `TOOL_VALIDATION_ERROR`, `TOOL_CALL_ID_MISMATCH`, `DEGRADED_FUNCTION`, `MEMORY_DEGRADED`, `EVIDENCE_INSUFFICIENT`, `UNKNOWN_RUNTIME`, `HITL_TIMEOUT`, `WRITE_DENIED`, `RATE_LIMITED`, `SERVER_ERROR`, `CONTEXT_OVERFLOW`.

#### Scenario: Recursion limit is classified
- **WHEN** graph execution raises `GraphRecursionError`
- **THEN** the workflow SHALL classify the event as `RECURSION_LIMIT`
- **AND** emit a trace event with the class and active mode

#### Scenario: Tool timeout is classified
- **WHEN** tool execution exceeds configured timeout budget
- **THEN** the workflow SHALL classify the event as `TOOL_TIMEOUT`
- **AND** include tool name and timeout budget in the event metadata
