## 1. Layout customization controls

- [x] 1.1 Add explicit UI controls for editable workspace layout preferences in `ui-cognitive` layout shell (without touching auth/API-sensitive files)
- [x] 1.2 Implement free activity-panel resize (with safety bounds) and sidebar preference options wired to existing layout components
- [x] 1.3 Persist and restore preferences from `localStorage` with safe default + invalid-value fallback handling

## 2. UX affordance policy for layout interactions

- [x] 2.1 Standardize hover/focus-visible/disabled states for interactive layout controls using existing design tokens
- [x] 2.2 Add or refine tooltips for critical icon-only/collapsed actions in sidebar and chat layout controls
- [x] 2.3 Verify light/dark contrast and keyboard navigation behavior for updated controls

## 3. Regression safety and validation

- [x] 3.1 Add/update frontend tests covering layout preference persistence and split behavior restoration
- [x] 3.2 Add/update tests for tooltip availability and basic interaction affordances on collapsed/expanded states
- [ ] 3.3 Run frontend quality checks (`bun run lint`, `bun run test`, `bun run build`) and fix any regressions from this change
