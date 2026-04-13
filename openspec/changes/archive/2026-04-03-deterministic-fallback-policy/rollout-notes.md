## Rollout / Rollback toggles

This implementation is controlled by configuration knobs already present in runtime settings.

### Rollout

- `workflow.tool_loop_guard_threshold` (and per-mode override):
  - Set to `2` to enable conservative loop blocking (default in this change).
  - Increase to relax loop blocking if false positives appear.
- `workflow.modes.<mode>.max_iterations`:
  - Keep existing values and monitor fallback metrics before raising.
  - Use mode-specific tuning rather than global increases.

### Rollback

- Disable loop guard behavior by setting `tool_loop_guard_threshold` to a high value (e.g., `10`) temporarily.
- Revert to previous partial-output behavior by restoring prior version of
  `safe_tool_calling_agent.py` if deterministic fallback contract must be bypassed.
- Keep trace events active to compare pre/post rollback behavior.

### Validation commands

- `uv run ruff check .`
- `uv run ruff format --check .`
- `uv run -- python -m pytest -x`

### Validation result (this change)

- Ruff check: pass
- Ruff format check: pass
- Pytest: pass (`413 passed, 1 skipped, 5 deselected`)
