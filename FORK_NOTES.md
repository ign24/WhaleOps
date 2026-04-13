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

## TBD — to define with the team

- [ ] System prompt rewrite for the ops domain (operator persona, tool surface, tier language).
- [ ] Remove / archive code-specific tools once ops-equivalent tools exist: `code_review_tools`, `security_tools` (SAST), `refactor_gen`, `qa_tools`, `docs_tools`, `clone_tools`, `report_tools`, `findings_store` (Milvus).
- [ ] Rename Python package `cognitive_code_agent` → `cognitive_ops_agent` once nothing else is moving.
- [ ] Delete `ui/` (unused per code-agent convention) and evaluate whether `ui-cognitive/` ships with ops-agent or the ops view is a panel inside the code-agent UI.
- [ ] D03 mini REST API contract (endpoints: `/status`, `/logs/{service}`, `/services`; auth via static token + IP whitelist).
- [ ] Deploy target: D09 host, container layout, port, secrets management.
- [ ] Ops tools (read-only first): `vps_status`, `get_logs`, `list_services`. Tier 0 only.
- [ ] Guardrails and tiers for future write operations (restart, lifecycle) — separate design pass.
- [ ] Telegram bot configuration for this agent (separate bot token, command namespace).
- [ ] Memory store isolation: different Redis key prefix / DB index so ops sessions don't mix with coder sessions.
- [ ] Observability: separate NAT trace exporter destination.

## Drift discipline

Because the core is duplicated, when a fix lands in `cognitive-code-agent` for any of the shared runtime pieces (agent loop, streaming, shell safety tiers, memory, MCP bridge, cron), it MUST be evaluated for backport here. Open an issue in this repo titled `backport: <sha>` with the upstream commit. When the pain of backports becomes real, that's the signal to extract `cgn-agent-core`.

## Not copied / runtime only

Ephemeral state (`memory/`, `traces/`, `logs/`, `findings_cache/`, `workspace/`) will be recreated at runtime by the agent. UI build artifacts (`.next/`, `node_modules/`) reinstall via `bun install` + `bun run build`.
