## Context

The cognitive-code-agent is a single-agent code intelligence system running on NVIDIA NAT framework. Today it has:

- **Working Memory**: `trim_messages` with `max_history=8` — a sliding window that drops older messages without summarization.
- **Episodic Memory (partial)**: `persist_findings` / `query_findings` in Milvus — only structured technical findings, agent must explicitly call these tools.
- **Redis**: Pure cache layer for embeddings (7d TTL) and query results (1h TTL). Not used for memory.
- **Procedural Memory**: Static system prompts and skill files. Read-only.
- **Semantic Memory**: None. No accumulated domain knowledge.

NAT already ships `RedisEditor` and `MemoryItem` (from `nat.memory.models` and `nat.plugins.redis`) with vector search capabilities. Integration tests exist (`test_redis_memory_integration.py`) but the feature was never wired into production.

Stack: Python 3.12, NAT 1.4.1, pymilvus 2.5, redis-py 4.x, DeepSeek V3.2 via NIM, nvidia/llama-nemotron-embed-1b-v2 (dim=2048).

## Goals / Non-Goals

**Goals:**
- Implement NVIDIA's memory taxonomy with clear separation: Working, Episodic, Semantic, Procedural.
- Working memory survives long tool-calling chains (25 iterations) without losing reasoning context.
- Episodic memory captures session outcomes and user interaction patterns across sessions.
- Semantic memory accumulates domain knowledge from repeated analyses.
- Automatic retrieval injects relevant memory at session start — zero user effort required.
- All memory types degrade gracefully if backing stores are unavailable.
- Configuration-driven: each memory type can be enabled/disabled independently.

**Non-Goals:**
- Procedural memory learning (modifying system prompts based on outcomes) — too risky for a code analysis agent, stick with static procedures for now.
- Multi-user memory isolation — the agent currently has no user identity concept; adding auth is a separate concern.
- Real-time memory streaming — memory is read at session start and written at session end, not updated mid-conversation.
- Memory garbage collection / TTL-based eviction policies beyond what Redis provides natively.

## Decisions

### D1: Memory layer mapping

```
NVIDIA Taxonomy          Implementation              Backing Store
──────────────────────────────────────────────────────────────────
Sensory Memory           Not implemented (N/A)       -
                         Raw input buffering is
                         handled by HTTP/FastAPI

Working Memory           trim_messages +             In-process
                         summarization before        (LLM call for
                         eviction                    summarization)

Episodic Memory          NAT RedisEditor with        Redis (persistent)
                         MemoryItem vectors           + NIM embedder

Semantic Memory          Dedicated Milvus collection  Milvus
                         "domain_knowledge"           (qa_findings kept
                                                      separate)

Procedural Memory        Static prompts/skills       Filesystem
                         (unchanged)                 (read-only)
```

**Why RedisEditor for Episodic instead of Milvus?** Episodic memories are conversational, high-write, and benefit from TTL expiration. Redis is already deployed, NAT provides the RedisEditor abstraction with vector search, and conversation memories are naturally ephemeral (weeks, not months). Milvus is better suited for the denser, longer-lived semantic knowledge.

**Alternative considered:** Using Milvus for everything. Rejected because: (1) Milvus upsert is heavier than Redis SET for high-frequency conversation memories, (2) NAT's RedisEditor already handles the vector search for this use case, (3) separation of concerns — volatile vs durable.

### D2: Working Memory Summarization

When `trim_messages` would evict messages, first pass them through a lightweight summarization step:

```
Before (current):
  messages = [sys, h1, a1, h2, a2, h3, a3, h4, a4]  # 9 messages
  trim_messages(max_history=8) → drops h1/a1 permanently

After (proposed):
  messages = [sys, h1, a1, h2, a2, h3, a3, h4, a4]
  about_to_evict = [h1, a1]
  summary = llm.summarize(about_to_evict)  # ~50 tokens
  messages = [sys, {summary}, h2, a2, h3, a3, h4, a4]  # summary replaces evicted
```

**LLM choice for summarization:** Use the same `deepseek_coder` model but with `max_tokens=200` to keep summaries compact. The cost is one extra LLM call per eviction event, but it only triggers when the window overflows (not every message).

**Alternative considered:** Token-based trimming instead of message-based. Rejected because NAT's `trim_messages` is message-based and changing to token-based would require forking the LangChain utility.

### D3: Episodic Memory Schema

