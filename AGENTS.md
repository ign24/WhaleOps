# AGENTS Guide

Operational guide for humans and LLMs contributing to `cognitive-ops-agent`.

## 1) Project goal

`cognitive-ops-agent` is a read-only (Tier 0) infrastructure assistant built on
NVIDIA NAT 1.4.1 + LangGraph 1.0.10. It exposes a streaming FastAPI service that
monitors Docker containers on D09 via the Docker Python SDK, persists structured
operational notes in SQLite, and can be reached via browser (ui-cognitive) or
Telegram.

## 2) Stack

- Python 3.11–3.13, `uv` for env management
- NVIDIA NAT 1.4.1 (agent framework, FastAPI server, telemetry)
- LangGraph 1.0.10 (graph execution, transitive via `nvidia-nat-langchain`)
- Docker Python SDK (container inspection — read-only)
- SQLite (`ops_notes.db`) — structured ops notes: instructions, patterns, summaries
- Redis Stack (episodic memory + APScheduler job store)
- Milvus / pymilvus (historical findings vector store — `ops_findings` collection)
- `python-telegram-bot` (Telegram webhook gateway)
- Ruff (lint + format, line-length 100)
- pytest + pytest-asyncio (unit and integration tests)
- Frontend: Next.js 16 + React 19 (`ui-cognitive/`)

## 3) Repository map

```
src/cognitive_code_agent/
  register.py          NAT plugin entry point + four monkey-patches
  ops_api.py           FastAPI router: /api/ops/status, /api/ops/notes
  jobs_api.py          FastAPI router: /api/jobs
  agents/              SafeToolCallAgentGraph and streaming workflow
  configs/             config.yml (LLMs, tools, modes), memory.yml
  memory/              Working, episodic, and auto-retrieval layers
  prompts/             System prompts (ops.md, chat.md, base.md) and runtime skills
  routing/             Tier 0 query classifier (query_classifier.py)
  telegram/            Bot gateway: bot.py, routes.py, session_bridge.py
  tools/
    ops_tools.py       list_containers, get_container_logs, inspect_container
    sqlite_tools.py    save_note, get_notes
    cron_tools.py      schedule_task (APScheduler + Redis)
    [inactive]         clone_tools, code_review_tools, security_tools,
                       qa_tools, docs_tools, shell_tools, refactor_gen,
                       spawn_agent — dormant code-agent modules
tests/                 pytest test suite
ui-cognitive/          Web frontend (Next.js, bun)
```

## 4) Multi-mode architecture

The workflow runs a Tier 0 classifier (`routing/query_classifier.py`) before every
request. The classifier is stateless, zero-LLM, and regex-based. An explicit `/mode`
prefix bypasses Tier 0. If no prefix is present, the classifier resolves to `CHAT`
or `UNKNOWN`; `UNKNOWN` falls through to `resolve_mode()`.

| Mode   | Default | LLM            | Purpose                                                 |
|--------|---------|----------------|---------------------------------------------------------|
| `ops`  | yes     | Devstral 2-123B | Container inspection, log analysis, note management, cron |
| `chat` | no      | Devstral 2-123B | Fast path: greetings, capability questions, note lookup  |

`chat` mode suppresses auto-retrieval and skill injection.
Chat tools: `get_notes` (max 2 calls). Max iterations: 3, max history: 4.
Triggered automatically by Tier 0 when `IntentClass.CHAT` is detected.

**Tier 0 constraint:** ops tools issue read-equivalent Docker API calls only.
No restart, stop, exec, or any write operation. Write operations require a
future Tier 1 change.

## 5) Key conventions

- All public Python functions require type hints.
- Never hardcode secrets; use `.env` (see `.env.example`).
- Do NOT add `from __future__ import annotations` in modules that register NAT
  functions — NAT reads inspect.signature annotations at startup and fails on
  deferred strings.
- Tool call ID normalization is in `SafeToolCallAgentGraph`; do not remove it.
- Skills are markdown modules in `prompts/skills/`; register in `registry.yml`.
- Memory layers degrade gracefully — always guard Redis/Milvus calls with timeouts.

## 6) REJECT / REQUIRE / PREFER

REJECT:
- Hardcoded API keys, tokens, or secrets in any file
- Emojis in code, logs, or comments
- `from __future__ import annotations` in NAT tool modules
- New direct LangGraph / LangChain imports without justification
- Disabling ruff or pytest without explicit justification

REQUIRE:
- Type hints on all public Python functions
- Tests for new tools and agent logic changes (unit first, integration if needed)
- `.env.example` updated when new env vars are added
- `ARCHITECTURE.md` updated when new components or modes are added

PREFER:
- `asyncio.wait_for` with explicit timeout over bare awaits on external calls
- Graceful degradation with logging over hard failures in memory layers
- Deterministic safety checks over LLM-based decisions in the hot path

## 7) Development workflow

```bash
# Setup
uv sync --extra dev

# Lint + format check
uv run ruff check . && uv run ruff format --check .

# Tests
uv run pytest -x -m "not e2e"

# Full check before PR
uv run ruff check . && uv run ruff format --check . && uv run pytest -x
```

## 8) Pre-PR checklist

- [ ] `ruff check` passes with no errors
- [ ] All unit/integration tests pass
- [ ] No secrets in diff (`grep -r "API_KEY\|SECRET\|TOKEN" src/`)
- [ ] `.env.example` updated if new vars added
- [ ] `ARCHITECTURE.md` updated if architecture changed
- [ ] Coverage >= 70% (`uv run coverage report`)

## 9) Git conventions

- Branch: `feat/description`, `fix/description`
- Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`
- Never push directly to `main`

## 10) Subagent Delegation (Claude Code sessions)

When working on this project with Claude Code, apply the orchestrator-worker split:

**Delegate to subagents:**
- Codebase exploration (file tree traversal, symbol search, pattern matching)
- Multi-file edits that are logically independent
- Test runs (unit, integration, e2e)
- Audits (security scan, coverage report, ruff check)
- Reading `ARCHITECTURE.md` and returning a summary
- Any parallel independent tasks (e.g. lint + test + security scan simultaneously)

**Orchestrator holds only:** goal, plan, and final result.

**Parallel launches:** Use parallel `Agent` calls for independent operations.

## 11) Memory Protocol (engram)

Use `mem_save` after completing work in the following cases:

| Trigger | `topic_key` pattern |
|---|---|
| Architecture decision made or changed | `architecture/*` |
| Bug fixed with identified root cause | `bugfix/<component>` |
| New tool added to `tools/` | `tools/<tool-name>` |
| Mode-specific discovery | `mode/<mode-name>` |

Call `mem_session_summary` before ending any work session. The summary must include:
- Which mode or component was modified
- List of affected files (relative paths from repo root)
- Any open issues or follow-up items
