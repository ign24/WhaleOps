## ADDED Requirements

### Requirement: Tool output truncation guard
The system SHALL intercept tool outputs after `tool_node` execution and truncate any `ToolMessage.content` that exceeds `max_tool_output_chars` characters, appending a truncation notice.

#### Scenario: Tool output within limit
- **WHEN** a tool returns output with character count <= `max_tool_output_chars`
- **THEN** the output is passed through unchanged to the agent state

#### Scenario: Tool output exceeds limit
- **WHEN** a tool returns output with character count > `max_tool_output_chars`
- **THEN** the output is truncated to `max_tool_output_chars` characters
- **AND** a truncation notice is appended: `\n\n[OUTPUT TRUNCATED: {N} chars removed. Use targeted queries for details.]`
- **AND** a structured `tool_output_truncated` event is logged to the trace file with tool name, original size, and truncated size

#### Scenario: Multiple tool calls in one turn
- **WHEN** the LLM issues multiple tool calls in a single `AIMessage` and tool_node returns multiple `ToolMessage` entries
- **THEN** each `ToolMessage` is independently evaluated against the threshold

### Requirement: Guard threshold is configurable
The system SHALL read the truncation threshold from `config.yml` under `workflow.tool_output_guard.max_chars` with a default of 30000.

#### Scenario: Custom threshold in config
- **WHEN** `workflow.tool_output_guard.max_chars` is set to 50000
- **THEN** tool outputs up to 50000 characters pass through, outputs above 50000 are truncated

#### Scenario: No config section present
- **WHEN** the `tool_output_guard` section is absent from config
- **THEN** the default threshold of 30000 characters is used

### Requirement: Guard applies to all tool types
The system SHALL apply the guard to both custom tools (registered via NAT) and MCP tools (from function_groups), without requiring per-tool configuration.

#### Scenario: MCP tool returns large output
- **WHEN** an MCP tool like `fs_tools__directory_tree` returns output exceeding the threshold
- **THEN** the guard truncates the output identically to custom tools

### Requirement: Prompt guidance for directory_tree
The system prompts for analyze and refactor modes SHALL include explicit instructions to use `excludePatterns` when calling `directory_tree` and to prefer `reader_agent` over direct `fs_tools` calls for repository exploration.

#### Scenario: Analyze mode prompt includes directory_tree guidance
- **WHEN** the agent operates in analyze mode
- **THEN** the system prompt instructs the agent to always pass `excludePatterns: [".git", "node_modules", "__pycache__", ".venv", "dist", "build", ".next", ".tox", "vendor"]` when calling `directory_tree`

#### Scenario: Analyze prompt reinforces reader_agent for Phase 0
- **WHEN** the agent begins Phase 0 of the full analysis protocol
- **THEN** the system prompt instructs the agent to use `reader_agent` for repository overview, not direct `fs_tools__directory_tree` calls
