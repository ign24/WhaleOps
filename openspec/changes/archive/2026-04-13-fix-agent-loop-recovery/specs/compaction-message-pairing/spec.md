## ADDED Requirements

### Requirement: Compaction SHALL preserve tool call/result message pairs
The `compress_state` function SHALL guarantee that after compaction the retained message list contains no orphaned tool call IDs. Specifically: every `ToolMessage` in the retained list SHALL have a corresponding `AIMessage` with a matching `tool_call` entry, and every `AIMessage` with `tool_calls` in the retained list SHALL have at least one corresponding `ToolMessage` for each call ID.

#### Scenario: ToolMessage at recent boundary has its AIMessage in middle
- **WHEN** the recent window boundary falls such that a `ToolMessage` is the first retained message and its originating `AIMessage` (containing the matching `tool_calls` entry) would be in the evicted middle
- **THEN** `compress_state` SHALL expand the recent boundary backward to include the originating `AIMessage`
- **AND** both messages SHALL appear in the retained list after compaction

#### Scenario: AIMessage with tool_calls at end of middle has results in recent
- **WHEN** the boundary places an `AIMessage` with pending `tool_calls` as the last evicted message while its corresponding `ToolMessage` results are in the recent window
- **THEN** `compress_state` SHALL expand the recent boundary to include the `AIMessage`
- **AND** the pair SHALL remain intact in the retained list

#### Scenario: No pairs split — compaction proceeds normally
- **WHEN** the recent/middle boundary does not split any tool call/result pair
- **THEN** `compress_state` SHALL proceed with the original boundary unchanged

#### Scenario: Boundary expansion cap reached
- **WHEN** expanding the boundary would exceed `retain_recent * 2` messages
- **THEN** `compress_state` SHALL stop expanding, retain the capped boundary, and emit a `compaction_boundary_capped` trace event with the message count
- **AND** SHALL proceed with compaction at the capped boundary

### Requirement: Compaction SHALL emit a trace event when boundary is adjusted
The `compress_state` function SHALL emit a `compaction_boundary_adjusted` trace event whenever it expands the recent boundary to preserve a message pair, including the original boundary index, the adjusted boundary index, and the reason (`tool_result_orphan` or `tool_call_orphan`).

#### Scenario: Boundary adjustment traced
- **WHEN** `compress_state` expands the boundary to preserve a ToolMessage/AIMessage pair
- **THEN** a `compaction_boundary_adjusted` event SHALL be emitted before the compaction result is returned
