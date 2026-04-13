# AGENTS Guide

Operational guide for humans and LLMs contributing to `cognitive-code-agent`.

## 1) Project goal

`cognitive-code-agent` is a single-agent code intelligence system built on
NVIDIA NAT 1.4.1 + LangGraph 1.0.10. It exposes a streaming FastAPI service
that runs code analysis, refactoring, and execution workflows against GitHub
repositories.

## 2) Stack

- Python 3.11–3.13, `uv` for env management
- NVIDIA NAT 1.4.1 (agent framework, FastAPI server, telemetry)
- LangGraph 1.0.10 (graph execution, transitive via `nvidia-nat-langchain`)
- Milvus / milvus-lite (vector findings store)
- Redis (episodic memory, embedding cache)
- Ruff (lint + format, line-length 100)
- pytest + pytest-asyncio (unit and integration tests)
- Mixed project: Python backend + Next.js frontends (`ui/`, `ui-cognitive/`)

## 3) Repository map

```
src/cognitive_code_agent/
  register.py          NAT plugin entry point + monkey-patches
  agents/              SafeToolCallAgentGraph and streaming workflow
  configs/             config.yml (LLMs, tools, MCP, modes)
  memory/              Working, episodic, and auto-retrieval layers
  prompts/             System prompts (per mode) and runtime skills
  routing/             Tier 0 query classifier (query_classifier.py)
  tools/               Custom tool modules (security, review, shell, refactor, docs)
tests/                 pytest test suite
ui/                    OpenUI frontend (Next.js, npm)
ui-cognitive/          Cognitive UI frontend (Next.js, bun)
```

## 4) Multi-mode architecture

The workflow runs a Tier 0 classifier (`routing/query_classifier.py`) before every request. The classifier is stateless, zero-LLM, and regex-based. An explicit `/mode` prefix always bypasses Tier 0. If no prefix is present, the classifier resolves to `CHAT` or `UNKNOWN`; `UNKNOWN` falls through to `resolve_mode()` which selects among analyze / execute based on message prefix (`/refactor` is kept as an alias and maps to execute).

| Mode      | Default | LLM              | Purpose                                              |
|-----------|---------|------------------|------------------------------------------------------|
| `analyze` | yes     | Devstral 2-123B  | Code review/security/QA/docs via specialist subagents |
| `execute` | no      | Devstral 2-123B  | Code modifications, shell/git ops, and execution workflows |
| `chat`    | no      | Kimi K2          | Fast path: greetings, capability questions, affirmations |

`chat` mode suppresses auto-retrieval and skill injection. `analyze` mode also suppresses runtime skill injection (it uses specialist subagents instead). Chat tools: `query_findings`, `fs_tools` (read-only). Max iterations: 3, max history: 4. Triggered automatically by Tier 0 when `IntentClass.CHAT` is detected.

## 5) Key conventions

- All public Python functions require type hints.
- Never hardcode secrets; use `.env` (see `.env.example`).
- Shell tools route through `safety.py` tiered classifier — never bypass it.
- Tool call ID normalization is in `SafeToolCallAgentGraph`; do not remove it.
- Skills are markdown modules in `prompts/skills/`; register in `registry.yml`.
- Memory layers degrade gracefully — always guard Redis/Milvus calls with timeouts.

## 6) REJECT / REQUIRE / PREFER

REJECT:
- Hardcoded API keys, tokens, or secrets in any file
- Skipping `safety.py` validation in shell tool execution
- New direct LangGraph / LangChain imports without justification — prefer NAT abstractions; allow direct imports only when required by NAT extension points and document why
- Disabling ruff or pytest without explicit justification
- Emojis in code, logs, or comments

REQUIRE:
- Type hints on all public Python functions
- Tests for new tools and agent logic changes (unit first, integration if needed)
- `.env.example` updated when new env vars are added
- `ARCHITECTURE.md` updated when new components or modes are added

PREFER:
- `asyncio.wait_for` with explicit timeout over bare awaits on external calls
- Graceful degradation with logging over hard failures in memory layers
- Deterministic safety checks over LLM-based decisions in the hot path
- Existing `lib/` utilities before adding new helpers

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

**Orchestrator holds only:** goal, plan, and final result — never intermediate file reads or bash chains.

**Mode detection rule:** When Claude Code needs to determine which mode (`analyze` / `execute` / `chat`, plus `/refactor` alias to execute) is relevant for a given request, delegate the exploration to a subagent (`subagent_type=Explore`) first. The orchestrator selects the mode based on the returned summary, not by reading files directly.

**Parallel launches:** Use parallel `Agent` calls for independent operations. Examples:
- Lint check + test run + security scan can all run simultaneously.
- Exploring `agents/` + exploring `tools/` can be parallelized if both are needed.

## 11) Memory Protocol (engram)

Use `mem_save` after completing work in the following cases:

| Trigger | `topic_key` pattern |
|---|---|
| Architecture decision made or changed | `architecture/*` (e.g. `architecture/routing`, `architecture/memory-layers`) |
| Bug fixed with identified root cause | `bugfix/<component>` |
| New tool added to `tools/` | `tools/<tool-name>` |
| Mode-specific discovery (analyze/execute/chat) | `mode/<mode-name>` |

**Discovery saves:** Use `mem_save` with type `discovery` when finding non-obvious behavior in:
- `safety.py` tiered classifier (e.g. unexpected tier assignments, bypass edge cases)
- LangGraph routing logic (e.g. unexpected mode selection, state mutation side effects)

**Session summary:** Call `mem_session_summary` before ending any work session. The summary must include:
- Which mode was being modified (`analyze`, `execute`, or `chat`; use `execute` for `/refactor` alias work)
- List of affected files (relative paths from repo root)
- Any open issues or follow-up items

## 12) Continuous Learning

When Claude Code corrects an approach during a session on this project, the correction is automatically captured by CL-v2 hooks.

No manual action is required — instincts are generated from session observations and are available in subsequent sessions.

This applies to corrections on: tool usage patterns, LangGraph state handling, NAT abstraction choices, safety classifier interactions, and mode-specific prompt engineering.
