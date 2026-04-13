## Why

`ui-cognitive` still exposes mixed English labels in the live agent activity experience, which creates an inconsistent Spanish UX. In parallel, the streaming pipeline can emit the same activity step through multiple paths, causing duplicated timeline rows and incorrect counters.

## What Changes

- Localize all user-facing activity notifications, status labels, and meta summaries in the chat/activity UI to Spanish.
- Normalize activity event handling across `nat-client`, the chat API streaming route, and chat panel state updates so duplicated streaming steps are coalesced instead of appended twice.
- Align inline and panel-level activity summaries with the same Spanish terminology and counting rules.
- Preserve backward-compatible event ingestion for existing payload shapes while introducing deterministic de-duplication keys in the frontend pipeline.

## Capabilities

### New Capabilities
- `activity-stream-deduplication`: deterministic de-duplication of streaming activity events before they reach UI rendering state.

### Modified Capabilities
- `activity-panel`: activity timeline labels, empty state, and session metadata copy are presented in Spanish and remain consistent during live/historical views.
- `session-meta-bar`: top bar indicators and inline activity summary strings are presented in Spanish with consistent count/duration wording.
- `split-chat-layout`: shared activity state ingestion avoids duplicate entries when equivalent events arrive from multiple streaming paths.

## Impact

- Affected code: `ui-cognitive/lib/nat-client.ts`, `ui-cognitive/app/api/chat/route.ts`, `ui-cognitive/components/chat/chat-panel.tsx`, `ui-cognitive/components/activity/session-meta.ts`, `ui-cognitive/components/chat/inline-activity-summary.tsx` (plus `agent-step-card.tsx`/`tool-call-card.tsx` only if required for copy consistency).
- UX impact: activity-related microcopy changes to Spanish in live chat, inline summaries, and activity side panel.
- Runtime behavior: reduced double-counting in activity timelines and metrics during streaming.
- Verification: component-level rendering checks plus streaming regression test that asserts no duplicate activity rows for identical event identifiers.
