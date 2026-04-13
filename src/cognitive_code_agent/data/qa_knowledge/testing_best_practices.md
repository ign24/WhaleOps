# Testing Best Practices

- Keep unit tests deterministic and fast.
- Add regression tests for every production bug.
- Prioritize critical business paths in end-to-end tests.
- Enforce coverage thresholds by module, not only globally.

## Agent testing pyramid

- Unit (70-80%): prompt/result parsers, routing heuristics, safety predicates, redaction helpers.
- Integration (15-25%): tool contracts, timeout/retry/error mapping, sandbox boundaries.
- E2E (5-10%): critical user journeys with realistic prompts and safety constraints.

## Local execution order

1. Run fast suite first: `uv run --extra dev pytest -m "not e2e" -q`
2. Run full suite before merge: `uv run --extra dev pytest -q`
3. Add at least one regression test when fixing high-impact failures.
