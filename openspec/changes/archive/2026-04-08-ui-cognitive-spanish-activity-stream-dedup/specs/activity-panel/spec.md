## ADDED Requirements

### Requirement: Activity panel user-facing copy is Spanish
All user-facing labels, placeholders, and status text in the activity panel and session metadata row SHALL be displayed in Spanish.

#### Scenario: Empty activity state
- **WHEN** no activity entries exist for the selected view
- **THEN** the panel displays a Spanish empty-state message

#### Scenario: Timeline entry status labels
- **WHEN** timeline entries are rendered with running/completed/failed states
- **THEN** the visible status descriptors use Spanish terms consistently

### Requirement: Activity panel terminology is consistent with inline summaries
The activity panel SHALL use the same Spanish terminology for tools, duration, and active state as the chat inline summary and top meta bar.

#### Scenario: User compares panel and inline summary during streaming
- **WHEN** activity data is visible both inline and in the panel
- **THEN** both surfaces use equivalent Spanish wording for count and duration concepts