```python
MemoryItem(
    user_id="session:{session_id}",
    text="Session summary: analyzed repo X, found 3 critical vulns, user asked about...",
    tags=["session-summary", "repo:owner/repo", "user:nacho"],
    metadata={
        "session_id": "...",
        "repo_id": "owner/repo",
        "timestamp": 1234567890,
        "outcome": "completed",  # completed | abandoned | error
        "findings_count": 5,
        "tools_used": ["run_semgrep", "run_pytest", "persist_findings"],
    }
)
```

Written at session end (when the last message is sent or after a timeout). Retrieved at session start via vector search on the user's opening message + repo context.

### D4: Semantic Knowledge Extraction

After `persist_findings` succeeds, an optional post-processing step extracts generalizable knowledge:

```
Findings (specific):
  "repo: acme/api, file: src/db.py, SQL injection via string interpolation"
  "repo: acme/api, file: src/auth.py, hardcoded JWT secret"

Extracted knowledge (general):
  "Python web APIs commonly have SQL injection risks in database modules"
  "JWT secret management is a frequent security gap in auth modules"
```

**Storage:** New Milvus collection `domain_knowledge` with schema:
- `id` (VARCHAR, PK)
- `knowledge_text` (VARCHAR)
- `source_finding_ids` (VARCHAR — JSON array of finding IDs that contributed)
- `domain` (VARCHAR — "security", "testing", "architecture", etc.)
- `confidence` (FLOAT — increases when multiple findings corroborate)
- `created_at` / `updated_at` (INT64)
- `embedding` (FLOAT_VECTOR, dim=2048)

**Extraction trigger:** Only runs when `persist_findings` upserts 3+ findings in a single call (avoids noise from single-finding persists).

**Alternative considered:** Extracting knowledge in real-time during analysis. Rejected because it would add latency to every tool call and the agent's primary job is analysis, not knowledge management.

### D5: Automatic Memory Retrieval at Session Start

When a new session begins (first user message), before the LLM processes it:

```
1. Extract intent from user message (repo URL, keywords, task type)
2. In parallel:
   a. Redis: search episodic memories (last 5 sessions, weighted by recency)
   b. Milvus: search domain_knowledge (top 3 relevant items)
   c. Milvus: search qa_findings (top 3 from same repo, if repo detected)
3. Compose memory block:
   "[Memory Context]
    Previous sessions: ...
    Domain knowledge: ...
    Past findings for this repo: ..."
4. Inject as system message after base prompt, before user message
```

**Latency budget:** 2 seconds max for all three parallel queries. If any times out, proceed without it.

### D6: Configuration Structure

```yaml
memory:
  working:
    enabled: true
    max_history: 8
    summarize_on_eviction: true
    summary_max_tokens: 200
  episodic:
    enabled: true
    store: redis  # uses existing REDIS_URL
    max_sessions_retrieved: 5
    ttl_days: 90
  semantic:
    enabled: true
    store: milvus  # uses existing MILVUS_URI
    collection_name: domain_knowledge
    extraction_threshold: 3  # min findings to trigger extraction
    max_knowledge_retrieved: 3
  auto_retrieval:
    enabled: true
    timeout_seconds: 2
    include_episodic: true
    include_semantic: true
    include_findings: true
    max_findings_retrieved: 3
```

All memory types default to `enabled: true` but degrade silently if backing stores are unavailable (consistent with current cache behavior).

## Risks / Trade-offs

**[Risk] Summarization adds latency to long sessions** -- The extra LLM call for summarization adds ~500ms-1s each time the context window overflows. Mitigation: only triggers when messages are actually being evicted (not every turn), and uses a low `max_tokens` cap.

**[Risk] Episodic memory grows unbounded in Redis** -- Without TTL management, Redis memory usage could grow over time. Mitigation: `ttl_days: 90` default, and Redis's `maxmemory-policy allkeys-lru` will evict oldest entries if memory pressure occurs.

**[Risk] Semantic knowledge extraction quality depends on LLM** -- The extraction step could produce low-quality generalizations. Mitigation: confidence scoring (only surface knowledge corroborated by multiple findings), and extraction only triggers after 3+ findings.

**[Risk] Auto-retrieval could inject irrelevant context** -- If the vector search returns low-quality matches, the agent gets confused. Mitigation: similarity score threshold (only include memories above 0.5 cosine similarity), and the auto-retrieval block is clearly delimited in the prompt so the LLM knows it is background context, not instructions.

**[Trade-off] Redis dual role (cache + episodic memory)** -- Redis now serves two purposes. If Redis goes down, both cache performance and episodic memory are lost. Acceptable because both degrade gracefully and Redis is already a required service.

**[Trade-off] No multi-user isolation** -- All memories are in the same namespace. For a single-user agent this is fine, but adding multi-tenancy later will require prefixing keys. The schema supports `user_id` in MemoryItem for future use.
