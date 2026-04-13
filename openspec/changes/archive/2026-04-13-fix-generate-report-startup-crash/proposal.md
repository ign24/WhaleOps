## Why

The service fails at startup when registering `generate_report`, so the workflow never boots and all modes are unavailable. This is happening now because `report_tools.py` uses deferred annotations (`from __future__ import annotations`) and NAT function introspection expects concrete classes during `FunctionInfo.from_fn(...)` processing.

## What Changes

- Remove deferred-annotation behavior from `report_tools.py` so NAT can safely introspect the tool function signature.
- Harden the `generate_report` tool registration contract by ensuring `_run` uses NAT-compatible return typing.
- Add a regression test that exercises NAT function metadata creation for `generate_report_tool` (not only direct `generate_report()` behavior) to prevent future startup regressions.

## Capabilities

### New Capabilities
- `nat-tool-registration-compatibility`: Guardrails and regression coverage for tool signatures that NAT must introspect at workflow-build time.
- `generate-report-startup-safety`: Requirements ensuring `generate_report` registration does not crash workflow startup.

### Modified Capabilities
- None.

## Impact

- Affected code: `src/cognitive_code_agent/tools/report_tools.py`
- Affected tests: `tests/unit/test_report_tools.py` (or new focused unit test module for tool registration)
- Runtime impact: removes startup crash (`TypeError: issubclass() arg 1 must be a class`) and restores workflow initialization
- No new dependencies, no API surface changes
