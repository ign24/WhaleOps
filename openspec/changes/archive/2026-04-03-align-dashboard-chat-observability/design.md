## Context

`ui-cognitive` currently exposes two independent observability surfaces:

1. **Chat activity timeline** fed by live SSE/intermediate events (`event: activity`) mapped in `lib/nat-client.ts` and rendered in activity components.
2. **Dashboard metrics** computed from persisted runtime traces (`TRACES_PATH`) through `lib/observability.ts` and `/api/observability/summary`.

In production usage, chat visibly shows tool activity while dashboard counters can remain at zero. Investigation shows trace files are present and readable, but field extraction in dashboard aggregation does not consistently match the real nested NAT trace shape (`payload.event_type`, `payload.event_timestamp`, `payload.metadata.provided_metadata.workflow_run_id`).

Constraint: keep overhead low and avoid backend protocol breaks. The change should prioritize frontend/BFF parser hardening and explicit parity diagnostics.

## Goals / Non-Goals

**Goals:**
- Make dashboard request/tool/error/latency metrics reliable for current trace schema without requiring backend API changes.
- Establish stable correlation identifiers between chat activity and trace-derived dashboard aggregates.
- Improve transparency for executed tool context (sandbox/command summary) using already available payload fields.
- Add low-cost diagnostics to detect schema drift quickly.

**Non-Goals:**
- Replacing SSE with WebSockets.
- Building a real-time line-by-line terminal stream for long-running shell commands.
- Redesigning the entire observability UI.
- Introducing new external infrastructure (new DB/queue/telemetry backend).

## Decisions

### Decision 1: Adopt a tolerant trace field resolver with nested-first fallback
- **Choice:** Update trace extraction to support canonical nested NAT fields first, then existing flat aliases.
- **Why:** Current traces are nested; flat-only extraction leads to false-zero aggregation.
- **Alternatives considered:**
  - Backend trace schema rewrite: rejected (higher risk and cross-service impact).
  - Hardcode only one schema version: rejected (fragile to upgrades).

### Decision 2: Keep chat activity and dashboard as separate pipelines, add explicit parity contract
- **Choice:** Preserve current architecture but define required correlation fields (`workflow_run_id`, `conversation_id`, normalized tool name/status) so both surfaces can be compared deterministically.
- **Why:** Minimizes implementation risk while solving trust gap.
- **Alternatives considered:**
  - Unify both surfaces behind one new backend endpoint: rejected for MVP due to scope and coupling.

### Decision 3: Add lightweight observability diagnostics in summary payload
- **Choice:** Extend summary response with parser diagnostics (e.g., parsed lines, skipped lines, events without trace id, detected schema source).
- **Why:** Provides immediate failure visibility when payload shape drifts.
- **Alternatives considered:**
  - Silent fallback only: rejected (hard to debug future regressions).

### Decision 4: Expose high-value transparency fields in activity UI without new backend contracts
- **Choice:** Surface existing fields already present in tool args/results (command, repo/sandbox path, return code, compact stdout/stderr preview, touched-path hints when available).
- **Why:** Delivers user-visible value quickly with minimal backend changes.
- **Alternatives considered:**
  - Add new backend-only dedicated transparency events first: deferred to later phase.

## Risks / Trade-offs

- **[Schema drift across NAT versions]** → Mitigation: nested+flat resolver, diagnostics counters, unit tests for mixed formats.
- **[False parity mismatches due to asynchronous writes]** → Mitigation: define acceptable lag window and compare by run identifiers, not strict per-token timing.
- **[Large payload rendering cost in activity cards]** → Mitigation: truncate previews and keep full payload collapsed.
- **[Potential sensitive output exposure in UI]** → Mitigation: respect existing backend redaction/truncation fields and avoid rendering raw unbounded content by default.

## Migration Plan

1. Update parser/aggregation contract in `ui-cognitive/lib/observability.ts` with backward-compatible extraction.
2. Extend summary route payload with diagnostics and parity fields.
3. Update dashboard widgets to use new diagnostics/parity state and remove false-zero ambiguity.
4. Extend activity mapping/rendering for correlation and transparency fields (no protocol break).
5. Validate against real trace samples and recent chat sessions.

Rollback: revert parser/dash payload changes to previous extractor logic; no data migration required.

## Open Questions

- Should parity checks be strict (hard mismatch status) or advisory (warning badge) in MVP?
- What default retention/window should dashboard use when comparing against recent activity?
- Should touched-file inference rely only on explicit tool fields or also regex extraction from outputs in phase 1?
