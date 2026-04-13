## ADDED Requirements

### Requirement: Activity panel card copy is fully Spanish
The system SHALL render all user-visible labels and headings inside activity panel cards in Spanish, including workspace-related card titles and empty-state messages.

#### Scenario: Workspace card title
- **WHEN** the user opens the activity panel and the workspace card is visible
- **THEN** the card title is shown in Spanish

#### Scenario: Timeline empty state
- **WHEN** there are no activity entries in the timeline
- **THEN** the empty-state message is shown in Spanish with correct accentuation

#### Scenario: Session metrics labels
- **WHEN** session info or summary cards are rendered
- **THEN** metric labels (e.g., duration and totals) are shown in Spanish
