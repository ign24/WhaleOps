## Context

The cognitive-code-agent uses a two-LLM architecture: deepseek_coder as the orchestrator (cheap, reasons and decides) and devstral as the code executor (expensive, generates code). Today devstral is accessed via `code_gen`, a NAT built-in tool with a hardcoded system prompt: "You are a helpful code assistant that can teach a junior developer how to code." This is unsuitable for enterprise refactoring.

The agent has filesystem write tools (`write_file`, `edit_file` via `fs_tools_write` MCP) and analysis tools (`run_ruff`, `run_eslint`, etc.), but no prompt instructs the agent to use them in a refactoring cycle.

Expert-curated skills exist both inside the agent (code-reviewer, security-review, senior-qa, etc.) and in the global skills library (~/.agents/skills/): python-expert, senior-frontend, backend-patterns, vercel-react-best-practices, fullstack-developer, async-python-patterns. These encode best practices from framework authors and senior engineers. They must be leveraged during refactoring — not replaced by generic LLM knowledge.

Current limits: devstral max_tokens=8192, deepseek max_tokens=8192, max_iterations=25. These are too conservative for refactoring projects with 10+ files.

## Goals / Non-Goals

**Goals:**
- Deepseek detects the project stack, produces a refactoring plan, and orchestrates per-file execution.
- Devstral receives structured input (project context + plan + file + expert guidelines) and generates production-quality refactored code.
- Expert-curated guidelines (python-expert, senior-frontend, backend-patterns, vercel-react-best-practices) are selected per detected stack and passed to devstral.
- Refactored files are written in-place on the cloned repo at `/tmp/analysis/{repo}`.
- Linter/test validation runs after each file write.
- Token budgets support multi-file full-project refactoring.
- A new custom tool `refactor_gen` replaces `code_gen` for refactoring with a professional system prompt.

**Non-Goals:**
- Git push or PR creation (explicitly excluded for now).
- File download endpoint in the UI (Phase 2, separate change).
- Modifying the NAT built-in `code_gen` tool (it stays as-is for quick snippets).
- Dynamic skill loading at runtime by the agent (skills are selected at prompt composition time).

## Decisions

### D1: Custom tool `refactor_gen` instead of reusing `code_gen`

**Decision:** Create a new custom tool `refactor_gen` in `src/cognitive_code_agent/tools/refactor_gen.py` following the existing NAT custom tool pattern (`FunctionBaseConfig` + `@register_function`). This tool wraps devstral with a professional system prompt.

**Alternatives considered:**
- Reuse `code_gen` and compensate via query: The system prompt still says "teach a junior developer" and hardcodes "Python" as the language. While devstral 123B may ignore a weak system prompt when the query is clear, this is unprofessional for an enterprise tool and creates a permanent mismatch between intent and instruction. Rejected.
- Modify NAT's built-in `code_gen`: Modifying vendor code would break on upgrades and is not maintainable. Rejected.

**Rationale:** Custom tools are a first-class pattern in this project (12 already exist). `refactor_gen` follows the same pattern, gives full control over the system prompt, and cleanly separates refactoring generation from snippet generation.

### D2: Expert skills are curated extracts embedded in the refactoring skill

**Decision:** The `refactoring.md` skill includes curated extracts of the most important guidelines from each expert skill, organized by stack:
- **Python stack:** Key rules from `python-expert` (PEP 8, type hints, error handling, mutable defaults, comprehensions, context managers).
- **Frontend stack:** Key rules from `senior-frontend` + `vercel-react-best-practices` (component patterns, hooks discipline, TypeScript strictness, performance, RSC boundaries).
- **Backend Node.js stack:** Key rules from `backend-patterns` (repository pattern, error handling, validation, middleware, query optimization).
- **Fullstack:** Combines Python + Frontend or Backend + Frontend as appropriate.

Deepseek reads the detected stack and includes ONLY the relevant guidelines section in the query to `refactor_gen`.

