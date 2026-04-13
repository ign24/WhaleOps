## ADDED Requirements

### Requirement: Classifier detects conversational intent before LLM dispatch
The system SHALL provide a `QueryClassifier` that analyzes the user message text using deterministic regex and keyword patterns, returning an `IntentClass` enum value without invoking any LLM or external service.

#### Scenario: Greeting is classified as CHAT
- **WHEN** the user message matches a greeting pattern (e.g., "hola", "hi", "hey", "buenos días", "gracias", "ok", "buenas")
- **THEN** the classifier returns `IntentClass.CHAT`

#### Scenario: Capability question is classified as CHAT
- **WHEN** the user message asks what the agent can do (e.g., "qué podés hacer", "what can you do", "cómo me ayudás", "help")
- **THEN** the classifier returns `IntentClass.CHAT`

#### Scenario: Short affirmation or acknowledgement is classified as CHAT
- **WHEN** the user message is a short acknowledgement with no analysis intent (e.g., "ok", "entendido", "dale", "perfecto", "understood", "got it")
- **THEN** the classifier returns `IntentClass.CHAT`

#### Scenario: Repository analysis query is not classified as CHAT
- **WHEN** the user message contains analysis-intent keywords (e.g., "analizá", "analiza", "review", "security", "refactor", "repo", "repositorio")
- **THEN** the classifier returns `IntentClass.UNKNOWN`

#### Scenario: Explicit mode prefix bypasses classifier
- **WHEN** the user message begins with a valid mode prefix (`/analyze`, `/refactor`, `/execute`)
- **THEN** the Tier 0 classifier is not invoked and mode routing proceeds as normal

### Requirement: Classifier is stateless and deterministic
The `QueryClassifier` SHALL have no instance state, no side effects, and return the same output for the same input string on every invocation.

#### Scenario: Repeated identical inputs return identical outputs
- **WHEN** `QueryClassifier.classify(text)` is called twice with the same string
- **THEN** both calls return the same `IntentClass` value

### Requirement: Classifier falls back to UNKNOWN on ambiguous input
Any message not clearly matching a CHAT pattern SHALL return `IntentClass.UNKNOWN`, which preserves existing routing behavior.

#### Scenario: Ambiguous message defaults to UNKNOWN
- **WHEN** the user message does not match any CHAT pattern
- **THEN** the classifier returns `IntentClass.UNKNOWN`
- **AND** the agent proceeds with the existing default mode resolution

### Requirement: Classifier integrates in the agent response path
The `_response_fn` in `safe_tool_calling_agent.py` SHALL invoke `QueryClassifier.classify()` on the last user message before mode resolution, and SHALL override the mode to `chat` if the result is `IntentClass.CHAT` and no explicit prefix was detected.

#### Scenario: Chat intent overrides default mode
- **WHEN** no explicit `/mode` prefix is present
- **AND** `QueryClassifier.classify()` returns `IntentClass.CHAT`
- **THEN** the resolved mode is set to `chat` (if `chat` is in `mode_runtimes`)

#### Scenario: Explicit prefix takes priority over classifier
- **WHEN** the user message begins with `/analyze`
- **AND** `QueryClassifier.classify()` would return `IntentClass.CHAT`
- **THEN** the resolved mode is `analyze`, not `chat`
