## ADDED Requirements

### Requirement: Summarize evicted messages before dropping
The system SHALL generate a concise summary of messages being evicted from the working memory window before they are removed, and inject the summary as a system message at the beginning of the retained context.

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

### Requirement: Summarization is configurable
The system SHALL read summarization configuration from `config.yml` under `memory.working`.

#### Scenario: Summarization disabled by config
- **WHEN** `memory.working.summarize_on_eviction` is `false`
- **THEN** the system uses the current `trim_messages` behavior without summarization

#### Scenario: Summary token limit is configurable
- **WHEN** `memory.working.summary_max_tokens` is set to a positive integer
- **THEN** the summarization LLM call uses that value as `max_tokens`

### Requirement: Existing summaries are re-summarized on subsequent evictions
The system SHALL include any existing `[Context Summary]` message in the next summarization input, so that context compounds across multiple eviction cycles rather than being lost.

#### Scenario: Cascading summaries preserve earlier context
- **WHEN** a `[Context Summary]` message already exists and a new eviction occurs
- **THEN** the existing summary plus the newly evicted messages are passed to the summarization LLM
- **AND** the result replaces the old summary message (one summary message at most)
