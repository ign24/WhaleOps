## ADDED Requirements

### Requirement: Per-request cost estimation contract
The system SHALL return structured estimated-cost metadata for each chat request, including model key, estimated input/output token cost, cumulative session estimate, and budget status.

#### Scenario: Successful chat response
- **WHEN** a chat request completes successfully
- **THEN** response metadata includes estimated cost breakdown and current budget state

### Requirement: Session-level cost aggregation
The system SHALL expose session cost aggregates grouped by model and total estimated spend for UI observability surfaces.

#### Scenario: Session with multiple models
- **WHEN** a session contains requests across different models
- **THEN** the aggregate includes per-model estimated totals and global session total

#### Scenario: Session with no billable activity
- **WHEN** no requests have been executed in the session
- **THEN** the aggregate returns zero totals and empty per-model breakdown

### Requirement: Cost signals in chat UI
The UI SHALL display model cost category and current budget state in active chat surfaces where model context is shown.

#### Scenario: Active model displayed in selector/meta bar
- **WHEN** the chat header or selector renders active model context
- **THEN** cost category badge and budget-state indicator are visible
