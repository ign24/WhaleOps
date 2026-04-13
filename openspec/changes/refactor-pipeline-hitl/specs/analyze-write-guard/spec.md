## ADDED Requirements

### Requirement: Write tools are blocked in analyze mode
The `tool_node` SHALL deny execution of write tools (`write_file`, `edit_file`, `create_directory`) in analyze mode via a non-terminating error response.

#### Scenario: Write tool called in analyze mode
- **WHEN** the LLM in analyze mode emits a `write_file` tool call
- **THEN** `tool_node` replaces it with an error `ToolMessage` stating "Write operations are not available in analyze mode. Use /execute to modify files." and the graph continues (non-terminating)

#### Scenario: Read tools unaffected in analyze mode
- **WHEN** the LLM in analyze mode calls `read_text_file` or `directory_tree`
- **THEN** the tool executes normally without any guard intervention

#### Scenario: Write tools allowed in execute mode
- **WHEN** the LLM in execute mode calls `write_file`
- **THEN** the write guard does NOT block the call (HITL interrupt gate handles confirmation separately)

### Requirement: Write guard emits trace event
When a write tool is blocked in analyze mode, a trace event SHALL be emitted for observability.

#### Scenario: Trace event on write denial
- **WHEN** `tool_node` blocks a write tool in analyze mode
- **THEN** a `"write_mode_guard"` trace event is emitted with fields: `tool_name`, `mode`, `action: "denied"`
