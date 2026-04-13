## Context

CGN-Agent is a code intelligence platform with 4 product domains: Code Review, QA & Testing, Security Audit, and Documentation. Today all 4 domains share a single LLM context with 23 tools. The tier0 classifier and mode routing (analyze/refactor/execute/chat) already exist and work correctly — this change only affects what happens inside the analyze and refactor orchestrators.

The LangGraph pattern for sub-agents-as-tools is established and already in use: `reader_agent` is a `tool_calling_agent` that NAT wraps as a `StructuredTool` with a single string input. The orchestrator calls it with a question, receives a string result, and never sees the sub-agent's internal tool calls. This is the context isolation needed.

## Goals / Non-Goals

**Goals:**
- Reduce tools visible to analyze orchestrator from 23 to 8
- Each domain sub-agent sees only 3-4 tools relevant to its domain
- Orchestrator prompt becomes ~30 lines with no tool listings or phase protocols
- Sub-agent prompts are 20 lines of domain-specific instructions
- Tier0 classifier, mode routing, streaming, memory, and findings store unchanged

**Non-Goals:**
- Changing tool implementations (ruff, semgrep, pytest, etc.)
- Modifying the LangGraph graph structure or streaming
- Removing the skill system entirely (kept for refactor/execute if useful)
- Automated tool selection or dynamic sub-agent creation at runtime
- Changing execute or chat modes (they are already well-scoped)

## Decisions

### D1: Sub-agents as tool_calling_agent in config.yml, not custom Python

**Decision**: Define `security_agent`, `qa_agent`, `review_agent`, `docs_agent` as `_type: tool_calling_agent` in `config.yml`, following the exact same pattern as `reader_agent`.

**Why**: NAT already handles the wrapping to StructuredTool automatically. No new Python code needed — only config and prompt files. The pattern is validated in production with `reader_agent`.

**Alternative considered**: Custom Python classes per sub-agent. Rejected — unnecessary code complexity for what is purely a config + prompt concern.

### D2: Sub-agent input is a single string question

**Decision**: Each sub-agent receives a natural language question from the orchestrator (e.g., "Run security scan on /tmp/analysis/myrepo and report findings with file paths and severity").

**Why**: The official LangGraph pattern (`ask_fruit_expert(question: str) -> str`) isolates the sub-agent's internal complexity from the orchestrator. The orchestrator doesn't need to know which specific tools the sub-agent will call — it just delegates the domain question.

### D3: Orchestrator prompt has no tool listing and no phase protocol

**Decision**: The new `analyze.md` (~30 lines) only describes the orchestrator's role and delegation strategy. No `<available_tools>`, no 5-phase protocol, no `<directory_tree_policy>`.

**Why**: The `<available_tools>` section is what the model reads back to users when asked "how do you work". Removing it forces the model to respond from its role, not its inventory. The 5-phase protocol belongs in the orchestrator's reasoning, not as hardcoded prompt instructions — the model decides which sub-agents to invoke based on the request.

**Policies that move**: `directory_tree_policy` moves into `reader_agent.md`. `findings_quality` moves into each sub-agent prompt. `output_contract` stays in the orchestrator prompt.

### D4: Skill injection disabled for analyze, preserved for refactor/execute

**Decision**: Remove `build_active_skills_block` call only for `analyze` mode. The skill system remains in code but is not invoked when `mode == "analyze"`.

**Why**: Sub-agents replace skills in analyze. Refactor may still benefit from skill injection (the refactoring.md skill has detailed guidelines). This is the minimal change — disabling only where replaced.

### D5: Tool allocation per sub-agent

```
security_agent  → run_semgrep, run_trivy, run_gitleaks, run_bandit
qa_agent        → run_pytest, run_jest, analyze_test_coverage, query_qa_knowledge
review_agent    → run_ruff, run_eslint, analyze_complexity, get_diff
docs_agent      → analyze_docstrings, check_readme, analyze_api_docs
reader_agent    → fs_tools, github_tools (unchanged)

analyze orchestrator → security_agent, qa_agent, review_agent, docs_agent,
                        reader_agent, clone_repository, persist_findings, query_findings
```

Tools removed from analyze top-level (now inside sub-agents): run_pytest, run_jest, analyze_test_coverage, query_qa_knowledge, run_ruff, run_eslint, analyze_complexity, get_diff, run_semgrep, run_trivy, run_gitleaks, run_bandit, analyze_docstrings, check_readme, analyze_api_docs.

Tools removed from analyze entirely: `code_exec`, `tavily_search`, `context7_tools`. These are not needed for analysis — `code_exec` is a security risk in read-only mode, `tavily_search` adds noise, `context7_tools` belongs in refactor.

## Risks / Trade-offs

- **[Risk] Sub-agent LLM budget** → Each sub-agent has its own recursion limit (`max_iterations` × 2). Set sub-agent max_iterations to 8 — sufficient for 4 tool calls with retries, avoids budget exhaustion.
- **[Risk] Orchestrator loses fine-grained control** → The orchestrator can't tell `security_agent` to run only semgrep and skip trivy. Mitigation: sub-agent prompts include sensible defaults; the orchestrator passes context in the question string.
- **[Risk] reader_agent used in both analyze and refactor** → Shared sub-agent definition works; each mode builds its own runtime graph independently.
- **[Trade-off] Less prescriptive analysis** → The 5-phase protocol disappears. The orchestrator may not always run all phases. Acceptable — the rigid protocol was causing the "reads back its own prompt" problem and over-activating all skills on every request.

## Open Questions

- Should `tavily_search` be added back to a `research_agent` sub-agent later? → Defer until production data shows the need.
- Should `context7_tools` move inside `reader_agent` or stay in refactor top-level? → Keep in refactor top-level for now; reader_agent is read-only and context7 is primarily useful when writing code.
