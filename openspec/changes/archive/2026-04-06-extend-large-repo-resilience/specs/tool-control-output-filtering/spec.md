## MODIFIED Requirements

### Requirement: tool-control-output-filtering — per-tool truncation trace events
The `tool_output_truncated` trace event emitted by `_guard_tool_outputs` MUST include a `limit_source` field that indicates whether the truncation was triggered by the global cap (`"global"`) or a per-tool limit (`"per_tool"`).

#### Scenario: Global cap truncation event
- **WHEN** a ToolMessage is truncated because its length exceeds the global `max_chars` limit
- **THEN** the `tool_output_truncated` event SHALL include `limit_source="global"`
- **THEN** the event SHALL include `tool_name`, `original_chars`, and `truncated_chars`

#### Scenario: Per-tool cap truncation event
- **WHEN** a ToolMessage is truncated because its length exceeds a per-tool limit from `per_tool_max_chars`
- **THEN** the `tool_output_truncated` event SHALL include `limit_source="per_tool"`
- **THEN** the event SHALL include `tool_name`, `original_chars`, and `truncated_chars`
