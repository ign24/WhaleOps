## 1. Shared Fixture Repo

- [x] 1.1 Create `tests/fixtures/sample_repo/app.py` with one ruff-detectable lint issue (unused import) and one bandit-detectable security issue (hardcoded password string)
- [x] 1.2 Create `tests/fixtures/sample_repo/test_app.py` with at least one passing pytest test
- [x] 1.3 Create `tests/fixtures/sample_repo/README.md` with `## Install`, `## Usage`, and `## Intentional Issues` sections documenting the known lint/security issues by tool name
- [x] 1.4 Create `tests/fixtures/__init__.py` (empty) and `tests/fixtures/sample_repo/__init__.py` (empty)

## 2. Real Tool Smoke Tests

- [x] 2.1 Create `tests/e2e/test_code_review_flow_e2e.py` with `pytestmark = [pytest.mark.e2e, pytest.mark.real_tools]`
- [x] 2.2 Add `test_ruff_smoke_on_fixture_repo`: skipif `ruff` not in PATH, invoke `run_ruff_tool` against `tests/fixtures/sample_repo/`, assert `issues` is non-empty string, `returncode` is int, `duration_ms > 0`
- [x] 2.3 Add `test_semgrep_smoke_on_fixture_repo`: skipif `semgrep` not in PATH, invoke `run_semgrep_tool` against `tests/fixtures/sample_repo/`, assert `findings` is valid JSON string, `returncode` is int, `duration_ms > 0`
- [x] 2.4 Add `real_tools` mark to `tests/e2e/test_docs_flow_e2e.py` (currently only marked `e2e`) so it is included in the `real_tools` run
- [x] 2.5 Verify all `real_tools` tests pass: `uv run python -m pytest tests/e2e -m real_tools -v`

## 3. Task Harness Runner

- [x] 3.1 Create `scripts/run_task_harness.py` with argparse for `--base-url` (default `http://localhost:8000`) and `--output` (default `traces/harness_run_{timestamp}.jsonl`)
- [x] 3.2 Implement connectivity check: attempt GET `/health` or POST with timeout=3s; if connection refused, print clear error and exit 1
- [x] 3.3 Define hardcoded task list with 4 tasks covering analyze, refactor, execute modes — each targeting `tests/fixtures/sample_repo/` as the repo path
- [x] 3.4 Implement task loop: POST to `/chat`, capture `{question, agent_response, trajectory_raw, mode, run_id, timestamp}`, write JSONL line per task; log per-task status to stderr
- [x] 3.5 Handle per-task errors gracefully: write `{..., agent_response: null, error: "<message>"}` and continue remaining tasks

## 4. Trace Judge Runner — --input Flag

- [x] 4.1 Add `--input <path>` argument to `scripts/run_judge_from_traces.py` (alongside existing `--traces`)
- [x] 4.2 Implement harness JSONL parser: read each line as `{question, agent_response, trajectory_raw, mode}`, build `EvalInputItem` directly without NAT event grouping logic
- [x] 4.3 Update the source selection logic: `--input` → harness parser, `--traces` or `$TRACES_PATH` → existing NAT parser; error if none provided
- [x] 4.4 Pass per-item `mode` from harness records to `AgentJudgeEvaluator` via `full_dataset_entry`

## 5. Eval Report Wrapper

- [x] 5.1 Create `scripts/eval_report.sh`: runs `run_task_harness.py`, captures output path, pipes to `run_judge_from_traces.py --input <path>`, exits with judge's exit code
- [x] 5.2 Add `--last N` passthrough from `eval_report.sh` to `run_judge_from_traces.py`
- [x] 5.3 Make `eval_report.sh` executable (`chmod +x`) and add usage comment at top

## 6. Verification

- [x] 6.1 Run `uv run python -m pytest tests/ -q` — all 320 tests pass, no regressions
- [x] 6.2 Run `uv run python -m pytest tests/e2e -m real_tools -v` — ruff/semgrep tests skip gracefully if binaries absent, pass if present
- [x] 6.3 Run `uv run ruff check . && uv run ruff format --check .` — clean
