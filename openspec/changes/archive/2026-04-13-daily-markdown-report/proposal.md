## Why

The cron scheduler infrastructure is complete (APScheduler + Redis + tool + lifespan) but the callback at `register.py:120-121` is a log-only stub — scheduled jobs fire and do nothing. This blocks any recurring automation. Meanwhile, the agent accumulates findings across sessions (Milvus `qa_findings`, `domain_knowledge`) but has no mechanism to produce a periodic summary. A daily markdown report would close this gap: a structured `.md` file generated on schedule, ready for Obsidian vault integration without any plugin or sync dependency.

## What Changes

- **Wire the cron callback** to dispatch prompts into the NAT workflow in-process, making `schedule_task` actually functional end-to-end.
- **Add a `generate_report` tool** that produces a structured markdown file summarizing findings, dependency health, and code quality delta since the last report.
- **Add a default daily cron preset** so the agent can bootstrap a daily report schedule with a single tool call (e.g., `schedule_task` with `action: "create"` and a report-generating prompt).
- **Configure report output path** via `REPORT_OUTPUT_DIR` env var (default `/app/workspace/reports/`), producing files named `YYYY-MM-DD.md`.

## Capabilities

### New Capabilities
- `cron-callback-dispatch`: Wires the cron callback stub to actually invoke the agent workflow in-process when a scheduled job fires
- `daily-report-generation`: Tool that queries findings, dependency data, and code quality metrics to produce a structured Obsidian-compatible markdown report

### Modified Capabilities
- `cron-job-runner`: The spec already requires in-process `stream_fn` dispatch (scenario "Job fires at scheduled time") but the implementation is a stub. This change fulfills that existing requirement.

## Impact

- **`src/cognitive_code_agent/register.py`** — Replace the log-only `_cron_run_callback` with a real workflow dispatcher
- **`src/cognitive_code_agent/tools/`** — New `report_tools.py` with `generate_report` tool
- **`src/cognitive_code_agent/configs/config.yml`** — Add `generate_report` to execute mode tools
- **`docker-compose.yml`** — Mount report output volume if needed
- **Dependencies** — None new; uses existing Milvus client, Redis, and filesystem MCP
