## Context

The agent system has 8 prompt files (1 base + 3 modes + 4 sub-agents) composed at runtime by `composer.py`. The base prompt is concatenated with the active mode prompt and up to 2 skill prompts. The system runs in Docker with sandboxed filesystem (`/tmp/analysis` ephemeral, `/app/workspace` persistent), 10+ LLM models via NVIDIA NIM, episodic/semantic/working memory layers, cron scheduling, shell access, code execution sandbox, and spawn_agent for parallel sub-agents.

Current prompts were written incrementally — each feature added its own policy section, creating an over-prescriptive system that tells the agent *how* to execute rather than *what it can do*. The result: the agent follows rigid workflows instead of reasoning about the best approach per task.

Reference docs (Agents_v2.md, NCP-AAI Study Guide) agree on the pattern: **role + environment + tools (with anti-patterns) + guardrails on safety/output, not on execution order**.

## Goals / Non-Goals

**Goals:**
- Agent knows its full environment and capabilities without being told step-by-step how to use them
- Prompts follow the structure: identity → environment → tools → guardrails → output expectations
- Agent can parallelize, choose tool order, and adapt depth to task complexity
- Priority_policy and evidence-based findings requirements are preserved (safety guardrails stay)
- Teams can customize identity, business objective, output style, and other behavioral knobs from config.yml without editing prompt files
- XML tag structure stays compatible with `composer.py`
- Sub-agent prompts get minor consistency polish (they're already well-designed)

**Non-Goals:**
- Adding new tools or capabilities
- Changing the skill system or registry
- Modifying the memory system behavior
- Changing model routing or LLM configuration
- Full Jinja/template engine — plain `{{variable}}` substitution is sufficient

## Decisions

### D1: Single environment section in base.md instead of scattered path references

**Choice**: Add one `<environment>` section to `base.md` that describes the Docker sandbox, filesystem paths, memory layers, scheduling, and available models. Remove all path references from mode prompts.

**Why over alternatives**:
- Alternative: Keep paths in each mode prompt → duplication, maintenance burden, and the agent in chat mode doesn't know about /app/workspace
- Alternative: Put environment in config.yml as a dynamic injection → over-engineering for static content
- The environment is the same across all modes. Base prompt is the right place.

### D2: Replace model_execution_guidelines with capability_model

**Choice**: Remove the prescriptive "one tool at a time" and "stepwise behavior" instructions. Replace with a `<capability_model>` section that describes what the agent CAN do (parallel calls, multi-step reasoning, tool composition) and a few anti-patterns to avoid.

**Why**: Both reference docs emphasize that agents should decide execution strategy. The NCP-AAI guide explicitly says parallelization of independent subtasks is a core pattern. The current guideline actively prevents this.

### D3: Output guidelines instead of output contracts

**Choice**: Mode prompts provide output *guidelines* (what information to include) rather than rigid *contracts* (mandatory sections in mandatory order). The agent formats based on what the task actually produced.

**Why over alternatives**:
- Alternative: Keep rigid contracts → forces 6-section output even for a simple "what language is this repo?" query
- Alternative: No output guidance at all → too loose, agent might omit critical info
- Middle ground: "Include these elements when relevant" gives structure without rigidity

### D4: Minimal mode overrides — just role + tools + expectations

**Choice**: Each mode prompt contains only:
1. Role statement (what this mode does)
2. Tools available in this mode (brief, not exhaustive docs — tools have their own descriptions)
3. Mode-specific expectations (analyze: evidence-based findings; execute: validate after changes; chat: conversational)

**Why**: Current mode prompts duplicate base content (directory_tree_policy appears in both analyze and execute). Policies that apply everywhere belong in base. Mode prompts should be short and focused.

### D5: Identity and behavior are team-configurable via prompt_config

**Choice**: Add a `prompt_config` section to `config.yml` with adjustable variables. Prompt files use `{{variable}}` placeholders that get resolved at composition time by a new `render_template()` function in `composer.py`.

**Configurable variables:**
```yaml
prompt_config:
  agent_name: "Cognitive Intelligence"
  identity: "A code intelligence agent that analyzes, modifies, and monitors codebases."
  business_objective: "Support engineering teams with code analysis, refactoring, and operational tasks."
  response_language: "same as user"
  output_style: "structured"  # structured | conversational | minimal
  autonomy_level: "high"      # low (ask before acting) | medium (ask for destructive) | high (execute freely within guardrails)
  emoji_set: ""               # empty = no emojis. Teams can set custom emoji characters.
  workspace_path: "/app/workspace"
  analysis_path: "/tmp/analysis"
```

**Why over alternatives**:
- Alternative: Hardcode identity in prompt files → teams fork prompt files, drift ensues
- Alternative: Full Jinja template engine → over-engineering, new dependency, debugging complexity
- `{{variable}}` substitution is ~15 lines of code, no dependencies, easy to reason about
- Teams change `config.yml` (which they already manage), not prompt files

### D6: Sub-agent prompts — preserve structure, add environment hint

**Choice**: Sub-agent prompts keep their current structure (context_assessment, available_tools, evidence_requirement, severity_rubric, failure_policy, output_format). Only change: add a one-line note that they inherit the workspace path from the spawning agent.

**Why**: These are the best prompts in the system. They follow the exact pattern both docs recommend. Don't fix what works.

## Risks / Trade-offs

- **[More autonomous = less predictable]** → Mitigation: priority_policy and evidence_requirement guardrails stay. If outputs degrade, we can add targeted constraints back without reverting to full prescriptive mode.
- **[Shorter prompts = less guidance for weaker models]** → Mitigation: The system uses devstral (123B) and kimi-k2 as primary models — both capable enough. The skill system injects domain-specific guidance when triggered.
- **[Removing output contract may reduce structured output consistency]** → Mitigation: Output guidelines still specify what elements to include. The change is from "must be in this exact format" to "include these when relevant."
- **[Environment section adds tokens to every request]** → Mitigation: ~200 tokens for full environment awareness. Worth it vs. the agent guessing or failing to use capabilities.
- **[Config drift between environments]** → Mitigation: Default values in prompt_config reproduce safe, sensible behavior. Missing variables render as empty string with a log warning.
