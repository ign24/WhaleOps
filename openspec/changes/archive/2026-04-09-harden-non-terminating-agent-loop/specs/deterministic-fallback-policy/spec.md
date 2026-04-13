## MODIFIED Requirements

### Requirement: Recoverable failures SHALL use bounded recovery
For recoverable classes (`RECURSION_LIMIT`, `TOOL_TIMEOUT`), the workflow SHALL attempt at most one scoped recovery pass before finalizing output.

Recovery handling SHALL be message-type-safe and SHALL operate correctly when the latest state message is not an `AIMessage` (e.g., `ToolMessage`).

#### Scenario: Single recovery attempt on recursion
- **WHEN** the first attempt ends with `RECURSION_LIMIT`
- **THEN** the workflow SHALL execute exactly one scoped replan/retry
- **AND** SHALL NOT execute a second retry for the same class in the same request

#### Scenario: Recovery exhausted
- **WHEN** the scoped retry also fails for a recoverable class
- **THEN** the workflow SHALL finalize with structured partial response output

#### Scenario: Recovery path handles ToolMessage state safely
- **WHEN** fallback executes while the latest state message is a `ToolMessage`
- **THEN** fallback SHALL not assume `.tool_calls` availability
- **AND** the workflow SHALL continue to deterministic finalization instead of raising secondary runtime errors

## ADDED Requirements

### Requirement: Fallback failures SHALL degrade deterministically
If fallback logic itself encounters an internal runtime error, the workflow SHALL emit a deterministic structured partial response instead of propagating an unhandled exception.

#### Scenario: Internal fallback exception degrades cleanly
- **WHEN** fallback code raises an internal exception during recovery
- **THEN** the workflow SHALL return a structured partial response
- **AND** SHALL include bounded blocked-by metadata without crashing the request handler
