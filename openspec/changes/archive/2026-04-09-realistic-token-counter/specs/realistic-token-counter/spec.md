## ADDED Requirements

### Requirement: Token counter SHALL expose precision level
The chat UI SHALL display token counters with explicit precision semantics. Estimated values MUST be visually distinguished from real values.

#### Scenario: User is typing in the composer
- **WHEN** the user is editing a message before sending
- **THEN** the UI shows an estimated input token count marked as estimated (for example with `~` or `estimado`)

#### Scenario: Assistant response is streaming without final usage yet
- **WHEN** assistant text deltas are being received and no final usage payload has arrived
- **THEN** any displayed output/total token counters remain marked as estimated

### Requirement: Final backend usage SHALL reconcile displayed counters
When the backend provides final usage for a chat completion, the UI MUST reconcile counters to that payload and mark them as real.

#### Scenario: Usage event arrives before stream completion
- **WHEN** a valid usage payload with prompt/completion/total counts is received from the server
- **THEN** the UI replaces provisional values with those counts and marks precision as real

#### Scenario: Usage event is absent
- **WHEN** the stream completes without a real usage payload
- **THEN** the UI keeps estimated counters and continues to mark them as estimated

### Requirement: Usage transport SHALL be explicit in SSE contract
The BFF chat route SHALL emit a dedicated SSE event for token usage with a normalized payload that includes counts and estimation status.

#### Scenario: Backend returns real usage
- **WHEN** the backend completion includes real prompt/completion/total usage
- **THEN** the BFF emits `event: usage` containing normalized counts and `isEstimated=false`

#### Scenario: Backend uses fallback estimation
- **WHEN** the backend cannot extract provider usage metadata and falls back to estimation
- **THEN** the BFF emits `event: usage` containing normalized counts and `isEstimated=true`
