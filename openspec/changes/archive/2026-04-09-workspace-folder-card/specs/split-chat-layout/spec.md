## MODIFIED Requirements

### Requirement: Split layout with chat and activity panels
The chat session page SHALL render a `ChatSessionLayout` component that displays the chat panel and activity panel side by side using a CSS grid. The activity panel column SHALL be collapsible and contain two stacked components: `ActivityPanel` (primary, flex-1) and `FolderCard` (secondary, fixed max-height).

#### Scenario: Desktop view with panel open
- **WHEN** viewport width is >= 1024px and the activity panel is open
- **THEN** the layout renders as a two-column grid with chat on the left and a right column (380px) containing `ActivityPanel` and `FolderCard` stacked vertically

#### Scenario: Desktop view with panel closed
- **WHEN** viewport width is >= 1024px and the activity panel is closed
- **THEN** the chat panel fills the full content width and neither `ActivityPanel` nor `FolderCard` render

#### Scenario: Below 1024px with panel open
- **WHEN** viewport width is < 1024px and the user opens the activity panel
- **THEN** the panel renders as an overlay (slide-over from right) with a backdrop containing only `ActivityPanel` (FolderCard is not shown in mobile overlay)

#### Scenario: Right column height distribution
- **WHEN** both `ActivityPanel` and `FolderCard` are visible
- **THEN** `ActivityPanel` takes the remaining height (`flex-1`) and `FolderCard` has a fixed maximum height of 280px with internal scrolling
