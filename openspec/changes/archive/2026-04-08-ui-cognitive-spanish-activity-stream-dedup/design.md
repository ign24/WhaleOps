## Context

`ui-cognitive` currently builds activity UX copy from mixed hardcoded strings across multiple components (`session-meta`, `inline-activity-summary`, timeline cards). This causes English/Spanish drift and inconsistent labels for the same concepts. In addition, activity updates can be appended from more than one streaming path (`nat-client` intermediate events plus transformed server route events), so equivalent steps are sometimes duplicated in `activityLog`, inflating counters and durations.

The requested scope touches transport (`nat-client.ts`, `api/chat/route.ts`) and presentation (`chat-panel.tsx`, `session-meta.ts`, `inline-activity-summary.tsx`). The design must keep existing payload compatibility while making de-duplication deterministic and safe.

## Goals / Non-Goals

**Goals:**
- Ensure all agent activity labels/notifications visible to end users in `ui-cognitive` are in Spanish and consistent across top meta bar, inline summary, and activity panel.
- Prevent duplicated activity entries during streaming by introducing stable event identity and append guards.
- Keep behavior stable for historical activity rendering and existing stream consumers.
- Make rollout incremental so each step can be verified independently.

**Non-Goals:**
- Full i18n framework adoption across the entire app.
- Changing backend agent semantics, tool execution order, or activity event schema beyond additive metadata needed for identity.
- Redesigning the activity panel layout or visual style.

## Decisions

1. **Single Spanish copy map for activity UX terms**
   - Create/centralize activity-facing labels in one constants layer used by `session-meta.ts`, `inline-activity-summary.tsx`, and optionally step cards.
   - Rationale: avoids string drift and keeps future adjustments low-risk.
   - Alternative considered: translating inline strings in each component. Rejected due to high inconsistency risk.

2. **Deterministic activity event identity for dedup**
   - Normalize incoming activity events to a canonical structure and compute a `dedupeKey` from stable fields (e.g., event id if present, else composite of kind/tool/status/timestamps).
   - Apply de-duplication at the chat-panel state boundary before appending to `activityLog`.
   - Rationale: one ingestion choke point guarantees consistency regardless of upstream duplication source.
   - Alternative considered: dedup only in route handler. Rejected because client can still receive duplicates from retries/reconnects.

3. **Additive route-level normalization, not breaking schema replacement**
   - In `app/api/chat/route.ts`, preserve existing event payloads but include normalized identifiers when available.
   - In `lib/nat-client.ts`, forward both raw event and normalized identity metadata.
   - Rationale: backwards-compatible rollout with safer migration.

4. **Two-phase safe rollout**
   - Phase A: copy localization changes with no behavior changes.
   - Phase B: dedup normalization + append guards + regression verification.
   - Rationale: isolates user-facing copy risk from streaming-state risk.

## Risks / Trade-offs

- [Over-deduplication of legitimate repeated tool calls] -> Mitigation: include precise discriminators (timestamps/sequence ids) and only collapse events with equal dedupe identity.
- [Missed labels in optional cards/components] -> Mitigation: perform grep-based pass for activity-related English copy in scoped files and optional cards.
- [Inconsistent identity fields across transport layers] -> Mitigation: define a normalization contract documented in code types and enforce fallback key generation in one place.
- [Regression in historical activity view] -> Mitigation: do not mutate stored `intermediateSteps`; dedup applies only to live append path.
