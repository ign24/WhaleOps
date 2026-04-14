## Context

`/ops` is a high-signal operational surface where users monitor service state, logs, and activity context. The current visual and layout behavior does not consistently scale from small screens upward, and some sections rely on desktop assumptions. The redesign must preserve existing functionality while aligning with `ui-cognitive` design language so `/ops` does not feel like a separate product.

Constraints:
- Keep current `/ops` feature set and information architecture intact.
- Avoid introducing horizontal scroll on viewport widths >= 320px.
- Reuse existing token system first; only add tokens when gaps are explicit.

Stakeholders:
- Ops users consuming `/ops` from laptop and mobile.
- Frontend maintainers responsible for cross-screen consistency in `ui-cognitive`.

## Goals / Non-Goals

**Goals:**
- Implement a true mobile-first responsive layout for `/ops`.
- Provide dedicated mobile container variants (stacked/cards) for dense desktop panels.
- Improve desktop layout rhythm, spacing, and readability.
- Keep styling consistent with established `ui-cognitive` tokens and components.
- Add baseline accessibility for structure, keyboard navigation, and contrast.
- Define objective acceptance criteria for desktop and mobile.

**Non-Goals:**
- Redesigning backend APIs or data-fetching contracts.
- Large visual rebrand of all `ui-cognitive` screens.
- Introducing advanced accessibility scope (full WCAG audit, screen-reader journey rewrite).

## Decisions

### 1) Mobile-first breakpoints and layout primitives
Decision: Build `/ops` layout from smallest viewport first, then enhance for tablet/desktop.

Rationale:
- Prevents desktop-only assumptions that create overflow.
- Makes component constraints explicit early (width, wrapping, stacking behavior).

Alternatives considered:
- Desktop-first with patch fixes per breakpoint: rejected due to recurring regressions.

### 2) Container variants by viewport
Decision: Introduce container variants for `/ops` sections:
- Mobile: stacked cards with reduced chrome and vertical scanning.
- Desktop: multi-column/panel composition with improved spacing and alignment.

Rationale:
- Preserves content parity while adapting density to device constraints.

Alternatives considered:
- Same container shape on all breakpoints: rejected because it forces compression or overflow on mobile.

### 3) Token-first visual consistency
Decision: Consume existing tokens/components from `ui-cognitive` before adding any new token.

Rationale:
- Guarantees consistency and lowers maintenance cost.

Alternatives considered:
- Local `/ops` style overrides: rejected to avoid visual drift.

### 4) Baseline accessibility guardrails
Decision: Enforce semantic landmarks/headings, visible focus states, minimum contrast, and keyboard reachability for primary interactions.

Rationale:
- Provides meaningful accessibility improvements within this redesign scope.

Alternatives considered:
- Accessibility deferred to later phase: rejected; baseline is required for production UI quality.

## Risks / Trade-offs

- Existing panel compositions may break when converted to stacked cards on mobile -> Mitigation: create explicit variant components and run breakpoint visual checks.
- Token reuse may expose gaps in current design system -> Mitigation: add minimal, named tokens and document usage.
- Desktop refinement can unintentionally reduce information density for power users -> Mitigation: keep critical metrics visible above the fold on common desktop sizes.
- Accessibility changes may require small markup refactors in shared components -> Mitigation: isolate semantic updates to `/ops` wrappers first, then propagate only when necessary.

## Migration Plan

1. Add responsive layout scaffolding and container variant primitives behind current `/ops` composition.
2. Migrate `/ops` sections incrementally to mobile/desktop variants.
3. Apply token alignment and remove local style deviations.
4. Validate acceptance criteria on mobile and desktop breakpoints.
5. Ship without backend changes; rollback by restoring previous `/ops` layout components if regressions appear.

## Open Questions

- Which exact breakpoint values are already canonical in `ui-cognitive` and should be reused unchanged?
- Do we need one intermediate tablet layout variant or only mobile + desktop?
