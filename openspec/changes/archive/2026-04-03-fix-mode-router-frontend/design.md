## Context

The multi-mode agent (analyze/refactor/execute) has a fully working backend: `resolve_mode()` parses `/refactor` and `/execute` prefixes, `_build_mode_runtime()` creates per-mode graphs with different LLMs (DeepSeek/Devstral/Kimi K2) and isolated toolsets, and the refactoring skill auto-activates when the message contains "refactor" and write tools are available.

The problem is entirely in the frontend → backend message flow:

```
User types: /refactor Refactorizar el sistema de alertas
         ↓
chat-panel.tsx: startsWith("/") → switch on command name
         ↓
command NOT in whitelist (help|tools|status|reset|stop|analyze|quick-review)
         ↓
"Comando desconocido" → message NEVER reaches backend
```

`/analyze` works by coincidence: the frontend converts it to `"full analysis <args>"`, which happens to be the default mode. But `/refactor` and `/execute` are dead.

Secondary issue: even when analyze works, its findings are too shallow for refactor to operate autonomously (generic summaries, no file paths or stack details).

## Goals / Non-Goals

**Goals:**
- `/refactor <message>` reaches the backend with prefix intact so `resolve_mode()` routes to Devstral
- `/execute <message>` reaches the backend with prefix intact so `resolve_mode()` routes to Kimi K2
- Both commands appear in autocomplete and `/help` output
- Analyze findings include file paths, stack versions, and structural context for cross-mode use
- Agent stops retrying permanently broken tools (missing binaries, dead services)

**Non-Goals:**
- Changing the backend mode routing logic (already correct)
- Changing LLM assignments or tool isolation per mode (already correct)
- Adding a "mode" parameter to the API route (messages with prefix are sufficient)
- Fixing ruff/sandbox availability in Docker (separate infra concern)
- Changing how `/analyze` works (the `"full analysis"` conversion is fine)

## Decisions

### D1: Forward `/refactor` and `/execute` with prefix intact

The frontend will forward these commands as `"/refactor <args>"` and `"/execute <args>"` — including the slash prefix. This is what `resolve_mode()` expects (regex: `^/(analyze|refactor|execute)\b\s*`).

**Alternative considered**: Strip the prefix and add a `mode` query parameter to the API route. Rejected because it requires API changes, and the backend already handles prefix-based routing.

### D2: Keep `/analyze` conversion unchanged

`/analyze` currently converts to `"full analysis <args>"`, which triggers `detect_analysis_mode()` and defaults to analyze mode. This works correctly. No change needed.

**Why not unify**: Making `/analyze` also forward with prefix would require changing `detect_analysis_mode()` which is tested and working. No benefit.

### D3: Prompt-level enforcement for findings quality

Rather than adding validation code to `persist_findings`, we add a `<findings_quality>` prompt section to `analyze.md` that specifies the required structure for findings. This is the standard pattern in this codebase — all agent behavior is guided through system prompts.

**Alternative considered**: Schema validation in the `persist_findings` tool itself. Rejected because: (1) it would reject findings that are slightly incomplete rather than degrading gracefully, (2) the tool already has field-level constraints (8192 char limits, required fields), and (3) prompt-level guidance is how all other quality controls work in this project.

### D4: Prompt-level stop-retrying rules

Add explicit rules to both analyze and refactor prompts: "If a tool fails with FileNotFoundError or ConnectionRefused, do NOT retry. Record the gap and continue." This is cheaper and more flexible than implementing retry detection in the agent framework.

## Risks / Trade-offs

- **[Prompt compliance]** LLMs don't always follow prompt instructions perfectly. The findings quality and stop-retrying rules are best-effort. → Mitigation: Use strong imperative language (MUST/SHALL), place rules in `<execution_rules>` blocks that the model has been shown to respect.
- **[Prefix collision]** A user could type `/refactoring` (not `/refactor`), which wouldn't match the regex. → Mitigation: Acceptable — the frontend autocomplete suggests the exact command, and the backend regex is documented.
- **[No rollback needed]** All changes are additive (new command routes, new prompt sections). Rolling back means removing the frontend routing — straightforward.
