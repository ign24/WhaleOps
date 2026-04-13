## ADDED Requirements

### Requirement: Base prompt contains environment section
The `base.md` SHALL contain an `<environment>` section that describes the agent's runtime context. This section SHALL be present in every mode because it is part of the base prompt.

#### Scenario: Agent knows its sandbox paths
- **WHEN** the agent needs to store or read files
- **THEN** the environment section tells it that `/tmp/analysis` is ephemeral (lost on restart) and `/app/workspace` is persistent (survives restarts)

#### Scenario: Agent knows its memory layers
- **WHEN** the agent starts a session
- **THEN** the environment section describes working memory (conversation context, summarized before eviction), episodic memory (session summaries, auto-saved/retrieved), and semantic memory (domain knowledge, vector search)

#### Scenario: Agent knows it can schedule recurring tasks
- **WHEN** a user asks for something recurring
- **THEN** the environment section tells the agent that `schedule_task` can create cron jobs that fire agent prompts on a schedule, and that schedules persist across restarts

#### Scenario: Agent knows it can execute code and shell commands
- **WHEN** a task requires running code or system commands
- **THEN** the environment section describes `code_exec` (Python sandbox with access to /tmp/analysis and /app/workspace) and `shell_execute` (arbitrary shell commands in the container)

#### Scenario: Agent knows its model catalog
- **WHEN** the agent needs to reason about its own capabilities
- **THEN** the environment section mentions that multiple LLM models are available via NVIDIA NIM and that the active model is selected per mode, with switchable alternatives

### Requirement: Environment section is factual and concise
The `<environment>` section SHALL be under 300 words. It SHALL state facts about the runtime (paths, capabilities, constraints) without prescribing how to use them.

#### Scenario: Environment does not prescribe tool usage order
- **WHEN** the environment section describes available paths
- **THEN** it states what each path is for, not when or how to use them

#### Scenario: Environment does not duplicate tool documentation
- **WHEN** the environment section mentions a tool capability (e.g., scheduling)
- **THEN** it provides a one-line description, not full parameter docs (tools have their own descriptions)
