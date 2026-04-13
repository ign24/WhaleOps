## Context

The cron scheduler infrastructure is fully built: APScheduler with RedisJobStore, `schedule_task` tool, lifespan management. But the callback in `register.py:120-121` only logs — it never dispatches to the NAT workflow. This means every scheduled job is a no-op.

The existing spec `cron-job-runner` already requires in-process dispatch via `stream_fn` (requirement "Jobs fire in-process via asyncio"), but the implementation was deferred. This change fulfills that requirement and adds the first real consumer: a daily markdown report.

The agent already accumulates findings in Milvus (`qa_findings`, `domain_knowledge`) and has episodic memory in Redis. The report tool queries these stores and writes a structured markdown file.

## Goals / Non-Goals

**Goals:**
- Wire the cron callback to invoke the NAT workflow in-process (fulfill existing spec)
- Create a `generate_report` tool that produces a date-stamped markdown file
- Report content: findings summary, dependency observations, code quality delta
- Output format: clean markdown compatible with Obsidian (no plugins required)
- Configurable output directory via environment variable

**Non-Goals:**
- Obsidian sync, git auto-commit of reports, or any push mechanism
- Sentry, Slack, or other external service integration (separate changes)
- Real-time dependency CVE scanning (future `dependency-intelligence` change)
- Modifying the Milvus auto-retrieval noop gap (separate issue)

## Decisions

### D1: Cron callback dispatches via NAT's `stream_fn`

The callback will capture `stream_fn` from the NAT builder during lifespan setup and call it directly with the prompt, using session ID `"cron:scheduled"`.

**Why not HTTP POST to localhost:8000?** The spec explicitly requires in-process dispatch. HTTP adds latency, failure modes (port not ready, CORS), and circular dependency on the server being fully up while it's still starting.

**Why `stream_fn`?** It's the same entry point the FastAPI frontend uses. It guarantees the full agent graph runs (tool selection, memory, tracing). The builder exposes it after `configure()` completes.

### D2: Report tool is a NAT-registered function, not a standalone script

The `generate_report` tool is registered as a NAT function (`_type: generate_report`) so the agent can call it directly during any session — not just from cron. This means a user can say "generate a report" interactively too.

**Alternative considered:** A standalone Python script triggered by cron. Rejected because it would need its own Milvus/Redis connections, LLM access for summarization, and couldn't benefit from agent context.

### D3: Report queries Milvus directly, not via agent tools

The report tool calls `query_findings_by_date()` and `search_semantic_knowledge()` directly from the Milvus client, rather than invoking the `query_findings` agent tool. This avoids recursive tool-calling complexity and keeps the report generation deterministic.

### D4: Markdown structure uses YAML frontmatter for Obsidian metadata

Each report file includes YAML frontmatter with `date`, `repo`, `type: daily-report` tags. This lets Obsidian Dataview queries work out of the box without configuration.

```markdown
---
date: 2026-04-08
type: daily-report
repos:
  - owner/repo-name
---
# Daily Report — 2026-04-08
...
```

### D5: Output path is configurable, defaults to `/app/workspace/reports/`

`REPORT_OUTPUT_DIR` env var controls the base directory. Files are named `YYYY-MM-DD.md`. If the directory doesn't exist, it's created. If a report for today already exists, it's overwritten (idempotent — running twice in a day just refreshes the data).

### D6: `stream_fn` capture happens in the existing lifespan patch

The `_patched_configure` in `register.py` already has access to the `builder` object after `original_configure` completes. We extract `stream_fn` from the builder at that point and pass it to `init_scheduler`. No new monkey-patches needed.

## Risks / Trade-offs

**[Risk] `stream_fn` signature may change across NAT versions**
Mitigation: Pin NAT version in `pyproject.toml`. Add an integration test that verifies `stream_fn` is callable with `(prompt, session_id)` args.

**[Risk] Cron-triggered agent run competes for LLM resources with interactive users**
Mitigation: Cron jobs default to off — user must explicitly schedule them. The report tool itself does minimal LLM work (one summary call). The heavy lifting is Milvus queries.

**[Risk] Milvus is down when the report fires**
Mitigation: Report tool uses the existing circuit breaker pattern from `findings_store.py`. If Milvus is unavailable, the report is generated with a "Findings unavailable — Milvus unreachable" section instead of failing entirely.

**[Trade-off] Report overwrites same-day file**
Accepted: idempotency is more valuable than versioning for daily reports. Git history on the reports directory handles versioning if needed.
