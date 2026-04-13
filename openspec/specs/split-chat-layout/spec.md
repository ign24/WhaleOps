## ADDED Requirements

### Requirement: Split layout with chat and activity panels
The chat session page SHALL render a `ChatSessionLayout` component that displays the chat panel and activity panel side by side using a CSS grid. The activity panel SHALL be collapsible.

#### Scenario: Desktop view with panel open
- **WHEN** viewport width is >= 1024px and the activity panel is open
- **THEN** the layout renders as a two-column grid with chat on the left and activity panel (320-380px) on the right

#### Scenario: Desktop view with panel closed
- **WHEN** viewport width is >= 1024px and the activity panel is closed
- **THEN** the chat panel fills the full content width

#### Scenario: Below 1024px with panel open
- **WHEN** viewport width is < 1024px and the user opens the activity panel
- **THEN** the panel renders as an overlay (slide-over from right) with a backdrop

### Requirement: Shared activity state
The `ChatSessionLayout` SHALL own the `activityLog: ActivityEntry[]` and `activeTool: string | null` state and pass them to both the chat panel and activity panel as props.

#### Scenario: Activity event during streaming
- **WHEN** the chat panel receives an `event: activity` SSE event
- **THEN** it calls the `onActivityEvent` callback provided by the layout
- **AND** both the inline summary in chat and the activity panel timeline update

#### Scenario: New message resets activity log
- **WHEN** a new user message is sent
- **THEN** the activity log is cleared (matching current behavior)

### Requirement: Panel state persistence
The activity panel open/closed state SHALL be persisted to `localStorage` so it survives page reloads.

#### Scenario: User closes panel and reloads
- **WHEN** user closes the activity panel and refreshes the page
- **THEN** the panel remains closed on reload

### Requirement: Grid transition animation
Opening and closing the activity panel SHALL animate the grid column transition.

#### Scenario: Panel toggle animation
- **WHEN** user toggles the activity panel open or closed
- **THEN** the grid columns animate over ~300ms with an ease timing function
