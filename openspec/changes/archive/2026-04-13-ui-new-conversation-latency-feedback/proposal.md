## Why

Creating a new conversation in `ui-cognitive` feels stalled because the UI gives no immediate acknowledgement after click while route transition and history bootstrap happen. This gap increases perceived latency and can lead to repeated clicks or uncertainty about whether the action worked.

## What Changes

- Add immediate pending feedback in the new-conversation trigger with subtle, Vercel-style continuity states during navigation.
- Introduce a `bootstrap=new` fast path so the chat panel can render a lightweight initial state without waiting on the normal history load path.
- Preserve existing UI language while adding dark/light token-safe visual treatment for pending and disabled states.
- Add explicit accessibility semantics for transient busy states (`aria-busy`, `aria-disabled`, and disabled control behavior).
- Add client-side performance instrumentation to measure click-to-feedback and click-to-ready timings for `/new` and freshly created sessions.
- Add/adjust frontend tests to validate pending UX, fast-path behavior, accessibility semantics, and instrumentation emission.

## Capabilities

### New Capabilities
- `new-conversation-pending-feedback`: The UI SHALL provide immediate, token-safe pending feedback and prevent duplicate create actions while a new session navigation is in flight.
- `bootstrap-new-fast-path`: Chat bootstrap SHALL support a lightweight `bootstrap=new` path that avoids blocking first paint on full history loading.
- `new-conversation-latency-instrumentation`: The frontend SHALL record and emit user-facing latency milestones for new conversation creation and `/new` startup.

### Modified Capabilities
- `split-chat-layout`: Existing split chat layout requirements are extended to include accessible busy/disabled semantics and pending continuity behavior during new conversation transitions.

## Impact

- Affects `ui-cognitive` chat creation flow and chat panel bootstrap behavior.
- Likely affects components/hooks around new conversation trigger, chat panel initialization, and route transition handling under `ui-cognitive/components/**` and `ui-cognitive/lib/**`.
- Affects frontend tests in `ui-cognitive/tests/**` (unit/integration UI behavior).
- No backend API contract changes; existing session/history endpoints remain unchanged.
