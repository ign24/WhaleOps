## Context

The agent already has a judge (`AgentJudgeEvaluator`), a trace reader (`run_judge_from_traces.py`), and partial real-binary tests (pytest/coverage, gitleaks/bandit). The gap is:

1. `ruff` and `semgrep` have no real-binary validation — they are only tested with subprocess mocks
2. There is no way to drive the agent against a controlled task set and produce a traceable JSONL for batch eval
3. The trace runner only reads from the NAT live trace file; it cannot accept an arbitrary JSONL input

This change is additive: it adds tests and scripts without modifying the agent core or any tool implementation.

## Goals / Non-Goals

**Goals:**
- Cover `ruff` and `semgrep` with real-binary `real_tools` e2e tests against the shared fixture repo
- Provide a shared `tests/fixtures/sample_repo/` so all `real_tools` tests target the same code
- Script that POSTs tasks to the agent HTTP API and writes `{input, trajectory, output, mode}` JSONL
- Extend `run_judge_from_traces.py` with `--input` so it accepts harness JSONL without env var ceremony
- `eval_report.sh` as the single entry point for end-to-end validation

**Non-Goals:**
- Modifying any tool implementation or agent core
- Adding eslint real-binary test (requires Node.js project fixture; separate scope)
- CI integration (manual dev workflow only for now)
- Replacing `run_judge_eval.py` static dataset runner

## Decisions

### D1: Shared fixture repo as static files, not generated at test time

**Decision**: Commit `tests/fixtures/sample_repo/` as real Python files in version control.

**Why**: Per-test `tmp_path` fixture creation (current approach) means each test independently defines what "real code" looks like, creating drift. A shared fixture with documented intentional issues is the canonical test target.

**Alternative considered**: Generate with `tmp_path` in a session-scoped fixture. Rejected because it's invisible (can't inspect what the tool runs against) and requires duplication of intent in conftest.

### D2: Task harness uses HTTP, not in-process agent call

**Decision**: `run_task_harness.py` sends POST requests to `http://localhost:8000/chat` (the existing API), not by importing and calling the agent directly.

**Why**: The goal is to validate the agent as deployed, including all middleware, mode routing, and the full NAT wrapper. In-process calls would bypass these layers and give false confidence.

**Alternative considered**: Import `SafeToolCallingAgent` directly. Rejected because it would skip tier0 routing and mode guards that are part of the production path.

**Constraint**: Requires a running agent. The script fails fast with a clear error if the endpoint is unreachable.

### D3: Harness JSONL format is a superset of NAT trace format

**Decision**: Harness writes `{run_id, question, agent_response, trajectory_raw, mode, timestamp}` per line — a strict superset of what `run_judge_from_traces.py` already parses.

**Why**: Reusing the existing trace reader means zero new parsing logic. The `--input` flag only changes the source path; everything else stays identical.

### D4: `eval_report.sh` calls harness + judge sequentially, not in parallel

**Decision**: Shell wrapper: `run_task_harness.py && run_judge_from_traces.py --input <output>`.

**Why**: Evaluation depends on trace data. Sequential is correct and keeps the scripts independently useful.

## Risks / Trade-offs

- **[Risk] Harness requires a running agent** → The script checks the endpoint before sending tasks and prints a clear setup message; no silent failures
- **[Risk] `ruff` / `semgrep` version differences** → Tests assert on JSON shape and returncode, not exact output strings; tolerant to minor version drift
- **[Risk] Shared fixture repo becomes stale** → Documented in `tests/fixtures/README.md` with a note on what issues are intentional; updating it is a deliberate action

## Open Questions

- Should the task list for the harness live in a JSON file (configurable) or be hardcoded in the script? → Start hardcoded (3–5 tasks), extract to JSON if the list grows beyond 10.
