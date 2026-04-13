## MODIFIED Requirements

### Requirement: Historical activity viewing
The activity panel SHALL support viewing `intermediateSteps` from past messages. When a user activates a historical message's inline summary, the panel SHALL switch to display that message's stored activity entries.

Retry actions from chat error states SHALL NOT clear historical activity entries already attached to prior assistant messages.

#### Scenario: User clicks inline summary on a past message
- **WHEN** user clicks the inline activity summary on a non-current assistant message
- **THEN** the activity panel displays that message's `intermediateSteps` as timeline entries
- **AND** a "back to live" indicator is visible

#### Scenario: Returning to live mode
- **WHEN** user clicks "back to live" or a new streaming session begins
- **THEN** the panel returns to displaying the current `activityLog`

#### Scenario: Retry after failed message preserves historical activity
- **WHEN** user triggers `Reintentar` on a failed assistant message
- **THEN** previously stored `intermediateSteps` on older assistant messages remain available in historical mode
- **AND** only the latest in-flight assistant placeholder is replaced by the retried stream
