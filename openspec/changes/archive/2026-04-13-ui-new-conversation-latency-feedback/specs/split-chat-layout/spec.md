## MODIFIED Requirements

### Requirement: Split layout with chat and activity panels
The chat session page SHALL render a `ChatSessionLayout` component that displays the chat panel and activity panel side by side using a CSS grid. The activity panel SHALL be collapsible. During new-conversation transitions, the layout and primary creation controls SHALL expose accessible busy/disabled semantics that preserve interaction continuity.

#### Scenario: Desktop view with panel open
- **WHEN** viewport width is >= 1024px and the activity panel is open
- **THEN** the layout renders as a two-column grid with chat on the left and activity panel (320-380px) on the right

#### Scenario: Desktop view with panel closed
- **WHEN** viewport width is >= 1024px and the activity panel is closed
- **THEN** the chat panel fills the full content width

#### Scenario: Below 1024px with panel open
- **WHEN** viewport width is < 1024px and the user opens the activity panel
- **THEN** the panel renders as an overlay (slide-over from right) with a backdrop

#### Scenario: New conversation marks layout as busy
- **WHEN** a new conversation is being created and route transition is in flight
- **THEN** the active chat container exposes `aria-busy="true"`
- **AND** primary create controls expose disabled semantics until transition resolves
