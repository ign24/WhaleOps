## Context

`generate_report` is registered through `FunctionInfo.from_fn(_run, ...)` in `report_tools.py`. During NAT workflow build, NAT inspects `_run` annotations and calls subtype checks that expect concrete classes. In Python 3.11, deferred annotations from `from __future__ import annotations` can surface as strings at this introspection point, causing startup-time failure:

`TypeError: issubclass() arg 1 must be a class`

This blocks application startup, so all modes become unavailable. Similar NAT-compatibility guidance already exists in `cron_tools.py` and should be aligned for report tooling.

## Goals / Non-Goals

**Goals:**
- Eliminate startup crash in `generate_report` registration.
- Keep `generate_report` behavior unchanged (output path/content/idempotency).
- Add regression coverage that validates NAT function metadata generation for report tool registration.

**Non-Goals:**
- Redesigning report markdown content or Milvus query logic.
- Changing mode routing/tool availability policy.
- Introducing NAT framework patches or dependency upgrades.

## Decisions

### D1: Remove deferred annotation behavior from `report_tools.py`

`report_tools.py` will not use `from __future__ import annotations`, ensuring runtime annotations are concrete types during NAT introspection.

**Why:** This directly addresses the observed `issubclass` crash and follows the existing NAT-compatibility constraint documented in `cron_tools.py`.

**Alternative considered:** Keep deferred annotations and remove `_run` return annotation only. Rejected because it is brittle and does not prevent future incompatible annotations in the same module.

### D2: Keep tool registration with `FunctionInfo.from_fn` and enforce safe signature shape

The tool remains NAT-registered via `FunctionInfo.from_fn(_run, ...)`, but with annotation shape guaranteed to be NAT-safe.

**Why:** No API change is needed; only compatibility hardening is required.

**Alternative considered:** Bypass introspection via custom schema-only registration. Rejected as unnecessary complexity and diverges from established tool patterns.

### D3: Add a registration-level regression test

Add a unit test that executes the registration path enough to prove `FunctionInfo.from_fn` can build metadata for `generate_report_tool` without raising.

**Why:** Existing tests validate report content but do not exercise startup registration, so this class of failure was missed.

**Alternative considered:** Rely only on integration startup tests. Rejected because unit-level guard is faster and isolates this failure mode.

## Risks / Trade-offs

- **[Risk]** Future contributors reintroduce deferred annotations in NAT-sensitive tool modules. → **Mitigation:** Add an explicit compatibility comment in `report_tools.py` and regression test coverage.
- **[Risk]** Registration-level test may be tightly coupled to NAT internals. → **Mitigation:** Keep assertion minimal (metadata creation succeeds, no deep internal shape assertions).
- **[Trade-off]** Slightly less flexible annotation style in this module. → Accepted for runtime stability.

## Migration Plan

1. Remove deferred-annotation import from `report_tools.py` and keep NAT-safe function signature.
2. Add regression test for report tool registration path.
3. Run targeted tests (`test_report_tools`) and full verification (`ruff`, `pytest -x`).
4. Validate local startup path to confirm workflow initializes without `generate_report` registration failure.

## Open Questions

- Should a shared lint rule be introduced later to block `from __future__ import annotations` in NAT-registered tool modules? (Out of scope for this fix.)
