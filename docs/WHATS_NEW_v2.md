# CGN-Agent v2 — What's New

This document summarizes what was shipped in the v2 cycle and maps the final
state to concrete commits.

## Release scope

- Base branch: `main`
- Core delivery PR: [#7](https://github.com/Cognitive-la/CGN-Agent/pull/7)
- Merge commit: `62755a1`
- Post-merge documentation commits: `596d2c3`, `78ab5bb`

### Scope metrics (from `a706917..HEAD`)

- `src/cognitive_code_agent/`: 40 changed files
- `ui-cognitive/`: 102 changed files
- `tests/`: 37 changed files
- `openspec/specs/`: 45 published spec files updated/added
- `openspec/changes/archive/`: 329 archived change files synced

## Highlights

- Unified runtime modes into `analyze`, `execute`, and `chat`.
  - `/refactor` is now a compatibility alias to `/execute`.
- Prompt system refactor with clearer layering and specialist orchestration.
- Improved non-terminating loop handling and deterministic fallback behavior.
- Expanded memory architecture and findings persistence/retrieval flow.
- New MCP bridge support (backend server + UI integration).
- Dynamic LLM selector in UI/runtime to choose among available NIM models.
- Cron scheduler with daily markdown report tooling.
- Broader backend/frontend test coverage on new runtime and integration paths.
- UI-cognitive upgrades for activity timeline, model UX, and workspace surfaces.

## Detailed included changes (by domain)

### Agent runtime and architecture

- Mode normalization and routing updates to align analyze/execute/chat behavior.
- Prompt composition and system prompt updates across orchestrator + specialists.
- Safer startup/lifespan behavior via register/lifecycle adjustments.
- Execute-path robustness improvements and fallback policy hardening.

### Memory and findings

- Working memory and memory preload improvements for execution flows.
- Findings store alignment and related OpenSpec synchronization.
- Readiness and resilience patterns documented and tested.

### MCP and integrations

- Added MCP server wrapper (`src/cognitive_code_agent/mcp_server.py`).
- Added UI proxy route and MCP server panel (`ui-cognitive/app/api/mcp/route.ts`,
  `ui-cognitive/components/layout/mcp-servers.tsx`).
- Added MCP integration/unit tests.

### Scheduling and reporting

- Extended cron tooling and callback dispatch behavior.
- Added report generation tools (`src/cognitive_code_agent/tools/report_tools.py`).
- Added integration and unit tests for scheduler/report lifecycle.

### UI-cognitive

- Full chat/workspace layout refactor and activity-feed redesign.
- New/updated activity cards (`tool-call-card`, `session-workspace`, timeline entries).
- Model selector and inference preference improvements, including dynamic model
  registry usage for available NIM models.
- Sidebar/workspace and MCP server visibility enhancements.
- Stream rendering, typewriter, autoscroll, and retry UX stabilization.

### Documentation and operations

- Updated `README.md`, `AGENTS.md`, `ARCHITECTURE.md`, `EASYPANEL_SETUP.md`,
  `docker-compose.yml`, `.env.example`.
- Synced and archived OpenSpec changes/specs for released work.

## Included non-merge commits in this v2 delivery window

Commits included from `a706917..HEAD`:

- `48c4c1e` feat: establish governance specs and quality gate automation
- `cbfe9bc` feat(agent): add chat routing, prompt layering, and semantic memory alignment
- `cbce70d` feat(ui): split chat layout and add activity summary components
- `fd9e7de` chore(spec): sync OpenSpec archives with docs and infra updates
- `c3ec049` chore(spec): archive l2 memory alignment change and publish specs
- `0c10a66` chore: ignore local tooling artifacts and format prompt composer test
- `965fe3e` chore(spec): sync openspec archives, publish specs, and update docs
- `cfa5ddf` feat(agent): implement working memory, cron scheduler, and agent resilience improvements
- `b197020` feat(ui): activity panel dedup, spanish labels, enriched tool cards, and ambient background
- `aeadd9c` chore(spec): archive ui-cognitive activity panel and stream dedup changes
- `930b66a` feat(ui): fix activity panel duplicates and enrich tool display
- `79e9667` fix(ui): add Spanish label for spawn_agent tool in activity panel
- `1d35d07` feat(ui): rich spawn_agent input card — task prose, tool chips, iteration metric
- `9d6d477` fix(ui): align SpawnAgentCard chip styles with existing tool-call-card patterns
- `4007879` fix(ui): remove redundant model display and useless message history from agent step card
- `6486671` chore(ui): remove unused model prop from AgentStepCardProps
- `9ec1f25` feat: add MCP bridge and daily report workflow
- `596d2c3` docs(release): add v2 What's New and rollout notes
- `78ab5bb` docs(release): expand v2 notes and changelog coverage

## OpenSpec traceability

Release documentation was cross-checked against:

- Published specs under `openspec/specs/*` (mode routing, fallback policy,
  memory, MCP transport/bridge, UI stream/layout behavior).
- Archived implementation changes under `openspec/changes/archive/*`.
- Active change proposals that were introduced in the same delivery window and
  should be treated as roadmap/in-flight until explicitly archived:
  - `refactor-pipeline-hitl`
  - `fix-agent-loop-recovery`
  - `multimodal-vision-input`
  - `fix-generate-report-startup-crash`
  - `enforce-execute-memory-preload`
  - `editable-layout-ux-polish`
  - `expand-observability-guardrail-coverage`
  - `daily-markdown-report`
  - `compact-and-continue-recovery`
  - `ambient-background-agent-state`
  - `activity-panel-tool-enrichment`

## Behavior changes to note

- Execute mode now carries the primary code-execution responsibilities.
- `/refactor` remains supported but is routed as execute-mode alias.
- Prompt behavior and mode boundaries were tightened for deterministic operation.

## Rollout checklist

1. Pull latest `main` and sync env variables from `.env.example`.
2. Run backend checks (`uv run ruff check . && uv run ruff format --check .`).
3. Run tests in an environment with Redis/Milvus available.
4. Validate cron scheduler startup and report output path permissions.
5. Validate MCP transport exposure if using streamable HTTP.
6. Smoke test UI-cognitive flows (`/analyze`, `/execute`, conversational `chat`).
7. Create release tag and publish GitHub Release notes using this document.

## Suggested release title

`v2.0.0 — Unified execute architecture, MCP bridge, and automated reporting`
