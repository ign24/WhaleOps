## ADDED Requirements

### Requirement: Word-queue typewriter hook
The system SHALL provide a `useTypewriter` hook that accepts `content: string` and `isStreaming: boolean` and returns `displayedContent: string`. The hook SHALL buffer incoming content changes in a ref-based queue and drain it word-by-word using `requestAnimationFrame`, never via `setInterval` or `setTimeout` polling.

#### Scenario: Content arrives in one chunk while streaming
- **WHEN** `isStreaming` is true and `content` updates from `""` to `"Hello world how are you today"`
- **THEN** `displayedContent` SHALL progress through `"Hello"`, `"Hello world"`, `"Hello world how"`, etc. at the configured drain speed until the full content is displayed

#### Scenario: Adaptive speed for short responses
- **WHEN** the queue contains 30 or fewer words
- **THEN** the hook SHALL drain 1 word per 40ms (approximately natural typing pace)

#### Scenario: Adaptive speed for medium responses
- **WHEN** the queue contains 31–150 words
- **THEN** the hook SHALL drain 3 words per 16ms frame

#### Scenario: Adaptive speed for long responses
- **WHEN** the queue contains more than 150 words
- **THEN** the hook SHALL drain 10 words per 16ms frame

#### Scenario: Queue drains after streaming ends
- **WHEN** `isStreaming` flips to false while the queue still has pending words
- **THEN** the hook SHALL continue draining at fast speed (10 words/frame) until the queue is empty, then stop the rAF loop

#### Scenario: Cleanup on unmount
- **WHEN** the component using `useTypewriter` unmounts while draining
- **THEN** the hook SHALL cancel the active `requestAnimationFrame` callback and stop all state updates

#### Scenario: New conversation resets state
- **WHEN** `content` resets to `""` (new message or conversation change)
- **THEN** `displayedContent` SHALL reset to `""` and the queue SHALL clear immediately

### Requirement: Cursor indicator during streaming
The system SHALL render a blinking `▍` cursor character immediately after `displayedContent` in the assistant message while `isStreaming` is true and the queue is not fully drained.

#### Scenario: Cursor visible while writing
- **WHEN** `isStreaming` is true and `displayedContent` is shorter than `content`
- **THEN** a `▍` element with `animate-blink` class SHALL be rendered inline after the last visible character

#### Scenario: Cursor disappears when streaming ends
- **WHEN** `isStreaming` becomes false AND the queue is fully drained
- **THEN** the `▍` cursor SHALL no longer be rendered
