## Why

The agent runs a single workflow with DeepSeek V3.2 as the sole orchestrator for everything: analysis, code generation, reporting, and git operations. This causes three problems:

1. **Model mismatch**: DeepSeek is a reasoning model being forced to generate large code files and write reports. Devstral (code-specialized, 32K context) sits idle except as a delegated tool.
2. **Timeout failures**: Long-running analysis sessions hit aiohttp's default HTTP timeout (~300s) mid-generation, killing the workflow. The NAT Runner then throws `ValueError: Cannot exit the context without completing the workflow`, crashing the FastAPI response stream.
3. **Cost inefficiency**: Every interaction — including lightweight ops like writing a commit message — uses the most expensive model with the full tool set.

## What Changes

Introduce 3 explicit execution modes, each backed by a specialized LLM and scoped tool set:

- **analyze** (DeepSeek V3.2): Repository scanning, auditing, diagnostics. Read-only tools + findings persistence. Default mode.
- **refactor** (Devstral 2 123B): Code modification, file writing, validation. Reads findings from analyze phase, writes and validates code.
- **execute** (Kimi K2): Lightweight operations — git commit/push, PR creation, report generation, synthesis.

Mode selection is explicit via message prefix (`/analyze`, `/refactor`, `/execute`) with `analyze` as the default.

Additionally, harden the timeout and streaming layers to prevent premature workflow termination.

## Capabilities

### New Capabilities
- `mode-router`: Deterministic prefix-based router that selects the appropriate workflow before the first LLM call.
- `analyze-workflow`: Dedicated workflow config with DeepSeek, read-only tools, and analysis-focused system prompt.
- `refactor-workflow`: Dedicated workflow config with Devstral, read+write tools, and code modification system prompt.
- `execute-workflow`: Dedicated workflow config with Kimi K2, git/shell tools, and ops-focused system prompt.
- `timeout-hardening`: Patch aiohttp client timeout for NIM calls, make streaming fallback resilient to NAT Runner lifecycle errors.

### Modified Capabilities
- `safe_tool_calling_agent`: Refactored to support multiple workflow instances selected by the router.

## Impact

- **Code**: `safe_tool_calling_agent.py` (router logic + multi-workflow support), `register.py` (aiohttp timeout patch), new prompt files per mode.
- **Config**: `config.yml` gains per-mode workflow definitions replacing the single `workflow` block.
- **Prompts**: `base.md` splits into `analyze.md`, `refactor.md`, `execute.md` with shared sections extracted.
- **Dependencies**: None. All models and tools already exist in config.
- **Infrastructure**: No changes. Same NIM endpoints, same Redis/Milvus.
