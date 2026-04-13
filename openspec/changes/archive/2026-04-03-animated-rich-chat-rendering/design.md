## Context

`ui-cognitive` already streams chat content quickly, but visual differentiation between block types is limited. The change must improve scanability and perceived polish without regressing first-content visibility during streaming. Constraints: frontend-only scope, no backend/API changes, and strict accessibility support via `prefers-reduced-motion`.

## Goals / Non-Goals

**Goals:**
- Render chat message content immediately, with no animation gate before content becomes visible.
- Apply progressive, block-type-specific enhancements for text, lists, code blocks, activity blocks, and callouts.
- Keep animation behavior deterministic and testable in component/unit tests.
- Provide reduced-motion behavior that preserves hierarchy and readability with minimal or no motion.

**Non-Goals:**
- Redesign overall chat layout or message data model.
- Introduce backend-driven animation metadata.
- Add heavy runtime animation libraries that increase bundle cost or hydration complexity.

## Decisions

1. **Progressive enhancement over entry gating**
   - Decision: Content is painted in its final readable state first, then enhancement classes are applied in the next animation frame or micro-delay.
   - Rationale: Prevents perceived latency and keeps streaming responsive.
   - Alternative considered: Hide-until-animate entry transitions; rejected because it increases perceived delay and harms streaming UX.

2. **Block semantic mapping in markdown renderer**
   - Decision: Assign stable semantic hooks per block type in `message-markdown` and `code-block` (for example via class names or data attributes) and centralize motion tokens in styles.
   - Rationale: Keeps behavior consistent, easy to test, and avoids ad-hoc per-component animation logic.
   - Alternative considered: Inline animation logic in each component; rejected due to duplication and drift risk.

3. **CSS-first animation strategy**
   - Decision: Use CSS keyframes/transitions with shared timing tokens and low-cost properties (`opacity`, `transform`) to avoid main-thread heavy animation.
   - Rationale: Small footprint, low runtime overhead, easy reduced-motion override.
   - Alternative considered: JavaScript animation frameworks; rejected due to unnecessary complexity and potential perf cost.

4. **Reduced-motion as first-class variant**
   - Decision: Add explicit `@media (prefers-reduced-motion: reduce)` overrides that disable or significantly minimize motion while preserving visual emphasis through static styling.
   - Rationale: Accessibility compliance and predictable behavior for sensitive users.
   - Alternative considered: Global animation-off flag without design adjustments; rejected because it can reduce readability cues.

5. **Test coverage focused on behavior contracts**
   - Decision: Add/adjust tests for immediate render, progressive class application, and reduced-motion branches in chat-related components.
   - Rationale: Verifies UX/perf intent without brittle pixel assertions.
   - Alternative considered: Snapshot-only verification; rejected as insufficient for timing and accessibility behavior.

## Risks / Trade-offs

- **[Risk]** Too many staggered animations cause visual noise in long responses. -> **Mitigation**: Use short durations, cap stagger depth, and keep code/activity transitions subtler than text/list emphasis.
- **[Risk]** Progressive class timing can produce flaky tests. -> **Mitigation**: Use deterministic timers and explicit test utilities for animation-frame/microtask flushing.
- **[Risk]** CSS complexity increases maintenance burden. -> **Mitigation**: Centralize motion tokens and semantic class naming in one style module.
- **[Risk]** Reduced-motion path may drift from default path over time. -> **Mitigation**: Add dedicated reduced-motion tests for each block type family.

## Migration Plan

1. Introduce semantic block hooks in `message-markdown` and `code-block`.
2. Add shared animation tokens and per-block motion styles in chat styling modules.
3. Wire progressive enhancement trigger in `chat-panel` rendering flow.
4. Add/update tests for immediate render, progressive enhancement, and reduced-motion behavior.
5. Rollback strategy: disable progressive enhancement classes/tokens while keeping baseline readable rendering.

## Open Questions

- Should activity and callout blocks share one motion profile or remain distinct for semantic clarity?
- Do we need a user-level UI toggle in addition to `prefers-reduced-motion`, or is OS-level preference sufficient for this scope?

## Implementation Outcomes

- Activity and callout blocks remain distinct with dedicated semantic hooks and motion profiles.
- Scope keeps OS-level `prefers-reduced-motion` handling only; no additional user-level toggle was introduced in this change.
