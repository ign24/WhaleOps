## ADDED Requirements

### Requirement: Session ownership validation SHALL be implemented in a follow-up change

The current data model lacks a `userId` field on sessions. Adding session ownership requires a data model migration. This change documents the requirement for tracking but defers implementation.

#### Scenario: Deferred — authenticated users access sessions without ownership check
- **WHEN** an authenticated user requests any session endpoint
- **THEN** the request is processed (current behavior, unchanged in this change)
- **AND** this gap is tracked as immediate follow-up work requiring data model migration
