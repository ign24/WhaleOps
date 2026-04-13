## Context

The chat interface already supports manual regeneration, but retry affordances are not explicit for transport errors and gateway health degradation. Users can get stuck after an internal error message or stale "Gateway inactivo" indicator.

## Goals / Non-Goals

**Goals:**
- Provide one-click retry for failed assistant responses.
- Provide one-click gateway health recheck and periodic refresh.
- Keep sending-state and activity-log behavior consistent.

**Non-Goals:**
- Rework backend transport protocol.
- Change NAT error semantics.

## Decisions

1. Add `onRetryConnection` in `GatewayStatus` and render button only in `error` state.
2. Add polling (short interval) with cleanup to prevent stale gateway state.
3. Add explicit "Reintentar" action for assistant messages marked `isError` and wire to resend last user message.

## Risks / Trade-offs

- **[Risk] Retry spam** → Mitigation: disable retry buttons while `isSending` or check in progress.
- **[Risk] Polling overhead** → Mitigation: conservative interval and no-store fetch.
