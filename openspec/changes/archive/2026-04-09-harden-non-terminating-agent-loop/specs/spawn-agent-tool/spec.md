## MODIFIED Requirements

### Requirement: Spawn ephemeral code-expert agent at runtime
The system SHALL provide a `spawn_agent` tool that creates and runs an ephemeral `SafeToolCallAgentGraph` instance for a given task, using a caller-specified subset of tools from a per-mode allowlist, and returns the agent's final response as a string.

The system SHALL also enforce a global per-request spawn budget through deterministic tool limits. Budget exhaustion SHALL block additional `spawn_agent` calls as non-fatal denials and SHALL preserve loop continuation for synthesis/replanning.

#### Scenario: Successful spawn with valid tools
- **WHEN** the orchestrator calls `spawn_agent(task="...", tools=["fs_tools", "run_semgrep"], max_iterations=20)` within available budget
- **THEN** a new `SafeToolCallAgentGraph` is constructed with those tools, runs until completion or iteration limit, and its final text response is returned

#### Scenario: Tool filtering against mode allowlist
- **WHEN** the orchestrator requests a tool not in the mode's `spawn_agent_allowed_tools` list
- **THEN** that tool is silently excluded from the spawned agent's tool set, and execution continues with the remaining allowed tools

#### Scenario: spawn_agent is never in spawned agent's tools
- **WHEN** a spawned agent is created
- **THEN** `spawn_agent` itself MUST NOT appear in its tool list, regardless of the allowlist

#### Scenario: Parallel spawning
- **WHEN** the orchestrator issues two or more `spawn_agent` calls in a single parallel tool-call batch and budget permits
- **THEN** all spawned agents execute concurrently and their responses are returned independently to the orchestrator

#### Scenario: Spawn budget exhaustion is soft-fail
- **WHEN** a `spawn_agent` call would exceed the configured per-request spawn budget
- **THEN** the call SHALL be blocked with a non-fatal tool denial message
- **AND** the request loop SHALL continue for consolidation or narrower replanning
