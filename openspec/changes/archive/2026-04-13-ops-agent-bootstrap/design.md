## Context

`cognitive-ops-agent` is a fresh fork of `cognitive-code-agent` taken on 2026-04-13. The source repo is a code-intelligence agent (code review, refactoring, SAST, clone workflows). The fork's goal is a VPS/infra operations assistant that administers D03 (a remote machine) from D09 (the host running this container) via an HTTP mini-API deployed on D03.

Current state at fork time: all code-agent tools and prompts remain intact; the only change is the manifest name. The agent would boot as a code agent without this change.

Stakeholders: Cognitive LATAM LLC engineering (single operator).

Constraints:
- No new Python dependencies — `httpx` (already declared) covers the D03 HTTP client.
- The package Python namespace (`cognitive_code_agent`) is NOT renamed in this change — deferred to reduce churn until the ops domain stabilises.
- No write-tier ops tools (restart, service lifecycle) in this bootstrap — Tier 0 (read-only) only.
- D03 mini REST API spec is defined here; the D03-side implementation is out of scope.

## Goals / Non-Goals

**Goals:**
- Replace code-agent system prompts with an ops-domain operator persona
- Register three read-only ops tools (`vps_status`, `get_logs`, `list_services`) in NAT
- Implement `d03_client.py` as the single HTTP layer between ops tools and D03
- Restructure `config.yml` to expose one `ops` mode + retain `chat` mode; remove `analyze` and `execute` modes
- Isolate ops memory from code-agent Redis data via key prefix `ops:` and DB index 1

**Non-Goals:**
- Python package rename (`cognitive_code_agent` → `cognitive_ops_agent`)
- Write-tier ops tools (restart, deploy, lifecycle changes) — separate design pass
- Telegram bot integration — separate change
- UI changes (`ui/`, `ui-cognitive/`) — deferred
- Deleting code-agent tool files from disk — retained dormant per V1 fork decision
- D03-side REST API implementation — this change defines the contract only
- `cgn-agent-core` extraction — deferred

## Decisions

### D1 — Single `ops` mode replaces `analyze` + `execute`

**Decision:** Collapse to one primary ops mode (Devstral 2-123B) plus retain `chat`.  
**Rationale:** The code-agent's analyze/execute split exists because read-only analysis vs. write-capable execution carry different risk profiles and tool sets. For ops Tier 0 (all tools read-only), this distinction adds no value. A single ops mode reduces config surface and makes the agent easier to reason about during early iteration. When write-tier tools are introduced, a second mode can be added.  
**Alternative:** Keep analyze/execute — rejected: unnecessary complexity at bootstrap.

### D2 — D03 client as a standalone `d03_client.py` module

**Decision:** Implement a thin `D03Client` class in `tools/d03_client.py` that wraps `httpx.AsyncClient`. All three ops tools import this client — they do not make HTTP calls directly.  
**Rationale:** Centralises auth headers, base URL, and timeout configuration. Makes it easy to swap the transport (e.g. add mTLS, retry logic) without touching tool code.  
**Alternative:** Inline httpx calls in each tool function — rejected: duplicates config and makes the auth token appear in three places.

### D3 — Ops tools registered via `@register_function` (NAT-native)

**Decision:** `ops_tools.py` uses the existing `@register_function` decorator pattern (same as all other tools in this project). NAT discovers tools through `config.yml` tool_names lists.  
**Rationale:** Consistent with every other tool in the codebase; no new registration patterns to maintain.  
**Alternative:** MCP server for D03 tools — deferred; adds operational complexity (npx subprocess, stdio transport) for three simple HTTP wrappers that are already in Python.

### D4 — Memory isolation via Redis key prefix + DB index

**Decision:** Set `key_prefix: "ops:"` in `memory.yml` and point episodic memory to Redis DB index 1 (code-agent uses the default DB 0).  
**Rationale:** Prevents cross-contamination of episodic summaries between the code agent and the ops agent. DB index 1 is the cheapest isolation available without running a second Redis instance.  
**Alternative:** Separate Redis instance — overkill for a single-machine deployment; deferred until traffic justifies it.

### D5 — Code-agent tools deactivated in config, not deleted from disk

**Decision:** Remove code-specific function names from `config.yml` tool_names and function_groups. The Python modules remain on disk.  
**Rationale:** Preserves the option to backport framework fixes from the source repo without merge conflicts in tool files. Deletion deferred until the ops domain is stable and the backport pain of maintaining the files exceeds the risk of removing them.

### D6 — `D03_API_URL` and `D03_API_TOKEN` from environment

**Decision:** The D03 client reads two env vars: `D03_API_URL` (base URL of the mini REST API) and `D03_API_TOKEN` (static bearer token).  
**Rationale:** Follows existing `.env` convention — no secrets in code.

## Risks / Trade-offs

- **D03 API not yet deployed** → The ops tools will fail at runtime until D03's mini REST API is live. Mitigation: `D03Client` raises a descriptive `RuntimeError` if `D03_API_URL` is unset, so the agent reports a clear error instead of hanging.

- **Single ops mode may need splitting later** → If write-tier tools are added, the current single-mode config will need a second mode with HITL and stricter guardrails. Mitigation: config structure keeps the `modes` block, so adding a second mode is a config-only change.

- **Package namespace mismatch** → `cognitive_code_agent` namespace means imports and entry-points still read as the source project. Mitigation: documented in `FORK_NOTES.md`; no runtime impact for ops-agent behaviour.

- **Redis DB 1 assumed available** → If the Redis instance is configured with `databases 1`, DB 1 will not exist. Mitigation: document in `.env.example` and add a readiness check that logs a warning (does not hard-fail).

## Migration Plan

1. Add `D03_API_URL` and `D03_API_TOKEN` to `.env.example`.
2. Create `src/cognitive_code_agent/tools/d03_client.py`.
3. Create `src/cognitive_code_agent/tools/ops_tools.py` with the three tool functions.
4. Rewrite `src/cognitive_code_agent/prompts/system/{base,analyze,execute,chat}.md` → ops persona prompts: `base.md` (operator identity), `ops.md` (primary ops mode), `chat.md` (unchanged intent, updated identity).
5. Update `src/cognitive_code_agent/configs/config.yml`: remove code-agent function groups from tool_names, add `ops_tools` function group, add `ops` mode, set `default_mode: ops`.
6. Update `src/cognitive_code_agent/configs/memory.yml`: set `key_prefix: "ops:"`, `db: 1` under episodic store config.
7. Run `uv run ruff check . && uv run pytest -x -m "not e2e"` — all existing tests must pass (no behaviour removed, only new code added).

**Rollback:** revert the five files changed in steps 4–6 and delete the two new files in steps 2–3.

## Open Questions

- **D03 REST API auth scheme**: Static bearer token is assumed. Does D03 also require IP whitelist enforcement at the network level, or only token auth?
- **`get_logs` pagination**: D03 `/logs/{service}` endpoint — does it support `?lines=N` or `?since=` query params, or does it return a fixed tail? The tool signature should expose at least `lines: int` if the API supports it.
- **ops mode model**: Devstral 2-123B is the same model as code-agent. Is there a lighter/faster model preferred for infra queries (e.g. `kimi_reader`) given ops queries are typically shorter-context than code analysis?
