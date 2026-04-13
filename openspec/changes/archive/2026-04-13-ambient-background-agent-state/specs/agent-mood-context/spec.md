## ADDED Requirements

### Requirement: AgentMood type includes idle state
The system SHALL define an `AgentMood` type as `"idle" | "thinking" | "executing" | "agitated"`. The `"idle"` value SHALL represent the absence of active streaming.

#### Scenario: No streaming active
- **WHEN** no SSE streaming session is active
- **THEN** the agent mood SHALL be `"idle"`

#### Scenario: Streaming active
- **WHEN** an SSE streaming session is active
- **THEN** the agent mood SHALL reflect the value returned by `resolveStreamingMood`

### Requirement: React context provides mood app-wide
The system SHALL expose an `AgentMoodContext` with a provider and a `useAgentMood()` hook. The context SHALL default to `"idle"` when no provider is present.

#### Scenario: Component inside provider reads mood
- **WHEN** a component calls `useAgentMood()` inside the provider tree
- **THEN** it SHALL receive the current `AgentMood` value

#### Scenario: Component outside provider reads mood
- **WHEN** a component calls `useAgentMood()` without a parent provider
- **THEN** it SHALL receive `"idle"` as the default value

### Requirement: Mood updates during streaming lifecycle
The chat panel SHALL update the mood context when streaming mood changes and reset to `"idle"` when streaming ends.

#### Scenario: Mood transitions during streaming
- **WHEN** `resolveStreamingMood` returns a different mood than the current value
- **THEN** the context SHALL update to the new mood value

#### Scenario: Streaming ends
- **WHEN** the SSE streaming session completes or errors
- **THEN** the context SHALL reset to `"idle"`
