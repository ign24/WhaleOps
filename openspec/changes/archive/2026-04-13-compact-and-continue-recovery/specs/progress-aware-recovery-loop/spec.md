## ADDED Requirements

### Requirement: Recoverable failures SHALL enter an outer recovery loop
The workflow SHALL wrap the `astream + ainvoke fallback` execution block in an outer recovery loop. When a recoverable failure occurs (RECURSION_LIMIT, CONTEXT_OVERFLOW, SERVER_ERROR with progress, RATE_LIMITED with progress, ainvoke failure with progress), the loop SHALL compact state, reset recursion budget to the original value, and re-execute.

#### Scenario: Recursion limit triggers recovery round
- **WHEN** graph execution raises `GraphRecursionError` or classifies as `RECURSION_LIMIT`
- **THEN** the workflow SHALL measure progress since the last checkpoint
- **AND** if progress exists, compact state and continue with fresh budget
- **AND** if no progress exists, emit synthesis and exit the loop

#### Scenario: Context overflow triggers recovery round
- **WHEN** the LLM rejects input with a context length error classified as `CONTEXT_OVERFLOW`
- **THEN** the workflow SHALL measure progress since the last checkpoint
- **AND** if progress exists, compact state aggressively and retry
- **AND** if no progress exists, emit synthesis and exit the loop

#### Scenario: Server error with progress triggers recovery round
- **WHEN** `SERVER_ERROR` persists after all backoff retries are exhausted
- **AND** progress has been made since the last checkpoint
- **THEN** the workflow SHALL compact state and continue with fresh budget

#### Scenario: Server error without progress does not loop
- **WHEN** `SERVER_ERROR` persists after all backoff retries are exhausted
- **AND** no progress has been made since the last checkpoint
- **THEN** the workflow SHALL finalize with structured partial response

### Requirement: Recovery loop SHALL be bounded by max_recovery_rounds
The outer recovery loop SHALL execute at most `max_recovery_rounds` iterations (configurable per mode in `config.yml`). When the maximum is reached, the workflow SHALL emit a final synthesis response.

#### Scenario: Max rounds exhausted triggers synthesis
- **WHEN** the recovery loop has executed `max_recovery_rounds` iterations
- **AND** the agent still has not produced a final response
- **THEN** the workflow SHALL emit a synthesis-only response using the compacted state

#### Scenario: Default max_recovery_rounds is 3
- **WHEN** a mode does not specify `max_recovery_rounds` in config
- **THEN** the default value SHALL be 3

### Requirement: Progress SHALL be measured from state.messages
The workflow SHALL determine forward progress by inspecting `state.messages` from a checkpoint index. Progress is defined as the presence of at least one ToolMessage with `status != "error"` and content length greater than 50 characters since the checkpoint.

#### Scenario: Useful tool output counts as progress
- **WHEN** `state.messages[checkpoint:]` contains a ToolMessage with status not equal to `"error"` and content length > 50
- **THEN** `_measure_progress()` SHALL return True

#### Scenario: Only error tool messages means no progress
- **WHEN** all ToolMessages since checkpoint have `status == "error"` or content length <= 50
- **THEN** `_measure_progress()` SHALL return False

#### Scenario: No new messages means no progress
- **WHEN** `state.messages` length equals the checkpoint index
- **THEN** `_measure_progress()` SHALL return False

### Requirement: Each recovery round SHALL reset recursion budget to original
The workflow SHALL NOT halve the recursion budget on recovery. Each recovery round SHALL use the original `(max_iterations + 1) * 2` budget, providing the agent with full capacity to complete its task on compacted state.

#### Scenario: Budget reset after compaction
- **WHEN** a recovery round begins after compaction
- **THEN** `recursion_cfg["recursion_limit"]` SHALL equal `(rt.max_iterations + 1) * 2`
- **AND** SHALL NOT be halved or reduced from the original value

### Requirement: Recovery rounds SHALL emit trace events
Each recovery round SHALL emit a `recovery_round` trace event with round number, progress metrics, and compaction results.

#### Scenario: Trace event emitted on recovery
- **WHEN** a recovery round begins
- **THEN** the workflow SHALL emit a trace event with `event_type: "recovery_round"` containing `round`, `progress_tool_count`, `messages_before_compact`, `messages_after_compact`, and `retain_recent_used`
