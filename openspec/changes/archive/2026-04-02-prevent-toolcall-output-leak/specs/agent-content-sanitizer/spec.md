## MODIFIED Requirements

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
