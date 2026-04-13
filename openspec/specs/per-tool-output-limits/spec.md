## ADDED Requirements

### Requirement: _guard_tool_outputs SHALL accept per-tool char limits
The `_guard_tool_outputs` function SHALL accept a `per_tool_max_chars: dict[str, int]` parameter alongside the existing global `max_chars` parameter. When a tool name matches a key in `per_tool_max_chars`, that limit SHALL take precedence over the global cap.

#### Scenario: Tool name matches per-tool limit
- **WHEN** a ToolMessage with `name="fs_tools__directory_tree"` is in state and `per_tool_max_chars={"fs_tools__directory_tree": 5000}` is configured
- **THEN** the message content SHALL be truncated to 5000 chars if it exceeds that limit
- **THEN** the global `max_chars` limit SHALL NOT be applied to that message

#### Scenario: Tool name not in per-tool limits falls back to global cap
- **WHEN** a ToolMessage with a name not in `per_tool_max_chars` is in state
- **THEN** the message content SHALL be truncated using the global `max_chars` limit

#### Scenario: No per-tool limits configured
- **WHEN** `per_tool_max_chars` is None or not provided
- **THEN** all ToolMessages SHALL be truncated using the global `max_chars` limit only
- **THEN** existing behavior is unchanged

#### Scenario: Per-tool limit trace event
- **WHEN** a ToolMessage is truncated using a per-tool limit
- **THEN** a `tool_output_truncated` trace event SHALL be emitted with `tool_name`, `original_chars`, `truncated_chars`, and `limit_source="per_tool"` fields

### Requirement: directory_tree tool SHALL be capped at 5000 chars by default
The default configuration SHALL include `per_tool_max_chars` entries for both `"directory_tree"` and `"fs_tools__directory_tree"` with a value of 5000.

#### Scenario: Default config caps directory_tree at 5000
- **WHEN** `_guard_tool_outputs` is called with default configuration
- **THEN** ToolMessages from `fs_tools__directory_tree` with content longer than 5000 chars SHALL be truncated to 5000 chars
- **THEN** ToolMessages from other tools SHALL use the global 30000 char limit

#### Scenario: Per-tool limit is configurable
- **WHEN** an operator sets `per_tool_max_chars.fs_tools__directory_tree: 3000` in config.yml
- **THEN** the directory_tree cap SHALL be 3000 chars instead of the default 5000
