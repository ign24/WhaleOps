## 1. TDD Harness (RED -> GREEN -> REFACTOR)

- [x] 1.1 Add/extend `ui-cognitive` tests to first fail on missing immediate pending feedback after create click (RED)
- [x] 1.2 Add/extend tests to first fail on duplicate-click prevention and disabled semantics during in-flight create (RED)
- [x] 1.3 Add/extend tests to first fail on `bootstrap=new` fast-path behavior vs default history bootstrap (RED)
- [x] 1.4 Add/extend tests to first fail on latency milestone emission/order (`create_click`, `feedback_visible`, `route_ready`) (RED)

## 2. Pending UX Continuity

- [x] 2.1 Implement local `isCreatingConversation` state in the create flow and set it synchronously before navigation (GREEN)
- [x] 2.2 Bind pending visuals to the existing Vercel-style interaction language (subtle spinner/text-state/opacity transitions) using existing tokens (GREEN)
- [x] 2.3 Block re-entry while pending and clear state on success/error transition completion paths (GREEN)

## 3. Bootstrap `new` Fast Path

- [x] 3.1 Add bootstrap branch in chat panel init to detect `bootstrap=new` and render immediately without blocking on default history gate (GREEN)
- [x] 3.2 Preserve unchanged default history bootstrap for routes without `bootstrap=new` (GREEN)
- [x] 3.3 Add fallback guard for missing/invalid bootstrap markers to avoid runtime errors (GREEN)

## 4. Accessibility and Theme-Safe Semantics

- [x] 4.1 Add `aria-busy` to the active chat/new-session container while creation is in flight (GREEN)
- [x] 4.2 Ensure actionable create controls expose proper disabled behavior (`disabled` / `aria-disabled`) for mouse and keyboard (GREEN)
- [x] 4.3 Verify pending-state styling remains token-safe in dark and light themes without hardcoded palette values (REFACTOR)

## 5. Performance Instrumentation

- [x] 5.1 Add frontend milestone capture for `create_click` and `feedback_visible` (GREEN)
- [x] 5.2 Add route-ready milestone capture (`route_ready`) and optional `history_ready` when applicable (GREEN)
- [x] 5.3 Add idempotency guard so one ordered milestone sequence is emitted per creation attempt (REFACTOR)

## 6. Validation and Cleanup

- [x] 6.1 Update tests to pass for all new requirements and refactor implementation for readability without changing behavior (REFACTOR)
- [ ] 6.2 Run `ui-cognitive` lint/test/build checks and confirm no regressions
- [ ] 6.3 Perform manual verification for `/new` and create-conversation flows in both dark and light themes

Notes:
- `bun run lint` and `bun run test` completed. `bun run build` is currently blocked by pre-existing TypeScript errors in `components/observability/charts/trend-area-chart.tsx` (outside this change scope).
- Manual verification via MCP browser automation is blocked in this environment due missing Playwright browser runtime (`chrome` not installed by tool backend).