**Alternatives considered:**
- Register python-expert, senior-frontend, etc. in registry.yml and rely on trigger matching: The skill activation system matches against the user message, not against what the agent discovers about the repo. If user says "refactorizar el proyecto" without mentioning "Python", python-expert would never activate. Rejected.
- Inject full skill files: python-expert is 5.5KB, backend-patterns is 14KB, async-python-patterns is 21KB. Injecting full files would consume too many tokens in the query to devstral. Curated extracts (~2-3KB per stack) are sufficient. Rejected.
- Let devstral rely purely on its training: Devstral knows code, but curated skills encode specific opinions (e.g., Vercel's 57 rules for React performance). These are authoritative and opinionated in ways generic training is not. Rejected.

**Rationale:** Curated extracts are the best balance of quality, token efficiency, and maintainability. They capture the expert opinions that matter most for refactoring while keeping the query to devstral within practical limits.

### D3: Deepseek orchestrates the full cycle, devstral only generates

**Decision:** The refactoring skill instructs deepseek to: (1) detect stack, (2) plan, (3) for each file: read it, package context+plan+file+guidelines into a query, call `refactor_gen`, write the result with `write_file`, validate with linter. Devstral only receives a query and returns refactored code. It can note adjustments to the plan.

**Rationale:** Preserves the orchestrator/executor split. Deepseek is cheap for reasoning. Devstral is expensive but expert at code. The skill guides deepseek's orchestration; devstral's expertise comes from its training + the curated guidelines in the query.

### D4: Token limits — devstral 32768, deepseek 16384, iterations 40

**Decision:**
- devstral `max_tokens`: 8192 -> 32768 (4x). Enough for ~10-15 full files per `refactor_gen` call.
- deepseek `max_tokens`: 8192 -> 16384 (2x). Enough for longer reasoning about multi-file plans.
- `max_iterations`: 25 -> 40. A refactoring cycle per file uses ~4-5 iterations (read, refactor_gen, write, lint, maybe fix). For 8 files that's ~35 iterations.

**Rationale:** Devstral's 256K context window allows much more. 32K output is a practical sweet spot. 40 iterations gives headroom for 8-10 file refactors without making runaway loops catastrophic (900s timeout still applies).

### D5: Write on the cloned repo, not /app/workspace

**Decision:** Refactored files are written in-place on the cloned repo at `/tmp/analysis/{repo_name}`. The `fs_tools_write` MCP already has `/tmp/analysis` in its allowed paths.

**Rationale:** Preserves git history. User can diff changes. In Phase 2, download will be a zip of the modified repo.

### D6: required_tools uses resolved MCP tool names, not group names

**Decision:** The skill's `required_tools` in `registry.yml` uses individual MCP tool names (`write_file`, `edit_file`) — NOT the function group name (`fs_tools_write`).

**Rationale:** The builder expands MCP function groups into individual tools via `get_accessible_functions()`. The `available_tool_names` list (line 373 of `safe_tool_calling_agent.py`) contains `write_file`, `edit_file`, etc. — never `fs_tools_write`. Using the group name in `required_tools` would cause the composer check (line 89) to silently skip the skill. All existing skills only reference plain `functions:` entries; this is the first to depend on MCP tools.

### D7: Per-file cycle, not batch generation

**Decision:** The skill instructs the agent to process files one at a time: read file, call refactor_gen, write, validate. Not batch.

**Rationale:** Per-file gives feedback between iterations. If a lint fails, it can fix before moving on. Batch risks wasting the entire token budget on code that doesn't pass validation.

### D8: refactor_gen system prompt structure

**Decision:** The `refactor_gen` tool has a system prompt that:
1. Establishes identity as a senior software engineer doing production refactoring for an enterprise.
2. Instructs to follow the expert guidelines provided in the query.
3. Instructs to output the complete refactored file, not diffs or snippets.
4. Allows noting adjustments to the plan if the code reveals something the plan missed.
5. Does NOT hardcode a programming language (the query specifies it via context).

**Rationale:** The system prompt sets the professional tone. The expert guidelines and project context come in the query, where they can vary per file and per stack.

## Risks / Trade-offs

- **[Higher cost per refactoring request]** -> Devstral 4x token limit means up to 4x cost per call. Mitigated: `refactor_gen` is only called during refactoring, not for simple questions. `code_gen` remains unchanged for quick snippets.
- **[Curated guidelines may drift from source skills]** -> Extracts in refactoring.md could become outdated as global skills evolve. Mitigated: guidelines are foundational rules that change infrequently. Add a comment in refactoring.md noting the source skill and version for future syncing.
- **[Agent loop exhaustion at 40 iterations for very large projects]** -> 40 iterations handles ~8-10 files. Mitigated: skill instructs agent to prioritize high-impact files and report remaining files if budget runs out.
- **[edit_file MCP tool may struggle with large files]** -> String replacement can fail on ambiguous matches. Mitigated: skill instructs to prefer `write_file` (full file replacement) over `edit_file` for refactored files.
- **[Cloned repo may be stale]** -> `/tmp/analysis` repos persist between requests. Mitigated: skill instructs to re-clone or pull if user specifies a branch/commit.
