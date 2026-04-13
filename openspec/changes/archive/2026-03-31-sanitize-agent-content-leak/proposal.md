## Why

When a sub-agent (e.g. `reader_agent`) fails with a recursion error, the LLM reproduces internal LangChain state — Python repr of `SystemMessage`, `HumanMessage`, `AIMessage`, `ToolMessage` objects — as visible chat text. This makes the UI unreadable and exposes implementation internals to the user.

## What Changes

- **New**: `ui-cognitive/lib/content-sanitizer.ts` — pure function that detects Python LangChain repr patterns in assistant message content and replaces them with a user-friendly error message.
- **Modify**: `ui-cognitive/components/chat/chat-panel.tsx` — apply the sanitizer when a streaming message completes (on `finish_reason=stop`), before the message is committed to state.

No backend changes. No changes to tool calls, SSE parser, or MessageMarkdown.

## Capabilities

### New Capabilities

- `agent-content-sanitizer`: Detects and redacts internal agent state leaks in assistant message content before display.

### Modified Capabilities

<!-- None — no existing spec-level behavior changes -->

## Impact

- `ui-cognitive/lib/content-sanitizer.ts` — new file
- `ui-cognitive/components/chat/chat-panel.tsx` — one call added at message completion
- `ui-cognitive/tests/` — unit tests for sanitizer logic
- No backend, no API, no tool changes
