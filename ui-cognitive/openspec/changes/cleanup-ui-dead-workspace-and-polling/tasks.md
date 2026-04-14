## 1. Baseline and Safety Inventory

- [ ] 1.1 Inventory workspace-related frontend artifacts (components, hooks, utils, routes, tests) and classify each as `remove` or `defer`.
- [ ] 1.2 Inventory all `/api/workspace/*` references in UI code and tests, mapping each reference to an active runtime owner or orphan status.
- [ ] 1.3 Capture jobs polling baseline metrics (request count per scope/view and polling sources) for before/after comparison.
- [ ] 1.4 Define explicit phase rollback points (cleanup phase and polling phase) in change notes.

## 2. Safe Workspace Cleanup

- [ ] 2.1 Remove only workspace artifacts classified as `remove` and keep uncertain candidates documented as `defer`.
- [ ] 2.2 Remove orphan `/api/workspace/*` calls, stubs, and linked tests in the same commit scope.
- [ ] 2.3 Update imports/exports/barrels after deletions and eliminate resulting dead references.
- [ ] 2.4 Run targeted checks for touched areas to ensure no unresolved symbols or route wiring issues.

## 3. Polling Consolidation

- [ ] 3.1 Identify all current jobs polling entry points and select one shared polling owner.
- [ ] 3.2 Implement unified polling lifecycle (subscribe/unsubscribe, interval/backoff, cancellation) in shared logic.
- [ ] 3.3 Migrate all jobs polling consumers to the shared path and remove duplicated polling loops.
- [ ] 3.4 Verify request deduplication behavior with concurrent consumers for the same jobs scope.

## 4. Regression and Quality Gates

- [ ] 4.1 Update or remove obsolete tests tied to deleted workspace behavior while preserving coverage for active features.
- [ ] 4.2 Add or adjust tests for unified polling behavior, including lifecycle and deduplication expectations.
- [ ] 4.3 Run `bun run lint` and fix all issues introduced by cleanup/consolidation.
- [ ] 4.4 Run `bun run test` and `bun run build` and record outcomes in change notes.

## 5. Functional Validation Checklist

- [ ] 5.1 Validate login flow from `/login` to authenticated app access.
- [ ] 5.2 Validate chat streaming behavior (connect, stream chunks, cancel/stop).
- [ ] 5.3 Validate session flows (create, list, open, update metadata, delete).
- [ ] 5.4 Validate ops views with consolidated polling (status freshness, no duplicate request bursts).
- [ ] 5.5 Validate admin user CRUD basic flow if impacted paths were touched.

## 6. Technical Validation, Metrics, and Rollback Readiness

- [ ] 6.1 Confirm no remaining runtime references to removed workspace artifacts and no orphan `/api/workspace/*` calls in UI.
- [ ] 6.2 Capture after-change polling metrics and compare against baseline to quantify request reduction.
- [ ] 6.3 Capture bundle impact for touched routes/components and note neutral/reduction outcome.
- [ ] 6.4 Finalize deferred list with reasons and follow-up owners for uncertain candidates.
- [ ] 6.5 Prepare rollback notes describing how to revert cleanup-only or polling-only phases independently.
