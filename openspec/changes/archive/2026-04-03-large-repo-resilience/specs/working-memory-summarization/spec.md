## MODIFIED Requirements

### Requirement: Summarize evicted messages before dropping
The system SHALL generate a concise summary of messages being evicted from the working memory window before they are removed, and inject the summary as a system message at the beginning of the retained context. Additionally, the system SHALL be aware of tool output size before messages enter the state, deferring to the tool output guard for truncation.

#### Scenario: Context window overflow triggers summarization
- **WHEN** the message count exceeds `max_history` and messages would be evicted by `trim_messages`
- **THEN** the system calls the LLM with the about-to-be-evicted messages and a summarization prompt, producing a summary of at most `summary_max_tokens` tokens
- **AND** the summary is inserted as an assistant message with prefix `[Context Summary]:` immediately after the system message
- **AND** the evicted messages are then removed from the context

#### Scenario: No summarization when window is not full
- **WHEN** the message count is less than or equal to `max_history`
- **THEN** no summarization occurs and messages are passed through unchanged

#### Scenario: Summarization failure degrades gracefully
- **WHEN** the summarization LLM call fails (timeout, API error)
- **THEN** the system proceeds with normal `trim_messages` behavior (drop without summary)
- **AND** a warning is logged with the error details

#### Scenario: Tool output guard runs before summarization
- **WHEN** a new tool message is appended to state and subsequently the working memory window is evaluated
- **THEN** the tool output guard has already truncated oversized outputs before the summarization step sees them
- **AND** summarization operates on already-guarded message content
