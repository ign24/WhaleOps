## Context

The agent currently has three execution modes (analyze, refactor, execute), each pre-compiled as a LangGraph at startup. Mode selection happens via explicit `/mode` prefix from the user (`resolve_mode()`), defaulting to `analyze`. No classification runs before this — every query without a prefix hits DeepSeek v3.2 with 21 tool schemas (~7K–12K tokens minimum), producing 8–20s TTFT on conversational input.

The codebase already has primitives that need coordination rather than replacement:
- `resolve_mode()` handles explicit prefix routing
- `detect_analysis_mode()` detects QUICK/FULL keyword signals but only annotates the prompt, does not re-route
- `_retrieve_memory_context()` runs on the first message unconditionally
- `build_active_skills_block()` suppresses skills if no triggers match

## Goals / Non-Goals

**Goals:**
- Classify conversational/greeting intent before any LLM dispatch (Tier 0, zero-LLM)
- Route classified chat queries to a fast `chat` mode (kimi_reader + minimal tools)
- Suppress auto-retrieval for chat-classified queries (no Milvus/Redis overhead for "hola")
- Keep all existing modes, configs, and the `/mode` prefix system untouched
- No new external dependencies

**Non-Goals:**
- ML-based intent classification (out of scope, adds dependency and latency)
- Partial tool set reduction within analyze mode (analyze-lite deferred)
- Multi-turn chat memory or session continuity for chat mode
- Changing NAT config structure or tool registration

## Decisions

### D1: Tier 0 as pure Python module, not LLM

**Decision**: Implement `src/cognitive_code_agent/routing/query_classifier.py` as regex + keyword matching. Returns `IntentClass` enum: `CHAT`, `ANALYZE`, `UNKNOWN`.

**Rationale**: A lightweight LLM router (RouteMoA pattern) would add a network round-trip (~300–800ms) before the actual dispatch. For the target cases (greetings, "¿qué podés hacer?", "ok gracias"), regex patterns have >95% recall and zero infrastructure cost. Edge cases fall through to `UNKNOWN` which defaults to existing behavior.

**Alternative considered**: Small embedding model (e.g., sentence-transformers) for semantic routing. Rejected: adds ~200MB dependency, warm-up time at startup, and is overkill for the signal we need.

### D2: Chat mode pre-compiled at startup, same as other modes

**Decision**: `chat` mode is declared in `config.yml` and compiled into `mode_runtimes` at startup alongside analyze/refactor/execute.

**Rationale**: Pre-compilation is how all modes work. Deviating would require bypassing the `_build_mode_runtime` path, introducing a special case in `_response_fn`. Consistency is worth more than the marginal startup time (kimi_reader + 1-2 tools is fast to compile).

**Alternative considered**: Dynamic lightweight path that bypasses LangGraph entirely. Rejected: NAT's graph handles streaming, tool calls, error recovery. Even for chat, that infrastructure is valuable and removing it creates a maintenance fork.

### D3: Tier 0 runs only when no explicit `/mode` prefix is present

**Decision**: `_response_fn` checks for explicit mode prefix first (`resolve_mode()`). If a prefix is found, Tier 0 is skipped. If no prefix, Tier 0 classifies and may override the default mode to `chat`.

**Rationale**: Explicit user intent always wins. If the user types `/analyze hola`, they want analyze mode — do not override. The Tier 0 classifier is a convenience for unqualified messages only.

### D4: Auto-retrieval suppressed for CHAT intent

**Decision**: In `_response_fn`, skip `_retrieve_memory_context()` when the resolved mode is `chat`.

**Rationale**: Auto-retrieval was designed for repository analysis context injection. For a greeting or capability question, querying Redis + Milvus adds up to 2s with zero benefit. The memory block would either be empty or irrelevant.

**Implementation**: Single `if mode != "chat":` guard around the existing auto-retrieval block. No changes to `AutoMemoryRetriever`.

### D5: Chat system prompt is minimal — no tool documentation, no analysis protocols

**Decision**: `src/cognitive_code_agent/prompts/system/chat.md` contains only: identity, language policy, and conversational behavior. No `<available_tools>` section, no `full_analysis_protocol`.

**Rationale**: The analyze/refactor/execute prompts include detailed tool usage docs because the model needs to know when and how to use 10–21 tools. kimi_reader in chat mode has 1–2 tools. Injecting tool documentation for tools that don't exist in this context confuses the model and wastes tokens.

## Risks / Trade-offs

**False positives (chat classified when user wanted analysis)**
→ Mitigation: regex patterns are conservative — short messages with clear greeting markers only. Anything ambiguous returns `UNKNOWN` → falls to default `analyze`. User can always use explicit `/analyze` prefix to force the mode.

**False negatives (analysis query not detected, stays in analyze)**
→ This is the safe failure mode. No regression on existing behavior.

**kimi_reader (Kimi K2) quality for capability questions**
→ kimi_reader is designed for repository exploration, not general chat. Its instruction-following for open-ended questions is acceptable but not optimized.
→ Mitigation: if the enterprise client reports degraded quality in chat responses, the LLM for chat mode is a single config.yml change.

**Startup time increase**
→ One additional `_build_mode_runtime` call for `chat` at startup. kimi_reader is already instantiated for `reader_agent` — the LLM instance will be reused by NAT's builder cache. Net additional time: graph compilation for 1–2 tools, ~1–2s.

## Migration Plan

1. Deploy: `chat` mode compiles at startup. If `kimi_reader` NIM endpoint is unavailable, the mode compilation fails and is logged. Existing modes are unaffected.
2. Rollback: remove the `chat:` block from `config.yml` and the Tier 0 call from `_response_fn`. No data migration needed.

## Open Questions

- Should `query_findings` be included in chat mode tools? It would let the agent answer "¿analizaste el repo X antes?" with real data. Adds one tool but gives the chat mode memory of past analysis. **Tentative: yes, include it.**
- Token budget for chat mode max_history: 4 messages is likely sufficient. Verify this doesn't cause issues if a user has a long conversation before switching to `/analyze`.
