## ADDED Requirements

### Requirement: Frontend latency milestones for new conversation flow
The frontend SHALL capture latency milestones for new conversation UX, including click-to-feedback and click-to-ready timings for explicit create actions and `/new` startup.

#### Scenario: Click to feedback metric
- **WHEN** a user initiates a new conversation
- **THEN** the frontend records a `create_click` milestone
- **AND** records a `feedback_visible` milestone when pending UI is shown

#### Scenario: Click to ready metric
- **WHEN** navigation resolves to the target new session route
- **THEN** the frontend records a `route_ready` milestone for that creation attempt
- **AND** timing can be derived from `create_click` to `route_ready`

#### Scenario: Optional history milestone for non-fast path
- **WHEN** history bootstrap is part of perceived readiness for a flow
- **THEN** the frontend records a `history_ready` milestone only when applicable
- **AND** absence of this milestone does not fail the interaction for `bootstrap=new` fast path

### Requirement: Instrumentation integrity
Latency instrumentation MUST emit at most one ordered milestone sequence per creation attempt.

#### Scenario: Re-render does not duplicate milestones
- **WHEN** components re-render during an in-flight create action
- **THEN** each milestone is emitted once for that attempt
- **AND** milestone ordering remains deterministic (`create_click` before subsequent milestones)
