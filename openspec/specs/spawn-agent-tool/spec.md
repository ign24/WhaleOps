# spawn-agent-tool Specification

## Purpose
TBD - created by archiving change dynamic-code-expert-subagents. Update Purpose after archive.
## Requirements
### Requirement: Spawn ephemeral code-expert agent at runtime
The system SHALL provide a `spawn_agent` tool that creates and runs an ephemeral `SafeToolCallAgentGraph` instance for a given task, using a caller-specified subset of tools from a per-mode allowlist, and returns the agent's final response as a string.

#### Scenario: Successful spawn with valid tools
- **WHEN** the orchestrator calls `spawn_agent(task="...", tools=["fs_tools", "run_semgrep"], max_iterations=20)`
- **THEN** a new `SafeToolCallAgentGraph` is constructed with those tools, runs until completion or iteration limit, and its final text response is returned

#### Scenario: Tool filtering against mode allowlist
- **WHEN** the orchestrator requests a tool not in the mode's `spawn_agent_allowed_tools` list
- **THEN** that tool is silently excluded from the spawned agent's tool set, and execution continues with the remaining allowed tools

#### Scenario: spawn_agent is never in spawned agent's tools
- **WHEN** a spawned agent is created
- **THEN** `spawn_agent` itself MUST NOT appear in its tool list, regardless of the allowlist

#### Scenario: Parallel spawning
- **WHEN** the orchestrator issues two or more `spawn_agent` calls in a single parallel tool-call batch
- **THEN** all spawned agents execute concurrently and their responses are returned independently to the orchestrator

### Requirement: Spawned agents are code experts with autonomous skill selection
All spawned agents SHALL use a shared code-expert base system prompt and SHALL have access to the full skill registry. The agent MUST load any skills it needs autonomously before beginning domain-specific work. The orchestrator SHALL NOT pass skill names as a parameter.

#### Scenario: Agent loads domain skill before working
- **WHEN** spawned with task "Scan this repo for security vulnerabilities"
- **THEN** the agent loads a security-relevant skill (e.g., security-review) before calling any scan tools

#### Scenario: Agent uses up to max_active_skills skills
- **WHEN** the task requires multiple domains (e.g., security + code quality)
- **THEN** the agent loads at most `max_active_skills` skills (default 3 for spawned agents)

### Requirement: Spawned agents have mid-loop compaction
Spawned agents SHALL have mid-loop context compaction enabled using the same `summary_llm` and compaction thresholds configured for spawned agents (tighter than orchestrator defaults: char_threshold=20000, message_threshold=15, retain_recent=5).

#### Scenario: Compaction fires during long spawned agent run
- **WHEN** a spawned agent's state exceeds 15 messages
- **THEN** compress_state is called before the next LLM invocation, replacing old messages with a summary block

### Requirement: spawn_agent emits a trace event
The `spawn_agent` tool SHALL emit a `subagent_spawned` trace event on each invocation containing: task (truncated to 200 chars), tools list, max_iterations, response length, and whether compaction fired.

#### Scenario: Trace event on successful spawn
- **WHEN** a spawned agent completes successfully
- **THEN** a `subagent_spawned` event is emitted with the fields above

