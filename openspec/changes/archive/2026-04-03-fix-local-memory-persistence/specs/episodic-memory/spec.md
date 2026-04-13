## MODIFIED Requirements

### Requirement: Episodic memories are searchable by vector similarity
The system SHALL support retrieving episodic memories by vector similarity search on the summary text, optionally filtered by tags, and SHALL perform this only when Redis exposes required search capabilities.

#### Scenario: Search returns relevant past sessions
- **WHEN** the auto-retrieval system queries episodic memory with a text query and Redis search capabilities are available
- **THEN** the system returns the top N most similar session summaries (N controlled by `memory.episodic.max_sessions_retrieved`)
- **AND** results are ordered by similarity score descending

#### Scenario: Redis lacks required search capabilities
- **WHEN** episodic search is requested and Redis does not support required vector-search commands
- **THEN** the system skips episodic search for that request
- **AND** logs a degraded-memory warning with the missing capability reason
- **AND** does not raise an exception to the user-facing workflow

### Requirement: Persist session summaries at session end
The system SHALL generate and persist a session summary when a conversation session ends, containing the key topics discussed, tools used, repos analyzed, outcomes, and any user preferences expressed, and SHALL skip persistence when episodic backend readiness is false.

#### Scenario: Session ends normally with episodic backend ready
- **WHEN** the agent completes its final response and episodic backend readiness is true
- **THEN** the system generates a session summary using the LLM
- **AND** persists it as a `MemoryItem` in Redis via NAT's `RedisEditor` with tags including `session-summary`, repo identifiers, and a timestamp

#### Scenario: Session ends with episodic backend unavailable
- **WHEN** the agent completes its final response but episodic backend readiness is false
- **THEN** the system skips persistence
- **AND** records a structured warning indicating episodic memory is unavailable
