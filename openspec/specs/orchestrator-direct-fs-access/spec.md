# orchestrator-direct-fs-access Specification

## Purpose
TBD - created by archiving change dynamic-code-expert-subagents. Update Purpose after archive.
## Requirements
### Requirement: Analyze mode orchestrator has direct fs_tools access
The analyze mode SHALL include `fs_tools` (read-only MCP client) in its tool list so the orchestrator can read files and directory structures in its own loop without delegating to a subagent intermediary.

#### Scenario: Orchestrator reads a file directly
- **WHEN** the orchestrator needs to inspect a specific file at a known path
- **THEN** it calls `fs_tools__read_text_file` directly without spawning an agent

#### Scenario: Orchestrator gets directory structure directly
- **WHEN** the orchestrator needs to understand the top-level structure of a cloned repo
- **THEN** it calls `fs_tools__directory_tree` with `excludePatterns` directly, receiving the result in its own context

### Requirement: reader_agent is removed from all modes
`reader_agent` SHALL be removed from all mode tool lists (analyze, refactor) and from the global `function_groups` configuration. Any existing references to reader_agent in prompts SHALL be removed.

#### Scenario: Analyze mode has no reader_agent
- **WHEN** the analyze mode is initialized
- **THEN** `reader_agent` does not appear in the registered tools and the orchestrator cannot call it

#### Scenario: Refactor mode has no reader_agent
- **WHEN** the refactor mode is initialized
- **THEN** `reader_agent` does not appear in the registered tools; direct `fs_tools_write` covers all file read/write needs

### Requirement: Fixed domain subagents are removed
The pre-configured `security_agent`, `qa_agent`, `review_agent`, and `docs_agent` `tool_calling_agent` entries SHALL be removed from `function_groups`. Their specialized tools remain registered and available to `spawn_agent`.

#### Scenario: No fixed domain agent tool calls from orchestrator
- **WHEN** the orchestrator runs in analyze mode
- **THEN** it cannot call `security_agent`, `qa_agent`, `review_agent`, or `docs_agent` directly; it uses `spawn_agent` with the equivalent tools instead

