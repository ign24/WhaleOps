## Architecture

### Mode Router

The router is deterministic (no LLM call). It inspects the last user message before any LLM invocation:

```
User message arrives
       |
       v
  ┌────────────────────┐
  │   PREFIX DETECTOR   │
  │                    │
  │  /analyze  -> mode_analyze
  │  /refactor -> mode_refactor
  │  /execute  -> mode_execute
  │  (none)    -> mode_analyze (default)
  └────────┬───────────┘
           |
           v
  ┌────────────────────┐
  │  Strip prefix from  │
  │  user message       │
  │  Select workflow    │
  └────────┬───────────┘
           |
    ┌──────┼──────────┐
    v      v          v
 ANALYZE  REFACTOR  EXECUTE
```

The prefix is stripped before the message reaches the LLM so the model sees clean input.

Implementation: a `resolve_mode()` function in `safe_tool_calling_agent.py` called at the top of `_response_fn`, before skill detection and memory retrieval.

### Workflow Instances

Each mode maps to a pre-built graph with its own LLM, tools, and prompt:

```
safe_tool_calling_agent_workflow()
  |
  |-- builder.get_llm("deepseek_coder")  -> analyze_graph
  |-- builder.get_llm("devstral")        -> refactor_graph
  |-- builder.get_llm("kimi_reader")     -> execute_graph
  |
  |-- _response_fn receives request
  |     |
  |     |-- resolve_mode(last_user_message)
  |     |-- select graph + model_name
  |     |-- proceed with skill detection, memory, trimming
  |     |-- run selected graph
```

All 3 graphs are built at startup. No cold-start penalty per mode.

### Config Structure

```yaml
workflow:
  _type: safe_tool_calling_agent
  default_mode: analyze
  modes:
    analyze:
      llm_name: deepseek_coder
      prompt_path: src/cognitive_code_agent/prompts/system/analyze.md
      max_iterations: 40
      max_history: 8
      tool_names:
        - reader_agent
        - run_pytest
        - run_jest
        - analyze_test_coverage
        - query_qa_knowledge
        - code_exec
        - run_ruff
        - run_eslint
        - analyze_complexity
        - get_diff
        - run_semgrep
        - run_trivy
        - run_gitleaks
        - run_bandit
        - analyze_docstrings
        - check_readme
        - analyze_api_docs
        - tavily_search
        - clone_repository
        - query_findings
        - persist_findings
        - fs_tools          # read-only
        - github_tools
        - context7_tools

    refactor:
      llm_name: devstral
      prompt_path: src/cognitive_code_agent/prompts/system/refactor.md
      max_iterations: 40
      max_history: 8
      tool_names:
        - reader_agent
        - code_gen
        - refactor_gen
        - fs_tools_write    # read+write
        - run_ruff
        - run_eslint
        - run_pytest
        - run_jest
        - analyze_complexity
        - query_findings
        - persist_findings
        - shell_execute
        - context7_tools

    execute:
      llm_name: kimi_reader
      prompt_path: src/cognitive_code_agent/prompts/system/execute.md
      max_iterations: 15
      max_history: 6
      tool_names:
        - shell_execute
        - fs_tools_write
        - github_tools
        - query_findings
        - tavily_search
```

### Tool Isolation Per Mode

| Tool | analyze | refactor | execute |
|------|---------|----------|---------|
| reader_agent | Y | Y | - |
| clone_repository | Y | - | - |
| linters (ruff, eslint) | Y | Y | - |
| scanners (semgrep, trivy, gitleaks, bandit) | Y | - | - |
| test runners (pytest, jest) | Y | Y | - |
| code_gen / refactor_gen | - | Y | - |
| fs_tools (read-only) | Y | - | - |
| fs_tools_write (read+write) | - | Y | Y |
| shell_execute | - | Y | Y |
| github_tools | Y | - | Y |
| persist_findings | Y | Y | - |
| query_findings | Y | Y | Y |
| context7_tools | Y | Y | - |
| tavily_search | Y | - | Y |

### System Prompts

Split `base.md` into 3 mode-specific prompts that share common sections:

- **analyze.md**: Full analysis protocol, read-only policy, findings-oriented output contract.
- **refactor.md**: Code modification guidelines, validation-after-write policy, references findings from analyze phase.
- **execute.md**: Git workflow, PR conventions, report formatting, minimal reasoning — focus on execution speed.

Shared sections (`<identity>`, `<priority_policy>`, `<memory_policy>`) stay in a `_shared.md` partial that gets included or inlined into each prompt at load time.

### Timeout Hardening

#### 1. aiohttp Client Timeout Patch

Applied in `register.py` (alongside the existing MCP enum patch):

```python
def _apply_nim_timeout_patch(total_seconds: int = 900) -> None:
    """Extend aiohttp client timeout for NIM LLM calls."""
    from langchain_nvidia_ai_endpoints._common import _NVIDIAClient
    import aiohttp

    original = _NVIDIAClient._create_async_session

    def _patched(self):
        session = original(self)
        # Replace with extended timeout
        timeout = aiohttp.ClientTimeout(total=total_seconds)
        session._timeout = timeout
        return session

    _NVIDIAClient._create_async_session = _patched
```

#### 2. Streaming Fallback Resilience

The current flow:
```
astream() -> timeout -> except -> ainvoke() -> works
                                             \-> Runner.__aexit__ raises ValueError
                                                  \-> Starlette crashes
```

Fix: wrap the entire response generator in a defensive layer that catches Runner lifecycle errors after the content has already been yielded. The user gets their response; the error is logged but swallowed.

#### 3. Timeout Budget Per Mode

| Mode | tool_call_timeout | max_iterations | Rationale |
|------|-------------------|----------------|-----------|
| analyze | 900s | 40 | Long scans, many phases |
| refactor | 900s | 40 | Large file generation |
| execute | 120s | 15 | Quick ops, fail fast |

### Skill System Interaction

Skills continue to work. They activate based on the user message content, independent of mode. But:

- Skill activation only injects skills whose `required_tools` are available in the active mode's tool set.
- If user says `/refactor security review` — the refactor mode activates, but the security-review skill won't inject because scanners aren't in refactor's tool set. This is the correct behavior.
- The refactoring skill naturally pairs with refactor mode.
- The security/qa/docs skills naturally pair with analyze mode.

### Memory Interaction

Memory system works identically across all 3 modes:
- Working memory summarization applies to all modes.
- Episodic memory persists after any mode's session.
- Auto-retrieval injects at session start regardless of mode.
- `query_findings` is available in all modes so any mode can read past findings.
