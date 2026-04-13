## ADDED Requirements

### Requirement: Visual streaming lifecycle SHALL be tracked independently from network streaming
The system SHALL maintain a `visualStreamingActive` lifecycle that starts when streamed content begins to render and ends only when the visible renderer queue is fully drained, even if the network stream has already completed.

#### Scenario: Network stream ends before visual render
- **WHEN** the SSE response closes and pending content remains in the typewriter/render queue
- **THEN** `visualStreamingActive` SHALL remain true until the queue is fully drained

#### Scenario: Visual streaming finalizes after queue drain
- **WHEN** all pending rendered tokens/words are displayed
- **THEN** `visualStreamingActive` SHALL transition to false exactly once

### Requirement: Chat auto-scroll SHALL follow visual streaming while user is attached to bottom
The system SHALL keep the chat viewport aligned to the latest message for the full `visualStreamingActive` window when the user remains attached to the bottom.

#### Scenario: Continuous follow during visual render
- **WHEN** `visualStreamingActive` is true and user has not manually detached from bottom
- **THEN** the chat viewport SHALL auto-scroll to the latest message during each visible render progression

#### Scenario: User detaches by manual upward scroll
- **WHEN** `visualStreamingActive` is true and user scrolls upward beyond the near-bottom threshold
- **THEN** auto-scroll SHALL pause immediately and remain paused until an explicit return-to-bottom action

### Requirement: Stop action SHALL cancel network stream without truncating buffered visual render
The system SHALL preserve the existing stop button behavior for network cancellation while allowing locally buffered visual content to finish rendering.

#### Scenario: User presses stop while render queue has buffered content
- **WHEN** the user clicks stop and the network request is aborted
- **THEN** no new network chunks SHALL be consumed
- **AND** already buffered visual content SHALL continue rendering until drained
