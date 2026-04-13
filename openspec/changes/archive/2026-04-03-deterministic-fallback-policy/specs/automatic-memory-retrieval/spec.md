## MODIFIED Requirements

### Requirement: Pre-fetch memory context at session start
The system SHALL automatically retrieve relevant memory context when processing the first user message in a session, before the LLM generates its first response.

#### Scenario: First message triggers parallel memory retrieval
- **WHEN** the agent receives the first user message in a new session
- **THEN** the system extracts intent signals (repo URL, keywords, task type) from the message
- **AND** queries episodic memory, domain knowledge, and recent findings in parallel
- **AND** composes a `[Memory Context]` block injected as a system message after the base prompt

#### Scenario: Recovery pass includes bounded failure context
- **WHEN** a request enters a deterministic recovery pass after a classified runtime failure
- **THEN** the workflow SHALL include bounded recovery context (failed attempts, blocked tool paths, completed checks) as non-directive context for replanning
- **AND** this recovery context SHALL NOT override instruction hierarchy priorities

### Requirement: Subsequent messages do not re-trigger retrieval
The workflow SHALL avoid re-running automatic external memory retrieval after the first user message in the same session.

#### Scenario: Later session messages skip external auto-retrieval
- **WHEN** the agent receives a second or later message in the same session
- **THEN** no automatic external memory retrieval occurs (the initial context persists in the message history)
- **AND** request-local recovery context MAY be appended only for the current request when deterministic fallback is active
