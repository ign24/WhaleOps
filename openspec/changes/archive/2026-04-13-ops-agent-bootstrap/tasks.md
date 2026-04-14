## 1. Environment & Config Baseline

- [x] 1.1 Add `D03_API_URL` and `D03_API_TOKEN` to `.env.example` with placeholder values and comments
- [x] 1.2 Remove `analyze` and `execute` modes from `workflow.modes` in `config.yml`
- [x] 1.3 Remove all code-agent function names from `workflow.tool_names` (top-level fallback list) and the top-level tool_names field in `config.yml`
- [x] 1.4 Set `workflow.default_mode: ops` in `config.yml`
- [x] 1.5 Retain and update the `chat` mode in `config.yml`: set `tool_names: [query_findings]`, update `prompt_path` to `src/cognitive_code_agent/prompts/system/chat.md`

## 2. D03 HTTP Client

- [x] 2.1 Create `src/cognitive_code_agent/tools/d03_client.py` with `D03Client` class using `httpx.AsyncClient`
- [x] 2.2 Implement `D03Client.__init__`: read `D03_API_URL` and `D03_API_TOKEN` from env; raise `RuntimeError` if either is missing; set 10s default timeout and `Authorization: Bearer` header
- [x] 2.3 Implement `D03Client.get_status() -> dict` — async GET `/status`, return parsed JSON
- [x] 2.4 Implement `D03Client.list_services() -> list` — async GET `/services`, return parsed JSON list
- [x] 2.5 Implement `D03Client.get_logs(service: str, lines: int = 50) -> dict` — async GET `/logs/{service}?lines={lines}`, clamp lines to 500 max
- [x] 2.6 Write unit tests for `D03Client` in `tests/unit/tools/test_d03_client.py` using `httpx` mock transport (no real HTTP calls)

## 3. Ops Tools

- [x] 3.1 Create `src/cognitive_code_agent/tools/ops_tools.py` and import `D03Client`
- [x] 3.2 Implement `vps_status()` with `@register_function`: call `D03Client.get_status()`, format output as labelled string (CPU / memory / disk / uptime); return descriptive error string on exception
- [x] 3.3 Implement `list_services()` with `@register_function`: call `D03Client.list_services()`, format as aligned table; mark `failed` services with CRIT label
- [x] 3.4 Implement `get_logs(service: str, lines: int = 50)` with `@register_function`: call `D03Client.get_logs()`, join entries with newlines; return error string on 404 or timeout
- [x] 3.5 Write unit tests for all three tools in `tests/unit/tools/test_ops_tools.py` with a mocked `D03Client`

## 4. Config — Ops Mode Wiring

- [x] 4.1 Add `ops` mode to `workflow.modes` in `config.yml` with: `llm_name: devstral`, `prompt_path: src/cognitive_code_agent/prompts/system/ops.md`, `max_iterations: 20`, `max_history: 8`, `tool_call_timeout_seconds: 30`, `tool_names: [vps_status, list_services, get_logs, query_findings, schedule_task]`
- [x] 4.2 Register `vps_status`, `list_services`, and `get_logs` in the `functions:` block of `config.yml` using their `_type` names (matching NAT `@register_function` registration)
- [x] 4.3 Verify that `chat` mode tool_names contains only `query_findings` (no code tools)
- [x] 4.4 Remove `spawn_agent`, code-review, SAST, clone, refactor, and code-execution entries from the top-level `functions:` block in `config.yml` (or comment them out to avoid NAT registration errors if they reference unregistered types)

## 5. System Prompts

- [x] 5.1 Rewrite `src/cognitive_code_agent/prompts/system/base.md` — ops operator identity: agent is an infra ops assistant for Cognitive LATAM LLC administering D03 from D09; Tier 0 read-only constraint; escalation policy (CRIT/WARN/INFO severity labels)
- [x] 5.2 Create `src/cognitive_code_agent/prompts/system/ops.md` — primary ops mode prompt: tool usage guidance for `vps_status`, `list_services`, `get_logs`; output formatting rules (structured tables/bullets); anomaly escalation instructions; explicit no-write policy
- [x] 5.3 Rewrite `src/cognitive_code_agent/prompts/system/chat.md` — replace code-agent identity with ops-agent identity; keep fast-path intent (greetings, capability questions)
- [x] 5.4 Retain `analyze.md` and `execute.md` on disk but add a `<!-- INACTIVE — code-agent only -->` comment at the top of each so it is clear they are dormant

## 6. Memory Isolation

- [x] 6.1 Set `key_prefix: "ops:"` in `src/cognitive_code_agent/configs/memory.yml` at the top level (applied by all memory layer Redis operations)
- [x] 6.2 Add `db: 1` under the `episodic.store` config block in `memory.yml` so episodic memory connects to Redis DB 1
- [x] 6.3 Update APScheduler Redis job store key prefix from `cgn:apscheduler:` to `ops:apscheduler:` in `register.py` (cron lifespan bridge patch)
- [ ] 6.4 Update `memory/readiness.py` to verify Redis DB 1 connectivity — BLOCKED: `cognitive_code_agent.memory` subpackage was not copied in the fork (pre-existing gap, not introduced by this change). Config isolation is in place via memory.yml.

## 7. Verification

- [x] 7.1 Run `uv run ruff check . && uv run ruff format --check .` — new files clean; 3 pre-existing errors in forked code (safe_tool_calling_agent.py, test_safe_tool_calling_agent.py)
- [x] 7.2 Run `uv run pytest` — 159 tests passing (new: 13 d03_client + 15 ops_tools + existing suite); 10 pre-existing collection errors from missing cognitive_code_agent.memory subpackage (fork gap)
- [x] 7.3 Confirm no secrets in diff — env var names only in d03_client.py (docstring + os.environ.get), no hardcoded values
- [ ] 7.4 Start the server locally (`uv run nat serve`) — deferred: requires Docker daemon and full env setup on D09
- [x] 7.5 Update `ARCHITECTURE.md` — ops mode table, ops_tools.py + d03_client.py in file map, memory isolation noted
