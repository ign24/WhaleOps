## MODIFIED Requirements

### Requirement: Pre-fetch memory context at session start
The system SHALL automatically retrieve relevant memory context when processing the first user message in a session, before the LLM generates its first response. Auto-retrieval SHALL be suppressed when the resolved execution mode is `chat`.

#### Scenario: First message triggers parallel memory retrieval
- **WHEN** the agent receives the first user message in a new session
- **AND** the resolved mode is NOT `chat`
- **THEN** the system extracts intent signals (repo URL, keywords, task type) from the message
- **AND** queries episodic memory, domain knowledge, and recent findings in parallel
- **AND** composes a `[Memory Context]` block injected as a system message after the base prompt

#### Scenario: Chat mode suppresses auto-retrieval
- **WHEN** the resolved mode is `chat`
- **THEN** no memory retrieval queries are made (Redis, Milvus, or otherwise)
- **AND** no `[Memory Context]` block is injected into the message list

#### Scenario: Subsequent messages do not re-trigger retrieval
- **WHEN** the agent receives a second or later message in the same session
- **THEN** no automatic memory retrieval occurs (the initial context persists in the message history)
