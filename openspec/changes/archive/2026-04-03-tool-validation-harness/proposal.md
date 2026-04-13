## Why

Tool behavior in production is only validated through mocks and static datasets, making it impossible to know whether `ruff`, `semgrep`, `eslint`, and `shell_execute` work correctly against real code, or whether the agent actually grounds its responses in real tool output. The judge and trace runner infrastructure exist, but there is no repeatable way to run the agent against known tasks, capture traces, and evaluate them in one command.

## What Changes

- **New**: `real_tools` e2e tests for code review tools (`ruff`) and security tools (`semgrep`), covering the two tool categories currently missing real-binary validation
- **New**: `tests/fixtures/sample_repo/` — shared Python fixture repo with known issues used by all `real_tools` tests (eliminates ad-hoc per-test fixtures)
- **New**: `scripts/run_task_harness.py` — sends a predefined task list to the running agent via HTTP, captures `{input, trajectory, output, mode}` per task, writes `traces/harness_run_{timestamp}.jsonl`
- **Modified**: `run_judge_from_traces.py` — add `--input` flag to accept a harness-generated JSONL directly (currently only reads from `$TRACES_PATH` NAT file)
- **New**: `scripts/eval_report.sh` — one-command wrapper: runs task harness → pipes to judge → prints metrics report

## Capabilities

### New Capabilities

- `real-tool-smoke-tests`: E2E tests that invoke `ruff` and `semgrep` against real code using actual binaries, asserting tool output contracts (returncode, JSON shape, field presence) without mocks
- `shared-fixture-repo`: A versioned Python fixture at `tests/fixtures/sample_repo/` with intentional lint issues, a security vulnerability, a README, and a test suite — used as the canonical test target across all `real_tools` tests
- `task-harness-runner`: Script that sends known tasks to the agent HTTP endpoint, captures full `{input, trajectory, output, mode}` per task, and writes a JSONL file compatible with `run_judge_from_traces.py`

### Modified Capabilities

- `trace-judge-runner`: Add `--input <path>` flag to accept any JSONL (not only from `$TRACES_PATH`), so the harness output flows directly into evaluation without env var config

## Impact

- New files: `tests/e2e/test_code_review_flow_e2e.py`, `tests/fixtures/sample_repo/` (5 files), `scripts/run_task_harness.py`, `scripts/eval_report.sh`
- Modified: `scripts/run_judge_from_traces.py` (add `--input` flag)
- No changes to agent core, tool implementations, or `eval/evaluate.py`
- Requires `ruff` and `semgrep` installed in dev environment (same as `bandit`/`gitleaks` already required for existing real_tools tests)
