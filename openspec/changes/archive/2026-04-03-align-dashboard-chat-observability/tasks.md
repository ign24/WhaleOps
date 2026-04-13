## 1. Trace parsing and aggregation parity

- [x] 1.1 Update `ui-cognitive/lib/observability.ts` field resolvers to support nested NAT trace fields (`payload.event_type`, `payload.event_timestamp`, `payload.name`, `payload.metadata.provided_metadata.workflow_run_id`) with flat fallbacks.
- [x] 1.2 Normalize run identification and timestamp extraction so request counting and latency aggregation remain correct for mixed nested/flat trace files.
- [x] 1.3 Harden failure/tool/category detection to read both nested and flat status/error/tool fields without double counting.

## 2. Observability summary diagnostics

- [x] 2.1 Extend summary output shape with parser diagnostics (processed, skipped, missing-run-id, schema source indicators).
- [x] 2.2 Update `/api/observability/summary` response typing and payload mapping to include diagnostics fields.
- [x] 2.3 Render dashboard warning states when traces exist but parse diagnostics indicate schema mismatch or excessive skips.

## 3. Chat activity ↔ dashboard correlation

- [x] 3.1 Extend activity event mapping to preserve stable correlation fields (workflow/run id, conversation id, normalized tool identity) when present.
- [x] 3.2 Update activity entry rendering to expose execution context fields (sandbox/repo path, command summary, return-code summary) for tool events.
- [x] 3.3 Add parity comparison logic for recent runs/windows and surface advisory mismatch status in dashboard UI.

## 4. Verification and regression safety

- [x] 4.1 Add unit tests for `lib/observability.ts` covering nested-only, flat-only, and mixed trace samples.
- [x] 4.2 Add route/component tests to verify diagnostics rendering and non-zero metric behavior with valid nested traces.
- [x] 4.3 Run lint/test/build for `ui-cognitive` and verify with a manual chat session that activity and dashboard metrics are aligned within expected lag.
