## ADDED Requirements

### Requirement: Persist session summaries at session end
The system SHALL generate and persist a session summary when a conversation session ends, containing the key topics discussed, tools used, repos analyzed, outcomes, and any user preferences expressed.

#### Scenario: Session ends normally
- **WHEN** the agent completes its final response in a session (no more messages for 5 minutes or explicit session close)
- **THEN** the system generates a session summary using the LLM
- **AND** persists it as a `MemoryItem` in Redis via NAT's `RedisEditor` with tags including `session-summary`, repo identifiers, and a timestamp
- **AND** the embedding is generated using the same NIM embedder used for findings

#### Scenario: Session ends with error
- **WHEN** the agent session terminates due to an error or timeout
- **THEN** the system still persists a session summary with `outcome: error` in metadata
- **AND** includes the error context in the summary text

#### Scenario: Redis unavailable at session end
- **WHEN** Redis is unavailable when attempting to persist the session summary
- **THEN** the system logs a warning and proceeds without persisting
- **AND** does not retry or queue the summary for later persistence

### Requirement: Episodic memories have structured metadata
Each episodic memory item SHALL include metadata fields: `session_id`, `repo_id` (if applicable), `timestamp`, `outcome` (completed/abandoned/error), `findings_count`, and `tools_used` (list of tool names invoked during the session).

#### Scenario: Memory item contains all required metadata
- **WHEN** a session summary is persisted
- **THEN** all metadata fields are populated from the session context
- **AND** `tools_used` contains the deduplicated list of tool names called during the session

### Requirement: Episodic memories expire after configurable TTL
Episodic memories SHALL have a TTL controlled by `memory.episodic.ttl_days` in config, defaulting to 90 days.

#### Scenario: Old memories expire automatically
- **WHEN** a memory item has been stored for longer than `ttl_days`
- **THEN** Redis expires the key automatically via the TTL set at write time

### Requirement: Episodic memories are searchable by vector similarity
The system SHALL support retrieving episodic memories by vector similarity search on the summary text, optionally filtered by tags.

#### Scenario: Search returns relevant past sessions
- **WHEN** the auto-retrieval system queries episodic memory with a text query
- **THEN** the system returns the top N most similar session summaries (N controlled by `memory.episodic.max_sessions_retrieved`)
- **AND** results are ordered by similarity score descending
