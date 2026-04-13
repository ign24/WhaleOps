## ADDED Requirements

### Requirement: Parse trace JSONL into evaluable samples
The script SHALL read a JSONL file from `$TRACES_PATH` (or a path passed via `--traces`), group events by `nat.workflow.run_id`, and reconstruct evaluable samples containing: user question, agent response, and tool trajectory.

#### Scenario: Successful extraction from trace file
- **WHEN** `$TRACES_PATH` contains a valid JSONL with at least one complete trace
- **THEN** the script extracts one sample per trace with `question`, `agent_response`, and `trajectory` fields populated

#### Scenario: Incomplete trace is skipped
- **WHEN** a trace has events but no recoverable user message or agent response
- **THEN** the trace is skipped and counted in a "skipped" summary, not causing a crash

#### Scenario: Missing trace file
- **WHEN** `$TRACES_PATH` is not set or the file does not exist
- **THEN** the script exits with a clear error message indicating the path and how to set it

### Requirement: Run judge on extracted samples
The script SHALL pass each extracted sample to `AgentJudgeEvaluator` with a concurrency limit of 2, respecting the `NVIDIA_API_KEY` environment variable required by the evaluator.

#### Scenario: Judge runs on all extractable samples
- **WHEN** the script finds N evaluable traces
- **THEN** it submits all N to the evaluator and waits for all results before printing the report

#### Scenario: Missing API key
- **WHEN** `NVIDIA_API_KEY` is not set
- **THEN** the script exits before making any API calls with a clear error message

### Requirement: Emit formatted terminal report
The script SHALL print a report to stdout with: global pass rate, average weighted score, per-dimension average scores with ASCII bar, and a list of failed traces with their critical failures and rationale. No external formatting libraries (rich, tabulate) SHALL be required.

#### Scenario: Full report with pass and fail cases
- **WHEN** evaluation completes with at least one PASS and one FAIL
- **THEN** the report shows pass rate, dimension averages, and at minimum the failed trace IDs with rationale

#### Scenario: All traces pass
- **WHEN** all evaluated traces score >= 3.5
- **THEN** the report shows 100% pass rate and dimension breakdown, with no failures section

#### Scenario: No evaluable traces found
- **WHEN** the JSONL contains traces but none yield a recoverable question+response pair
- **THEN** the report prints "0 traces evaluated" and the count of skipped traces

### Requirement: Support --last N flag to limit evaluation scope
The script SHALL accept an optional `--last N` argument to evaluate only the N most recent traces (by timestamp), enabling fast local checks without processing the full trace history.

#### Scenario: --last 10 limits evaluation
- **WHEN** the user runs `python scripts/run_judge_from_traces.py --last 10`
- **THEN** only the 10 most recent complete traces are evaluated, regardless of total trace count
