## Why

When streaming fails or gateway health is temporarily degraded, the UI can leave users without a clear recovery path. We need deterministic retry affordances in the frontend to preserve task continuity.

## What Changes

- Add an explicit "retry last message" action for assistant error responses.
- Add a "retry gateway check" action in gateway status when inactive.
- Add lightweight gateway health polling to avoid stale inactive state.
- Add tests for retry actions and disabled/loading behavior.

## Capabilities

### New Capabilities
- `chat-retry-actions`: User-visible retry controls for failed chat interactions and gateway connectivity.

### Modified Capabilities
- `activity-panel`: No semantic change in activity content, but retry UI must preserve ongoing activity rendering and sending state transitions.

## Impact

- Affected UI files: `ui-cognitive/components/chat/chat-panel.tsx`, `ui-cognitive/components/chat/gateway-status.tsx`.
- Affected tests: `ui-cognitive/tests/chat-panel.test.tsx` and new/updated gateway-status tests.
