## ADDED Requirements

### Requirement: Session meta bar labels are localized to Spanish
The session meta bar SHALL render user-facing labels in Spanish for active status, tool counts, duration descriptors, and activity panel affordances.

#### Scenario: Active stream label
- **WHEN** the assistant is actively streaming with activity entries
- **THEN** the active indicator text appears in Spanish

#### Scenario: Completed stream summary
- **WHEN** streaming completes
- **THEN** tool count and total duration labels remain in Spanish

### Requirement: Inline activity summary text is Spanish and format-stable
Inline activity summaries in assistant messages SHALL use Spanish wording while keeping deterministic count-duration formatting.

#### Scenario: Assistant message with activity steps
- **WHEN** an assistant message has activity entries
- **THEN** the inline summary displays Spanish copy for the activity metrics
- **AND** preserves stable numeric formatting for counts and seconds
