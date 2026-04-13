## Why

The chat activity panel shows meaningful agent/tool activity, but the observability dashboard reports near-zero request and tool usage even when traces exist and users are actively chatting. This mismatch reduces trust in monitoring and blocks operational debugging of agent behavior.

## What Changes

- Add a resilient trace parsing and aggregation contract for the dashboard that supports the real nested NAT trace schema and current flat fallback fields.
- Add explicit cross-surface parity checks so dashboard metrics (requests, tool usage, failures, latency) are consistent with chat-visible activity from the same conversation/run window.
- Add low-overhead visibility fields in frontend observability outputs for sandbox/context, executed tool command summary, and trace-to-activity correlation identifiers.
- Add diagnostics for schema drift (events parsed, events skipped, missing trace ids) to speed up detection when backend payload shape changes.

## Capabilities

### New Capabilities
- `observability-dashboard-parity`: Ensure dashboard metrics are computed from real runtime traces and remain aligned with chat activity visibility for the same agent runs.

### Modified Capabilities
- `activity-panel`: Extend activity requirements to include stable correlation fields that can be matched against observability traces and dashboard aggregates.

## Impact

- Frontend (ui-cognitive): `lib/observability.ts`, `app/api/observability/summary/route.ts`, dashboard components, and activity mapping/rendering components.
- Backend contract assumptions: no hard API break required, but parser assumptions must support current NAT trace payloads (`payload.*`, `payload.metadata.provided_metadata.*`).
- Operational monitoring: improved reliability of request/tool/error metrics and reduced false-zero dashboard states.
