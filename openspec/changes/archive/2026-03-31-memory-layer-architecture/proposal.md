## Why

The agent has a single memory mechanism: `persist_findings` / `query_findings` backed by Milvus for cross-session technical findings. There is no conversational memory between sessions, no user preference persistence, no within-session context summarization, and no automatic memory retrieval at session start. Following NVIDIA's memory taxonomy (Sensory, Working, Episodic, Semantic, Procedural), only Working Memory (trimmed context window) and a narrow slice of Episodic Memory (findings only) exist today. This limits the agent's ability to build rapport with users, learn from past analyses, and maintain continuity across sessions.

## What Changes

- Implement **Working Memory enhancement**: within-session summarization before context eviction so the agent retains reasoning context across long tool-calling chains (max_history=8 drops context after ~4 exchanges in a 25-iteration run).
- Implement **Episodic Memory** via NAT's built-in `RedisEditor` (already available as a dependency, tests exist as proof-of-concept but never wired into production): conversation summaries, session outcomes, and user-specific interaction history persisted in Redis with vector search.
- Implement **Semantic Memory accumulation**: after completing analyses, extract generalizable knowledge from findings (e.g., "FastAPI repos commonly lack input validation") and persist it in a dedicated Milvus collection for domain knowledge that transcends individual repos.
- Implement **automatic memory retrieval at session start**: when a new conversation begins, pre-fetch relevant episodic context (past sessions with this user/repo) and inject it into the system prompt before the first LLM call.
- Add a **memory configuration layer** in `config.yml` to control TTLs, collection names, retrieval limits, and which memory types are active.

## Capabilities

### New Capabilities
- `working-memory-summarization`: Context compression that summarizes evicted messages before they are dropped from the sliding window, preserving reasoning continuity within long sessions.
- `episodic-memory`: Cross-session conversational memory using NAT RedisEditor. Stores session summaries, user preferences, and interaction history with vector search retrieval.
- `semantic-knowledge-accumulation`: Post-analysis extraction of generalizable domain knowledge from findings into a dedicated Milvus collection, enabling the agent to build expertise over time.
- `automatic-memory-retrieval`: Pre-fetching of relevant memory context (episodic + semantic + recent findings) at session start, injected into the system prompt before the first LLM call.

### Modified Capabilities
- `findings-store`: The existing findings store needs a minor extension to support the semantic knowledge extraction step that runs after persist_findings.

## Impact

- **Code**: `safe_tool_calling_agent.py` (working memory + auto-retrieval), `findings_store.py` (semantic extraction hook), new module `memory/` for episodic and semantic memory management.
- **Config**: `config.yml` gains a `memory` section with per-type configuration (TTLs, enabled flags, collection names).
- **Dependencies**: No new dependencies. NAT's `RedisEditor` and `pymilvus` are already installed. Redis gains a second role (beyond cache) as episodic memory store.
- **Infrastructure**: Redis must be properly configured with auth (already being fixed). Milvus gains a second collection (`domain_knowledge`) alongside `qa_findings`.
- **Prompts**: `base.md` needs updates to reference auto-injected memory context and guide the agent on when to persist episodic vs semantic memories.
