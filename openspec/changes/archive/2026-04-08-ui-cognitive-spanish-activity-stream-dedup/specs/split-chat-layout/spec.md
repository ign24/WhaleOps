## ADDED Requirements

### Requirement: Shared activity state applies dedup before fan-out
Before updating shared activity state, `ChatSessionLayout`/chat ingestion logic SHALL apply live event deduplication and only publish unique entries to chat inline summaries and the activity panel.

#### Scenario: Duplicate event arrives while panel is open
- **WHEN** an event with an already-seen dedupe identity arrives during the current stream
- **THEN** shared `activityLog` is not appended
- **AND** neither the inline summary nor panel timeline increments

#### Scenario: Unique event arrives while panel is open
- **WHEN** an event with a new dedupe identity arrives
- **THEN** shared `activityLog` appends once
- **AND** both the inline summary and panel timeline update exactly once

### Requirement: Live and historical activity views keep deterministic counts
Switching between historical message activity and live stream activity SHALL preserve deduplicated counts for live data while leaving historical `intermediateSteps` unchanged.

#### Scenario: User opens historical summary then returns to live
- **WHEN** user switches from historical activity view back to live mode during or after streaming
- **THEN** live counters and timeline entries reflect deduplicated live events only
- **AND** historical message activity remains as originally stored
