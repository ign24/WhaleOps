## ADDED Requirements

### Requirement: Detect LangChain internal state leaks in assistant content
The system SHALL detect when assistant message content contains Python repr of LangChain message objects, internal framework state, or internal tool-control markers, using a set of known patterns. Detection SHALL occur on the fully accumulated content after streaming completes, not per token.

Patterns that SHALL trigger detection:
- `[SystemMessage(content=`
- `[HumanMessage(content=`
- `[AIMessage(content=`
- `[ToolMessage(content=`
- `additional_kwargs={`
- `GraphRecursionError(`
- `[TOOL_CALLS]`
- `[TOOL_`

#### Scenario: Content contains SystemMessage repr
- **WHEN** the completed assistant message content contains the substring `[SystemMessage(content=`
- **THEN** the sanitizer SHALL return the user-friendly error message instead of the original content

#### Scenario: Content contains ToolMessage repr
- **WHEN** the completed assistant message content contains the substring `[ToolMessage(content=`
- **THEN** the sanitizer SHALL return the user-friendly error message instead of the original content

#### Scenario: Content contains GraphRecursionError
- **WHEN** the completed assistant message content contains the substring `GraphRecursionError(`
- **THEN** the sanitizer SHALL return the user-friendly error message instead of the original content

#### Scenario: Content contains additional_kwargs
- **WHEN** the completed assistant message content contains the substring `additional_kwargs={`
- **THEN** the sanitizer SHALL return the user-friendly error message instead of the original content

#### Scenario: Content contains tool-calls marker
- **WHEN** the completed assistant message content contains the substring `[TOOL_CALLS]`
- **THEN** the sanitizer SHALL return the user-friendly error message instead of the original content

#### Scenario: Content contains tool control marker variant
- **WHEN** the completed assistant message content contains a substring starting with `[TOOL_`
- **THEN** the sanitizer SHALL return the user-friendly error message instead of the original content

#### Scenario: Normal content passes through unchanged
- **WHEN** the completed assistant message content contains no leak patterns
- **THEN** the sanitizer SHALL return the original content unmodified

#### Scenario: Empty content passes through unchanged
- **WHEN** the assistant message content is an empty string
- **THEN** the sanitizer SHALL return the empty string unmodified

### Requirement: Replace detected content with user-friendly error message
When a leak pattern is detected, the system SHALL replace the entire message content with a clear, actionable error message. The replacement MUST NOT include any portion of the original leaked content.

The replacement message SHALL be:
```
The agent encountered an internal error while processing the response. Please try again or narrow the scope of your request.
```

#### Scenario: Full replacement on detection
- **WHEN** any leak pattern is detected in the assistant message content
- **THEN** the entire original content SHALL be discarded
- **THEN** the replacement message SHALL be the complete content shown to the user

### Requirement: Log sanitized content for debugging
When a leak is detected and content is replaced, the system SHALL emit a `console.warn` with a label and a truncated preview (first 200 chars) of the original content, to aid in debugging without exposing the full leak to the user.

#### Scenario: Warning emitted on detection
- **WHEN** a leak pattern is detected
- **THEN** `console.warn` SHALL be called with a message identifying the sanitization event and a truncated preview of the original content

### Requirement: Apply sanitizer at message completion in chat panel
The chat panel SHALL apply the content sanitizer to every completed assistant message before committing it to UI state. "Completed" means the streaming has ended (finish_reason received or stream closed).

#### Scenario: Sanitizer applied on stream completion
- **WHEN** the assistant message stream ends with finish_reason stop
- **THEN** the accumulated content SHALL be passed through the sanitizer before being added to the messages array

#### Scenario: Sanitizer applied on stream close without finish_reason
- **WHEN** the SSE stream closes without an explicit finish_reason
- **THEN** any accumulated content SHALL still be passed through the sanitizer before being committed
