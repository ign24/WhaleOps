## Context

`ui-cognitive` currently creates a new conversation by pushing to `/chat/[sessionKey]?bootstrap=new` but does not expose an in-flight UI state before navigation settles. The destination chat panel then runs the default history bootstrap path on mount, so users perceive a dead click while route transition and history fetch complete.

The requested scope is frontend-only and must preserve the existing Vercel-style visual language (subtle transitions, low-noise cues) across both dark and light themes. No backend contract changes are allowed.

## Goals / Non-Goals

**Goals:**
- Provide immediate visual and semantic feedback after new-conversation click.
- Reduce perceived latency for `/new` and freshly created sessions via a bootstrap fast path.
- Ensure accessible transient states with correct busy and disabled semantics.
- Keep pending visuals token-safe for dark/light themes.
- Add instrumentation for click-to-feedback and click-to-ready latency milestones.

**Non-Goals:**
- Changing API routes, payload contracts, or backend session/history behavior.
- Redesigning the chat page layout or visual identity.
- Introducing global state libraries only for this interaction.

## Decisions

### 1. Local pending state at interaction source

**Choice**: Add a local `isCreatingConversation` state around the create action and set it synchronously before `router.push`.

**Why**: The earliest trustworthy feedback moment is at click handling time. Local state removes dependency on route lifecycle timing and gives deterministic duplicate-click protection.

**Alternative considered**: Use only route-transition detection for pending UI. Rejected because transition signals arrive later and do not guarantee immediate acknowledgement.

### 2. Bootstrap fast path for `bootstrap=new`

**Choice**: Teach chat bootstrap logic to detect `bootstrap=new` and skip blocking history fetch on first paint, rendering an empty-ready composer state first.

**Why**: New sessions start with no meaningful history for user intent. Rendering immediately and deferring/short-circuiting history load improves perceived responsiveness while preserving data correctness for non-new sessions.

**Alternative considered**: Keep mandatory history fetch and only show stronger skeletons. Rejected because it still blocks interaction on network latency.

### 3. Accessibility semantics as first-class state

**Choice**: Map pending state to `aria-busy` on the relevant container and `disabled`/`aria-disabled` semantics on actionable controls.

**Why**: Visual feedback alone is insufficient. Assistive technology must receive explicit busy/disabled signals, and keyboard users must not trigger repeated creation while in-flight.

**Alternative considered**: Use only visual classes and pointer-events CSS. Rejected because it is not semantically robust and can break keyboard/screen-reader expectations.

### 4. Token-safe pending styling

**Choice**: Reuse existing semantic tokens and motion primitives (opacity, subtle spinner, text tint shift) instead of hardcoded colors.

**Why**: Preserves current visual language and avoids dark/light regressions. Pending cues remain noticeable but restrained.

**Alternative considered**: New bespoke color palette for pending state. Rejected as unnecessary scope and higher theme risk.

### 5. Frontend latency instrumentation

**Choice**: Add client marks/events for: `create_click`, `feedback_visible`, `route_ready`, and optional `history_ready` when applicable.

**Why**: We need objective confirmation that UX changes improve click-to-feedback and perceived readiness. Local instrumentation can be consumed by current logging/analytics hooks without backend contract changes.

**Alternative considered**: Manual profiling only. Rejected because it is not continuous and cannot detect regressions automatically.

## Risks / Trade-offs

- **[State sync drift] Pending state could remain stuck on navigation failure** -> Always clear pending on route completion/error paths and add test coverage for failure/abort.
- **[Data freshness] Skipping immediate history fetch might hide pre-existing messages if session is not truly empty** -> Gate fast path strictly to `bootstrap=new`; keep default history behavior otherwise.
- **[A11y regressions] Disabled visuals without proper semantics** -> Require assertions for `aria-busy`, disabled button semantics, and keyboard behavior in tests.
- **[Theme mismatch] Subtle pending styles may be too weak/strong in one theme** -> Use token-based styles and validate in both dark and light snapshots/manual checks.
- **[Metric noise] Instrumentation events may fire out of order across rerenders** -> Use stable lifecycle boundaries and idempotent event guards keyed by session creation attempt.

## Migration Plan

1. Land test scaffolding first for pending behavior, fast path branching, and instrumentation signals.
2. Implement pending UI and accessible semantics behind current create flow.
3. Implement `bootstrap=new` fast path in chat initialization while preserving default branch.
4. Wire instrumentation and verify event order in tests.
5. Run frontend lint/test/build and do manual dark/light interaction verification.

Rollback is low risk: remove fast-path branch and pending-specific UI states to restore prior behavior without API changes.

## Open Questions

- Should `/new` emit the same latency event names as explicit "New conversation" clicks, or use separate event namespaces for analysis?
- Do we want history fetch for `bootstrap=new` to be fully skipped or deferred until first assistant response/message send?
