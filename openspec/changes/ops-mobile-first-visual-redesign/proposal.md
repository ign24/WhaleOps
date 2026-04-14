## Why

The `/ops` UI currently prioritizes desktop composition and does not provide a robust mobile-first experience, which leads to cramped layouts and horizontal scroll risk on smaller screens. We need a cohesive redesign now to align `/ops` with the existing `ui-cognitive` visual system and improve usability across device sizes.

## What Changes

- Redesign `/ops` layout with a mobile-first strategy and responsive breakpoints that avoid horizontal scroll.
- Add explicit mobile variants for key containers (stacked/cards) while preserving information hierarchy.
- Refine desktop layout density and spacing without regressing existing workflows.
- Standardize `/ops` styles with existing `ui-cognitive` tokens (color, spacing, radius, typography, elevation).
- Add baseline accessibility improvements (semantics, keyboard focus visibility, contrast checks).
- Define clear acceptance criteria for both mobile and desktop behavior.

## Capabilities

### New Capabilities
- `ops-mobile-first-layout`: Defines responsive `/ops` layout behavior, container variants, visual-system consistency, accessibility baseline, and cross-device acceptance criteria.

### Modified Capabilities
- None.

## Impact

- Affects `/ops` page layout and shared UI composition in `ui-cognitive`.
- May introduce or update design tokens and reusable responsive container primitives.
- Requires UI regression validation on mobile and desktop breakpoints.
- No backend/API contract changes expected.
