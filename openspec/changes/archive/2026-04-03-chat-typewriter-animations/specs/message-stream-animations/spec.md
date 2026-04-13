## ADDED Requirements

### Requirement: Dead keyframe removal
The system SHALL remove the following unused keyframes and their animation entries from `tailwind.config.js`: `flicker`, `glitch`, `ghost`, `flash`, `crack`, `crack1`, `darken`. No component references any of these animations.

#### Scenario: Build produces no unused keyframe CSS
- **WHEN** the frontend build completes after removal
- **THEN** none of the class names `animate-flicker`, `animate-glitch`, `animate-ghost`, `animate-flash`, `animate-crack`, `animate-darken` SHALL exist in the compiled CSS output

### Requirement: Block-level entrance animations during streaming
The system SHALL define two new Tailwind keyframes — `stream-reveal` and `stream-fade` — and apply them via CSS to block-level elements inside a `.message-streaming` container class.

- `stream-reveal`: `opacity: 0, translateY(4px)` → `opacity: 1, translateY(0)`, 280ms ease-out
- `stream-fade`: `opacity: 0` → `opacity: 1`, 200ms ease-out

Element mapping:
| Selector | Animation | Duration |
|----------|-----------|----------|
| `.message-streaming p` | `stream-reveal` | 280ms |
| `.message-streaming h1, h2, h3` | `stream-reveal` | 220ms |
| `.message-streaming pre` | `stream-reveal` | 400ms |
| `.message-streaming blockquote` | `stream-reveal` | 300ms |
| `.message-streaming ul, ol` | `stream-reveal` | 250ms |
| `.message-streaming table` | `stream-fade` | 350ms |

#### Scenario: New paragraph animates in during streaming
- **WHEN** a `<p>` element is created inside a `.message-streaming` container
- **THEN** it SHALL start at `opacity: 0, translateY(4px)` and transition to `opacity: 1, translateY(0)` over 280ms

#### Scenario: Historical messages are not animated
- **WHEN** a message container does NOT have the `.message-streaming` class
- **THEN** no `stream-reveal` or `stream-fade` animation SHALL apply to its child elements

#### Scenario: Reduced motion respected
- **WHEN** the user has `prefers-reduced-motion: reduce` set in their OS
- **THEN** all `stream-reveal` and `stream-fade` animations SHALL be suppressed (elements appear at `opacity: 1` immediately)

### Requirement: Streaming class applied only to the active message
The system SHALL apply the `.message-streaming` CSS class to the assistant message container only when both conditions are true: `messageIsStreaming === true` AND the message is the last assistant message in the conversation.

#### Scenario: Only last message gets streaming class
- **WHEN** `messageIsStreaming` is true and the conversation has 3 messages
- **THEN** only the container of the 3rd message (the active one) SHALL have `.message-streaming`
- **THEN** the 1st and 2nd message containers SHALL NOT have `.message-streaming`

#### Scenario: Class removed on stream complete
- **WHEN** `messageIsStreaming` flips to false
- **THEN** the `.message-streaming` class SHALL be removed from all containers immediately

### Requirement: MemoizedChatMessage re-renders on streaming state change
The `MemoizedChatMessage` memo comparator SHALL include `messageIsStreaming` as a comparison field so that the active message re-renders when streaming begins or ends.

#### Scenario: Memo allows re-render when streaming starts
- **WHEN** `messageIsStreaming` changes from false to true for the last message
- **THEN** `MemoizedChatMessage` SHALL not be blocked by the memo and SHALL re-render

#### Scenario: Memo allows re-render when streaming ends
- **WHEN** `messageIsStreaming` changes from true to false
- **THEN** `MemoizedChatMessage` SHALL re-render so the cursor ▍ is removed
