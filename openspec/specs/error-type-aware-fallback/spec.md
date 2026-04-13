## ADDED Requirements

### Requirement: Fallback SHALL classify TOOL_CALL_ID_MISMATCH as a distinct error class
The fallback activation path SHALL detect the error class `TOOL_CALL_ID_MISMATCH` when an API call returns HTTP 400 with a `BadRequestError` type and an error message containing `"Unexpected tool call id"`. This class SHALL be classified before falling through to `UNKNOWN_RUNTIME`.

#### Scenario: 400 with tool call id mismatch message is classified correctly
- **WHEN** a LLM API call or `spawn_agent` call returns a `BadRequestError` with HTTP 400 and message matching `"Unexpected tool call id"`
- **THEN** the fallback path SHALL classify the error as `TOOL_CALL_ID_MISMATCH`
- **AND** SHALL NOT classify it as `UNKNOWN_RUNTIME`

#### Scenario: 400 with unrelated message is not misclassified
- **WHEN** a LLM API call returns HTTP 400 with a message that does not contain `"Unexpected tool call id"`
- **THEN** the fallback path SHALL classify it as `UNKNOWN_RUNTIME` (existing behavior)

### Requirement: TOOL_CALL_ID_MISMATCH SHALL trigger history repair and bounded retry
When a `TOOL_CALL_ID_MISMATCH` error is classified, the runtime SHALL attempt to repair the message history and retry the failing call exactly once before escalating.

#### Scenario: History repaired and call retried on mismatch
- **WHEN** a `TOOL_CALL_ID_MISMATCH` error is detected
- **THEN** the runtime SHALL call `repair_message_history` on the current state messages
- **AND** SHALL retry the LLM call with the repaired message list
- **AND** SHALL continue the agent loop if the retry succeeds

#### Scenario: Repair produces no change — escalate
- **WHEN** `repair_message_history` finds no orphaned IDs to remove (history is already consistent)
- **THEN** the runtime SHALL NOT retry and SHALL escalate to `UNKNOWN_RUNTIME` fallback handling

#### Scenario: Retry after repair also fails — no second repair
- **WHEN** the retry after repair also fails (any error)
- **THEN** the runtime SHALL NOT attempt a second repair
- **AND** SHALL escalate to `UNKNOWN_RUNTIME` fallback handling

### Requirement: repair_message_history SHALL remove only provably orphaned message entries
The `repair_message_history` utility SHALL scan the message list and remove: (a) any `ToolMessage` whose `tool_call_id` has no matching `tool_calls` entry in any `AIMessage` in the list, and (b) any `tool_calls` entry in an `AIMessage` whose ID has no matching `ToolMessage` in the list. It SHALL never remove a complete paired entry.

#### Scenario: Orphaned ToolMessage is removed
- **WHEN** a `ToolMessage` with `tool_call_id=X` exists and no `AIMessage` in the list has a `tool_calls` entry with `id=X`
- **THEN** `repair_message_history` SHALL remove that `ToolMessage` from the list

#### Scenario: Orphaned tool_calls entry in AIMessage is removed
- **WHEN** an `AIMessage` has a `tool_calls` entry with `id=Y` and no `ToolMessage` with `tool_call_id=Y` exists in the list
- **THEN** `repair_message_history` SHALL remove that specific `tool_calls` entry from the `AIMessage`
- **AND** if the `AIMessage` has no remaining `tool_calls` entries, it SHALL be retained with an empty `tool_calls` list

#### Scenario: Paired entries are untouched
- **WHEN** a `ToolMessage` and its corresponding `AIMessage` tool_calls entry both exist
- **THEN** `repair_message_history` SHALL leave both unchanged
