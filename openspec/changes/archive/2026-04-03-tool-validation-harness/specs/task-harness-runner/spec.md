## ADDED Requirements

### Requirement: Script sends predefined tasks to agent HTTP endpoint
`scripts/run_task_harness.py` SHALL POST each task from a hardcoded task list to `http://localhost:8000/chat` (configurable via `--base-url`), capture the response, and write one JSONL line per task with fields: `run_id`, `question`, `agent_response`, `trajectory_raw`, `mode`, `timestamp`.

#### Scenario: Successful task run writes JSONL output
- **WHEN** the agent endpoint is reachable and all tasks complete
- **THEN** a file `traces/harness_run_{timestamp}.jsonl` is written with one line per task

#### Scenario: Agent endpoint unreachable
- **WHEN** the HTTP request to the agent fails with a connection error
- **THEN** the script exits immediately with a clear error: "Agent not reachable at <url>. Start the agent first."

#### Scenario: Individual task fails
- **WHEN** one task returns a non-200 response or an exception
- **THEN** that task is written to JSONL with `agent_response: null` and `error: "<message>"`, and remaining tasks continue

### Requirement: Script accepts --base-url and --output flags
The script SHALL accept `--base-url <url>` (default: `http://localhost:8000`) and `--output <path>` (default: `traces/harness_run_{timestamp}.jsonl`) as CLI arguments.

#### Scenario: Custom base URL
- **WHEN** user runs `python scripts/run_task_harness.py --base-url http://staging:8000`
- **THEN** all requests go to `http://staging:8000/chat`

#### Scenario: Custom output path
- **WHEN** user runs `python scripts/run_task_harness.py --output /tmp/my_run.jsonl`
- **THEN** the JSONL is written to `/tmp/my_run.jsonl`

### Requirement: Hardcoded task list covers all agent modes
The built-in task list SHALL include at least one task per mode: `analyze`, `refactor`, `execute`, targeting the shared fixture repo path as the repository under analysis.

#### Scenario: Task list covers analyze, refactor, execute modes
- **WHEN** the script is run without arguments
- **THEN** the output JSONL contains at least 3 tasks with distinct `mode` values covering analyze, refactor, and execute
