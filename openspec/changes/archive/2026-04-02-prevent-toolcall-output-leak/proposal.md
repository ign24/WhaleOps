## Why

In some analyze-mode conversations, internal tool-control markers (for example, `[TOOL_CALLS]reader_agent{...}`) are rendered as assistant text in the UI even when the tool actually executes correctly. This leaks orchestration internals to users, degrades trust, and creates confusion about whether a tool was called.

## What Changes

- Extend assistant-content sanitization to detect and suppress tool-control payload markers that can appear in streamed text tokens.
- Add explicit frontend handling rules so control-channel content (`[TOOL_CALLS]...`) is never committed to visible assistant messages.
- Add regression tests that reproduce the observed chat traces and verify final visible output is clean.
- Define an operator-facing fallback message when sanitization blocks leaked control payloads.

## Capabilities

### New Capabilities
- `tool-control-output-filtering`: Prevent control-plane tool markers from being displayed as assistant prose in streamed chat output.

### Modified Capabilities
- `agent-content-sanitizer`: Expand leak detection requirements to include tool-call control markers (for example `[TOOL_CALLS]...`) and mixed-content streamed chunks.

## Impact

- Affected UI code: `ui-cognitive/lib/content-sanitizer.ts`, `ui-cognitive/components/chat/chat-panel.tsx`, and SSE parsing-related tests.
- Affected behavior: assistant message rendering in streamed chat sessions.
- No backend API contract changes required; this is output-safety hardening on the client rendering path.
