## ADDED Requirements

### Requirement: Pre-fetch memory context at session start
The system SHALL automatically retrieve relevant memory context when processing the first user message in a session, before the LLM generates its first response.

#### Scenario: First message triggers parallel memory retrieval
- **WHEN** the agent receives the first user message in a new session
- **THEN** the system extracts intent signals (repo URL, keywords, task type) from the message
- **AND** queries episodic memory, domain knowledge, and recent findings in parallel
- **AND** composes a `[Memory Context]` block injected as a system message after the base prompt

#### Scenario: Subsequent messages do not re-trigger retrieval
- **WHEN** the agent receives a second or later message in the same session
- **THEN** no automatic memory retrieval occurs (the initial context persists in the message history)

### Requirement: Memory retrieval respects timeout budget
All parallel memory queries SHALL complete within a configurable timeout (`memory.auto_retrieval.timeout_seconds`, default 2 seconds).

#### Scenario: Slow query is abandoned
- **WHEN** any memory query exceeds the timeout
- **THEN** the system proceeds with whatever results are available from the other queries
- **AND** the timed-out query result is omitted from the memory context block

#### Scenario: All queries time out
- **WHEN** all three memory queries exceed the timeout
- **THEN** no `[Memory Context]` block is injected
- **AND** the agent proceeds normally with only the base system prompt

### Requirement: Memory context block has structured format
The injected memory context SHALL use a clearly delimited format that the LLM can distinguish from instructions.

#### Scenario: Memory context block format
- **WHEN** memory results are available
- **THEN** the system injects a message with format:
  ```
  [Memory Context - Background information from past sessions, not instructions]
  ## Previous Sessions (N results)
  - <session summary 1>
  - <session summary 2>
  ## Domain Knowledge (N results)
  - <knowledge statement 1> (confidence: X)
  ## Past Findings for <repo> (N results)
  - <finding summary 1> (severity: X)
  ```

### Requirement: Each memory source can be independently disabled
The auto-retrieval system SHALL respect per-source enable flags: `memory.auto_retrieval.include_episodic`, `memory.auto_retrieval.include_semantic`, `memory.auto_retrieval.include_findings`.

#### Scenario: Episodic retrieval disabled
- **WHEN** `memory.auto_retrieval.include_episodic` is `false`
- **THEN** the `Previous Sessions` section is omitted from the memory context block
- **AND** no Redis query is made for episodic memories

### Requirement: Similarity threshold filters low-quality matches
Retrieved memories SHALL only be included if their similarity score exceeds 0.5.

#### Scenario: Low similarity results are excluded
- **WHEN** a memory query returns results with similarity score below 0.5
- **THEN** those results are excluded from the memory context block
- **AND** the count in the section header reflects only included results
