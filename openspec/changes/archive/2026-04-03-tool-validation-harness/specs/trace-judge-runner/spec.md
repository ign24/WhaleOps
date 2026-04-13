## MODIFIED Requirements

### Requirement: Parse trace JSONL into evaluable samples
The script SHALL read a JSONL file from `$TRACES_PATH` (or a path passed via `--traces` or `--input`), group events by `nat.workflow.run_id` for NAT trace format or by line for harness format, and reconstruct evaluable samples containing: user question, agent response, and tool trajectory.

#### Scenario: Successful extraction from NAT trace file via --traces
- **WHEN** `$TRACES_PATH` contains a valid JSONL with at least one complete trace
- **THEN** the script extracts one sample per trace with `question`, `agent_response`, and `trajectory` fields populated

#### Scenario: Successful extraction from harness JSONL via --input
- **WHEN** `--input /path/to/harness_run.jsonl` is passed and the file contains valid harness records
- **THEN** the script extracts one sample per line, reading `question`, `agent_response`, `trajectory_raw`, and `mode` directly from each record

#### Scenario: Incomplete trace is skipped
- **WHEN** a trace has events but no recoverable user message or agent response
- **THEN** the trace is skipped and counted in a "skipped" summary, not causing a crash

#### Scenario: Missing trace file
- **WHEN** neither `--traces`, `--input`, nor `$TRACES_PATH` provides a readable file
- **THEN** the script exits with a clear error message indicating the path and how to set it
