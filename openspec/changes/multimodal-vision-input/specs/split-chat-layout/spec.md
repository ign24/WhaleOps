## MODIFIED Requirements

### Requirement: Split layout with chat and activity panels
The chat session page SHALL render a `ChatSessionLayout` component that displays the chat panel and activity panel side by side using a CSS grid. The activity panel SHALL be collapsible.

The chat input area SHALL support an inline model-switch suggestion banner between the file preview strip and the textarea when an image is attached with a non-vision model.

#### Scenario: Desktop view with panel open
- **WHEN** viewport width is >= 1024px and the activity panel is open
- **THEN** the layout renders as a two-column grid with chat on the left and activity panel (320-380px) on the right

#### Scenario: Desktop view with panel closed
- **WHEN** viewport width is >= 1024px and the activity panel is closed
- **THEN** the chat panel fills the full content width

#### Scenario: Below 1024px with panel open
- **WHEN** viewport width is < 1024px and the user opens the activity panel
- **THEN** the panel renders as an overlay (slide-over from right) with a backdrop

#### Scenario: Image attached with non-vision model
- **WHEN** user attaches an image and the current model does not support vision
- **THEN** the chat input area SHALL display a vision model suggestion banner between the file preview strip and the textarea
