## 1. Gateway retry UX

- [x] 1.1 Add manual `Reintentar conexión` action to `GatewayStatus` for inactive state.
- [x] 1.2 Add periodic health polling with proper cleanup on unmount.
- [x] 1.3 Disable retry action while a health check is in flight.

## 2. Chat retry UX

- [x] 2.1 Add explicit `Reintentar` action for assistant error messages.
- [x] 2.2 Wire retry action to resend latest user message with existing send pipeline.
- [x] 2.3 Keep retry action disabled while `isSending` is true.

## 3. Continuity guarantees and tests

- [x] 3.1 Ensure historical activity entries are preserved across retry flows.
- [x] 3.2 Update/add tests for gateway retry button, polling behavior, and chat retry behavior.
- [x] 3.3 Run UI quality gates (`bun run lint`, `bun run test`, `bun run build`).
