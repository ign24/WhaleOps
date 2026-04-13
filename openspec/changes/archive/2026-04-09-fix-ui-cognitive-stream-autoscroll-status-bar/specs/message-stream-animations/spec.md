## MODIFIED Requirements

### Requirement: Streaming class applied only to the active message
The system SHALL apply the `.message-streaming` CSS class to the assistant message container only when both conditions are true: `visualStreamingActive === true` AND the message is the last assistant message in the conversation.

#### Scenario: Only last message gets streaming class
- **WHEN** `visualStreamingActive` is true and the conversation has 3 messages
- **THEN** only the container of the 3rd message (the active one) SHALL have `.message-streaming`
- **THEN** the 1st and 2nd message containers SHALL NOT have `.message-streaming`

#### Scenario: Class persists while visual render is pending
- **WHEN** network streaming has ended but visual rendering is still draining queued content
- **THEN** `.message-streaming` SHALL remain applied to the active assistant message

#### Scenario: Class removed on visual completion
- **WHEN** `visualStreamingActive` flips to false
- **THEN** the `.message-streaming` class SHALL be removed from all containers immediately

### Requirement: MemoizedChatMessage re-renders on streaming state change
The `MemoizedChatMessage` memo comparator SHALL include visual streaming state (`visualStreamingActive`) as a comparison field so that the active message re-renders when visual streaming begins or ends.

#### Scenario: Memo allows re-render when visual streaming starts
- **WHEN** `visualStreamingActive` changes from false to true for the last message
- **THEN** `MemoizedChatMessage` SHALL not be blocked by the memo and SHALL re-render

#### Scenario: Memo allows re-render when visual streaming ends
- **WHEN** `visualStreamingActive` changes from true to false
- **THEN** `MemoizedChatMessage` SHALL re-render so visual streaming affordances are removed
