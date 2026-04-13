## MODIFIED Requirements

### Requirement: Pre-fetch memory context at session start
The system SHALL automatically retrieve relevant memory context when processing the first user message in a session, before the LLM generates its first response, and SHALL include only memory sources that are enabled and ready.

#### Scenario: First message triggers retrieval with all sources ready
- **WHEN** the agent receives the first user message in a new session and all configured sources are ready
- **THEN** the system queries episodic memory and recent findings in parallel
- **AND** composes a `[Memory Context]` block injected as a system message after the base prompt

#### Scenario: One source unavailable at retrieval time
- **WHEN** the first message triggers retrieval and one configured source is unavailable
- **THEN** the unavailable source is omitted deterministically from retrieval
- **AND** the memory context block is built only from available sources
- **AND** a degraded-memory diagnostic is logged with source-specific reason

### Requirement: Each memory source can be independently disabled
The auto-retrieval system SHALL respect per-source enable flags and SHALL avoid runtime calls to disabled or unready sources.

#### Scenario: Episodic retrieval disabled
- **WHEN** `memory.auto_retrieval.include_episodic` is `false`
- **THEN** the `Previous Sessions` section is omitted from the memory context block
- **AND** no Redis query is made for episodic memories

#### Scenario: Episodic retrieval enabled but backend unready
- **WHEN** `memory.auto_retrieval.include_episodic` is `true` but episodic backend readiness is false
- **THEN** the `Previous Sessions` section is omitted from the memory context block
- **AND** no RedisEditor search call is attempted for that request
