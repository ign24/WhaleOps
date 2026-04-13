## 1. clone_repository tool — shallow and timeout parameters

- [x] 1.1 Add `shallow: bool = False` parameter to `_run` in `clone_tools.py`, pass `--depth 1 --filter=blob:none` to git when True
- [x] 1.2 Add `timeout_seconds: int = 120` parameter to `_run`, apply `min(timeout_seconds, 600)` cap before passing to `run_command`
- [x] 1.3 Add `clone_type` field (`"shallow"` or `"full"`) to success response payload
- [x] 1.4 Add `hint` field to timeout error response payload
- [x] 1.5 Update `CloneRepositoryConfig.description` to document `shallow` and `timeout_seconds` parameters so they appear in the LLM tool schema

## 2. Tests for clone_repository changes

- [x] 2.1 Unit test: `shallow=True` passes `--depth 1 --filter=blob:none` to git command
- [x] 2.2 Unit test: `timeout_seconds=300` sets subprocess timeout to 300
- [x] 2.3 Unit test: `timeout_seconds=700` is capped at 600
- [x] 2.4 Unit test: timeout error payload includes `hint` field
- [x] 2.5 Unit test: success payload includes `clone_type` field with correct value

## 3. analyze.md — planning policy

- [x] 3.1 Add `<planning_policy>` section to `analyze.md` with clone strategy decision criteria (shallow by default for analysis, full only when git history needed)
- [x] 3.2 Add sub-agent selection criteria: only invoke agents relevant to the request, with examples per task type
- [x] 3.3 Add self-correction guidance: on timeout with `hint` field, retry with `shallow=True`

## 4. reader_agent — evidence-based stopping criteria

- [x] 4.1 Update `reader_agent.system_prompt` in `config.yml`: replace "prefer targeted inspection" with evidence-based stopping criteria per task type (security, docs, architecture)
- [x] 4.2 Add explicit exclusions: never read test fixtures, generated files, or vendored directories unless specifically asked

## 5. Validation

- [x] 5.1 Run `uv run ruff check . && uv run ruff format --check .` — no lint errors
- [x] 5.2 Run `uv run pytest -x -m "not e2e"` — all tests pass
- [x] 5.3 Manual smoke test: analyze a large public repo with shallow=True, verify clone completes and sub-agents run correctly
