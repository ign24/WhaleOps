## Why

The multi-mode agent architecture (analyze/refactor/execute) was implemented with correct backend routing, per-mode LLMs, and tool isolation — but the frontend intercepts all `/` commands and only whitelists 7 of them. `/refactor` and `/execute` get "Comando desconocido" and never reach the backend. The entire refactor/execute flow is dead on arrival.

Additionally, the analyze mode persists findings that are too shallow (generic summaries without file paths, stack versions, or model definitions), making the cross-mode findings bridge useless for autonomous refactoring. The agent also wastes iterations retrying tools that are permanently unavailable (ruff not installed, sandbox down).

## What Changes

- Route `/refactor` and `/execute` through the frontend to the backend agent, preserving the prefix so `resolve_mode()` can switch to the correct graph (Devstral / Kimi K2)
- Add `/refactor` and `/execute` to the command registry for autocomplete and `/help` text
- Enrich the analyze system prompt so findings include file paths, stack versions, model/table names, and endpoint paths — the minimum context for refactor mode to work autonomously
- Add stop-retrying rules to both analyze and refactor prompts so the agent skips permanently broken tools instead of looping

## Capabilities

### New Capabilities
- `frontend-mode-routing`: Frontend slash command handler routes `/refactor` and `/execute` to the backend agent with prefix intact
- `findings-quality`: Analyze prompt enforces structured, file-path-rich findings that serve as cross-mode context for refactor

### Modified Capabilities
- `refactoring-skill`: Add stop-retrying rule for validation tools that fail with "not found" or "connection refused"

## Impact

- **Frontend**: `chat-panel.tsx` slash command handler, `command-registry.ts` autocomplete entries
- **Backend prompts**: `analyze.md` (new section + execution rules), `refactor.md` (new guard rule)
- **Frontend tests**: `chat-panel.test.tsx` needs test cases for new routed commands
- **No API changes**: messages already flow as plain text; the backend `resolve_mode()` already handles the prefixes
- **No config changes**: mode configs, LLM assignments, and tool sets are already correct
