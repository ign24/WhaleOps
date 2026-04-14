## Context

`ui-cognitive` has evolved away from legacy workspace patterns, but parts of the frontend still contain workspace-specific code paths and `/api/workspace/*` leftovers that are not part of current product flows. In parallel, jobs polling logic exists in more than one path, which can trigger duplicate network requests for the same data window.

This change targets safe cleanup and polling consolidation with strict non-regression constraints for core user journeys: authentication, streaming chat, session lifecycle, ops views, and admin operations.

## Goals / Non-Goals

**Goals:**
- Remove confirmed-dead workspace code and orphan UI API integrations safely.
- Consolidate jobs polling into a single, reusable mechanism.
- Reduce unnecessary requests and document measurable performance gains.
- Keep all critical flows behaviorally unchanged.
- Prefer reversible edits, with explicit rollback points per phase.

**Non-Goals:**
- Redesigning chat, sessions, ops, or admin UX.
- Backend NAT protocol changes or server-side API redesign.
- Large-scale refactors unrelated to workspace dead code or polling duplication.
- Deleting code with unresolved usage ambiguity.

## Decisions

- **Decision: Phase cleanup behind reference validation and defer-first policy.**
  - Rationale: static imports, route bindings, and runtime usage can diverge; deleting uncertain paths can create hidden regressions.
  - Alternative considered: broad one-pass deletion. Rejected due to higher rollback risk.

- **Decision: Treat uncertain candidates as `defer` artifacts, not deletions.**
  - Rationale: preserves low-risk posture while still documenting technical debt candidates.
  - Alternative considered: keeping uncertain code untracked. Rejected because it loses visibility and follow-up accountability.

- **Decision: Move to a single jobs polling orchestrator with shared interval/backoff/cancellation rules.**
  - Rationale: avoids duplicate requests, reduces races, and centralizes lifecycle management.
  - Alternative considered: keeping multiple polling loops but tuning intervals. Rejected because duplication and coordination complexity remain.

- **Decision: Add before/after request instrumentation for jobs polling paths.**
  - Rationale: validates that performance improvement is real, not assumed.
  - Alternative considered: rely only on manual observation. Rejected due to low confidence and poor repeatability.

## Risks / Trade-offs

- [Hidden usage of apparently dead workspace code] -> Mitigate with reference checks, search across app/tests, and `defer` instead of delete when uncertain.
- [Polling consolidation changes update timing] -> Mitigate with parity checks for freshness and explicit acceptance criteria per impacted view.
- [Test brittleness after removing orphan stubs] -> Mitigate by updating tests in same phase and running focused + full validation.
- [Bundle improvements are small] -> Mitigate by reporting measured delta and keeping change justified by reliability/maintenance gains.

## Migration Plan

1. Baseline: inventory workspace-related symbols, `/api/workspace/*` references, and current jobs polling request frequency.
2. Cleanup phase A: remove only confirmed-dead workspace code and orphan tests/stubs.
3. Polling phase B: consolidate duplicate polling into one shared mechanism and remove old loops.
4. Validation phase C: run lint/tests/build plus functional critical-flow checklist.
5. Finalize: capture metrics deltas, document deferred candidates, and prepare rollback notes.

## Rollback Strategy

- Keep phase-sized commits so rollback can target cleanup or polling independently.
- If regressions appear in critical flows, rollback only the latest phase and keep previously validated phases.
- For polling-specific regressions, restore prior poller path quickly via revert while preserving non-related cleanup changes.

## Success Metrics

- **Requests reduced:** lower duplicate polling requests per active jobs view/session compared to baseline.
- **Bundle impact:** neutral or reduced JS bundle size for affected routes/components.
- **Critical flow stability:** no new failures in login, chat streaming, sessions, ops, and admin validations.
- **Maintenance signal:** reduced count of workspace dead references and orphan tests/stubs.

## Validation Checklist

### Functional
- Login works end-to-end from `/login` to authenticated app routes.
- Chat streaming remains stable (connect, stream, cancel, continue).
- Session create/list/select/delete behavior remains unchanged.
- Ops/job views still update correctly with consolidated polling.
- Admin user flows (list/create/update/delete) remain operational.

### Technical
- No remaining runtime imports/usages for removed workspace artifacts.
- No remaining UI calls/tests pointing to deprecated `/api/workspace/*` paths.
- Polling requests are not duplicated for the same resource window.
- `bun run lint`, `bun run test`, and `bun run build` pass.
- Performance notes include before/after request count and bundle impact.

## Open Questions

- Are any workspace remnants consumed by out-of-repo automation or local scripts? If uncertain, tag as deferred.
- Which jobs screens should define polling baseline windows (focus tab only vs background tabs)?
