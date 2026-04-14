## Why

This repo is a fresh fork of `cognitive-code-agent` that must become `cognitive-ops-agent`: a single-agent assistant for VPS/infra operations targeting D03 via an HTTP mini-API from the D09 host. The fork was taken on 2026-04-13 with zero ops-domain code; without this change the repo is a code-analysis agent with a renamed manifest. Bootstrap is the critical path to a first working ops session.

## What Changes

- **NEW** Operator system prompt replacing the code-analysis persona (`analyze.md`, `execute.md`, `chat.md`)
- **NEW** `d03_client.py` — thin async HTTP client wrapping the D03 mini REST API (`/status`, `/logs/{service}`, `/services`)
- **NEW** `ops_tools.py` — three read-only NAT-registered tools: `vps_status`, `get_logs`, `list_services`
- **NEW** Ops mode configuration in `config.yml`: new `ops` mode with Devstral 2-123B + ops tool group; `chat` mode retained; `analyze` and `execute` modes disabled or removed
- **NEW** Memory isolation: dedicated Redis key prefix (`ops:`) and DB index so sessions never collide with code-agent data
- **MODIFIED** `pyproject.toml` entry-point and package references updated to reflect ops domain (no rename yet, deferred to reduce churn)
- **REMOVED** Code-specific tools deactivated from config (not deleted from disk — retained dormant until ops domain stabilises): `code_review_tools`, `security_tools` (SAST), `refactor_gen`, `qa_tools`, `docs_tools`, `clone_tools`, `report_tools`, `findings_store`

## Capabilities

### New Capabilities

- `ops-system-prompt`: Operator persona prompt suite — defines the agent's identity, tool surface, tier language, and escalation policy for infra ops
- `d03-ops-api`: D03 mini REST API contract + async HTTP client used by all ops tools
- `ops-tools`: Three initial read-only tools (`vps_status`, `get_logs`, `list_services`) registered in NAT, enforcing Tier 0 safety (no writes)
- `ops-agent-config`: `config.yml` mode restructure — ops mode wired to ops tool group, code-agent modes removed or disabled
- `ops-memory-isolation`: Redis key prefix (`ops:`) + DB index isolation for working and episodic memory layers

### Modified Capabilities

<!-- No existing specs are changing requirements — all code-agent specs remain valid for the source repo. This fork starts fresh. -->

## Impact

- `src/cognitive_code_agent/prompts/system/` — prompts rewritten for ops persona
- `src/cognitive_code_agent/tools/` — new `d03_client.py`, `ops_tools.py`; existing code tools left on disk but removed from `config.yml` tool groups
- `src/cognitive_code_agent/configs/config.yml` — mode definitions, tool groups, LLM assignments restructured
- `src/cognitive_code_agent/configs/memory.yml` — Redis prefix and DB index updated
- `.env.example` — new vars: `D03_API_URL`, `D03_API_TOKEN`
- No new Python dependencies required (httpx already in project)
