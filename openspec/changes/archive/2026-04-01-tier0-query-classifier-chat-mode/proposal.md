## Why

Every query — including greetings like "hola" — currently dispatches to DeepSeek v3.2 with 21 tool schemas and a full system prompt (~7,000–12,000 tokens minimum), producing 8–20s TTFT for trivial interactions. There is no pre-dispatch classification layer, so the system has no way to distinguish a conversational query from a full repository analysis.

## What Changes

- **New Tier 0 classifier** (`query_classifier.py`): pure-Python, zero-LLM, deterministic intent detection using regex patterns. Runs before any LLM dispatch. Returns one of: `chat`, `analyze`, `analyze-lite`, `refactor`, `execute`.
- **New `chat` mode** in `config.yml`: uses `kimi_reader` (already configured), minimal tool set (1–3 tools), minimal system prompt. Targets: greetings, capability questions, status queries, follow-up clarifications.
- **New `chat.md` system prompt**: stripped-down identity + conversational behavior. No tool documentation, no analysis protocols.
- **Integration in `safe_tool_calling_agent.py`**: Tier 0 classifier runs before `resolve_mode()`. If `chat` is detected and no explicit `/mode` prefix is present, routes to `chat` mode directly.
- **Extend `detect_analysis_mode()`** in `composer.py`: absorbs Tier 0 signal so skills block is also suppressed for chat queries (no skill injection when intent is conversational).

## Capabilities

### New Capabilities

- `tier0-query-classifier`: Deterministic pre-dispatch intent classifier. Detects conversational, greeting, and capability-question intents via regex. Returns a routing decision before any LLM is involved.
- `chat-mode`: Fast-path execution mode using `kimi_reader` + minimal tools. Handles conversational queries with low latency and low token cost.

### Modified Capabilities

- `automatic-memory-retrieval`: Auto-retrieval must be suppressed or reduced for `chat` mode (no point querying Milvus findings for "hola"). The retrieval pipeline needs a mode-aware gate.

## Impact

- `src/cognitive_code_agent/agents/safe_tool_calling_agent.py`: integration of Tier 0 before mode resolution
- `src/cognitive_code_agent/prompts/composer.py`: extend `detect_analysis_mode()` to accept classifier result
- `src/cognitive_code_agent/configs/config.yml`: add `chat` mode block
- `src/cognitive_code_agent/prompts/system/chat.md`: new file
- `src/cognitive_code_agent/routing/` (new module): `query_classifier.py`
- `tests/unit/test_query_classifier.py`: new unit tests
- No new external dependencies
- No changes to NAT config structure
- No breaking changes to existing modes or `/mode` prefix system
