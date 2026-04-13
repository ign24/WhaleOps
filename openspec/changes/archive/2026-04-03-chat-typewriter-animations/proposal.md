## Why

The chat frontend dumps the full assistant response at once because LangGraph uses `stream_mode="updates"` (node-level, not token-level), so the UI receives one large chunk per response and renders it instantly. Users see no visual rhythm — no sense the agent is "writing" — which feels abrupt and impersonal. Additionally, the `tailwind.config.js` carries 6 dead keyframes (flicker, glitch, ghost, flash, crack, darken) that ship with zero usage, adding bundle noise.

## What Changes

- **Remove** 6 unused keyframes from `tailwind.config.js`: `flicker`, `glitch`, `ghost`, `flash`, `crack`/`crack1`, `darken`
- **Add** `useTypewriter` hook: buffers incoming WS content chunks and drains them word-by-word at adaptive speed via `requestAnimationFrame`
- **Add** 2 new keyframes: `stream-reveal` (fade + translateY) and `stream-fade` (opacity only) for block-level element entrances
- **Modify** `ChatMessage.tsx`: accept `isStreaming` prop, apply `.message-streaming` CSS class on the active message container, append blinking cursor ▍ while streaming
- **Modify** `Chat.tsx`: detect last assistant message during streaming, pass `isStreaming` flag
- **Modify** `MemoizedChatMessage.tsx`: include `messageIsStreaming` in memo equality check so the active message re-renders when streaming state changes
- **Add** CSS rules in `globals.css`: `.message-streaming` selectors animate `p`, `h1-h3`, `pre`, `blockquote`, `ul`, `ol`, `table` with `stream-reveal` or `stream-fade` on appearance

## Capabilities

### New Capabilities

- `typewriter-simulation`: Client-side word-queue hook that progressively reveals streamed content with adaptive speed (slow for short responses, faster for long ones) using `requestAnimationFrame`, avoiding artificial delays
- `message-stream-animations`: CSS-driven entrance animations per markdown element type (paragraph, heading, code block, table, list) applied only to the currently-streaming message via a container class

### Modified Capabilities

*(none — no existing specs are affected)*

## Impact

- **`ui/tailwind.config.js`**: remove 6 keyframes + 6 animation entries, add 2 keyframes + 2 animation entries
- **`ui/styles/globals.css`**: add `.message-streaming` CSS rules
- **`ui/hooks/useTypewriter.ts`**: new file
- **`ui/components/Chat/ChatMessage.tsx`**: `isStreaming` prop, `.message-streaming` class, cursor ▍
- **`ui/components/Chat/Chat.tsx`**: pass `isStreaming` to last assistant message
- **`ui/components/Chat/MemoizedChatMessage.tsx`**: memo comparator update
- No backend changes, no new dependencies, no API changes
