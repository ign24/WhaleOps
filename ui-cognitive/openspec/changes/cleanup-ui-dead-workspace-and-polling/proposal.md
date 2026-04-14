## Why

The UI still carries workspace-related frontend code and `/api/workspace/*` remnants that are no longer part of active runtime flows. This increases maintenance cost and regression surface, and duplicated jobs polling generates unnecessary network load.

## What Changes

- Remove dead workspace-related UI code only when reference checks confirm no runtime usage.
- Remove orphan `/api/workspace/*` UI calls, stubs, and tests that no longer map to supported backend flows.
- Clean up clearly unused components/hooks with a safe-delete policy: if usage is uncertain, mark as deferred instead of deleting.
- Consolidate job polling into a single shared polling path to prevent duplicate requests and race-prone refresh loops.
- Preserve critical flows without behavioral changes: login, chat streaming, sessions, ops, and admin.

## Capabilities

### New Capabilities
- `ui-runtime-cleanup-safety`: Enforce reference-validated cleanup with defer-on-uncertainty and explicit critical-flow protection.
- `unified-job-polling`: Provide one polling source of truth for job state updates and remove duplicated polling requests.

### Modified Capabilities
- None.

## Impact

- Affected frontend areas: `app/`, `components/`, `hooks/`, `lib/`, `tests/` where workspace remnants and polling duplication currently exist.
- Affected API surface in UI layer: internal calls/stubs/tests for `/api/workspace/*`.
- Expected performance impact: fewer polling requests and reduced render/update churn in job-related views.
- Expected code health impact: smaller dead-code footprint and lower accidental coupling with deprecated workspace behavior.
