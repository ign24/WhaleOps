# Fork notes — cognitive-ops-agent

Forked from `cognitive-code-agent` on 2026-04-13.

## Decision record

- Approach: **V1 — copy complete + minimal changes**. No pruning of code-specific modules yet; they remain dormant until the ops domain stabilizes.
- Rationale: ops-agent needs to reach a working state fast. Observe real duplication pain across both agents before deciding what to extract into a shared core (`cgn-agent-core` is deferred).
- Models: same as code-agent for now (Devstral 2-123B + Kimi K2). Revisit after the ops prompt and tools are defined.
- Host: D09 (this agent) administering D03 (target) via HTTP to a mini REST API deployed on D03.
- Channel: Telegram bot (reuse `telegram-bot-integration` design from code-agent).
- Git: clean history. No subtree/submodule link to the source repo.

## What was copied

Full tree from code-agent minus: `.git/`, runtime caches (`__pycache__`, `.venv`, `.next`, `dist`, build, pytest/ruff/mypy caches), `node_modules`, egg-info, ephemeral runtime artifacts (`traces/`, `logs/`, `ui-cognitive/data/`, `memory/`, `findings_cache/`, `workspace/`, `tmp/`), and `tsconfig.tsbuildinfo`.

## Minimal changes applied on day 1

- `pyproject.toml`: renamed to `cognitive-ops-agent`, version reset to `0.0.1`, description updated. Python package layout (`cognitive_code_agent/`) NOT renamed — deferred to avoid mass-rename churn before the ops domain is defined.
- Fresh `git init` on `main`, no history.

## Done (post-fork)

- [x] System prompt rewrite for the ops domain (`ops.md`, `base.md`, `chat.md`).
- [x] Ops tools (read-only, Tier 0): `list_containers`, `get_container_logs`, `inspect_container` via Docker Python SDK.
- [x] Structured memory: `save_note` / `get_notes` tools backed by SQLite (`ops_notes.db`).
- [x] Memory store isolation: Redis DB 1, key prefix `ops:`, separate from code-agent.
- [x] Telegram bot gateway: separate bot token, allowlist, `/reset` command, concurrency guard.
- [x] `ui-cognitive/` ships with ops-agent; `ui/` (OpenUI) removed.
- [x] Observability: `cognitive-ops-agent` project name in trace output.
- [x] Cron jobs: APScheduler + Redis job store, `schedule_task` tool, `/api/jobs` endpoint.
- [x] Ops dashboard page (`/ops`): Docker status + notes + cron jobs without LLM.

## Still pending

- [ ] Remove / archive dormant code-specific tools: `code_review_tools`, `security_tools`, `refactor_gen`, `qa_tools`, `docs_tools`, `clone_tools`, `report_tools`. Keep `findings_store` for ops findings.
- [ ] Rename Python package `cognitive_code_agent` → `cognitive_ops_agent` once the domain is stable.
- [ ] D03 mini REST API contract (endpoints: `/status`, `/logs/{service}`, `/services`; auth via static token + IP whitelist). Currently deferred — env vars reserved in `.env.example`.
- [ ] Tier 1 write operations (restart, lifecycle) — separate design pass required.
- [ ] Drift discipline: when a fix lands in `cognitive-code-agent` for shared runtime pieces (agent loop, streaming, memory, MCP, cron), evaluate for backport here.

## Drift discipline

Because the core is duplicated, when a fix lands in `cognitive-code-agent` for any of the shared runtime pieces (agent loop, streaming, shell safety tiers, memory, MCP bridge, cron), it MUST be evaluated for backport here. Open an issue in this repo titled `backport: <sha>` with the upstream commit. When the pain of backports becomes real, that's the signal to extract `cgn-agent-core`.

## Not copied / runtime only

Ephemeral state (`memory/`, `traces/`, `logs/`, `findings_cache/`, `workspace/`) will be recreated at runtime by the agent. UI build artifacts (`.next/`, `node_modules/`) reinstall via `bun install` + `bun run build`.
