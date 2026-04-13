## MODIFIED Requirements

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
