## ADDED Requirements

### Requirement: analyze mode does not expose fs_tools or github_tools directly
The system SHALL NOT include `fs_tools` or `github_tools` in `workflow.modes.analyze.tool_names`. All filesystem and GitHub read operations in analyze mode MUST be routed through `reader_agent`, which owns those tool groups as internal tools.

#### Scenario: Orchestrator tool list in analyze mode excludes fs_tools
- **WHEN** the agent is initialized in `analyze` mode
- **THEN** the tool names list exposed to the top-level LLM SHALL NOT contain `fs_tools`

#### Scenario: Orchestrator tool list in analyze mode excludes github_tools
- **WHEN** the agent is initialized in `analyze` mode
- **THEN** the tool names list exposed to the top-level LLM SHALL NOT contain `github_tools`

#### Scenario: reader_agent retains fs_tools and github_tools
- **WHEN** the agent is initialized in `analyze` mode
- **THEN** `reader_agent` (defined under `functions`) SHALL still declare `fs_tools` and `github_tools` in its own `tool_names`

### Requirement: max_active_skills is capped at 2
The system SHALL set `max_active_skills` to `2` in both `functions.code_agent` and `workflow` blocks of `config.yml`, and SHALL set `default_max_active_skills` to `2` in `registry.yml`. At most 2 skills SHALL be injected into the system prompt for any single request.

#### Scenario: Single-domain request activates at most 2 skills
- **WHEN** the user sends a message triggering only one skill's domain keywords
- **THEN** at most 1 skill SHALL be injected into the system prompt

#### Scenario: Multi-domain request is bounded by cap
- **WHEN** the user sends a message whose keywords match triggers in 3 or more skills
- **THEN** at most 2 skills SHALL be injected, selected by the `priority_order` defined in `registry.yml`
