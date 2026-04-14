# Architecture Reference

> Internal reference for contributors. Documents what each dependency provides,
> how the layers compose, and where custom code overrides framework behavior.
>
> **Note:** This project is `cognitive-ops-agent`, forked from `cognitive-code-agent` on 2026-04-13.
> The Python package namespace remains `cognitive_code_agent` pending a future rename. See `FORK_NOTES.md`.

## Dependency Chain

```
cognitive-ops-agent (this project)
  |
  +-- nvidia-nat 1.4.1               Core framework
  |     +-- pydantic, fastapi, networkx, aiohttp ...
  |
  +-- nvidia-nat-langchain 1.4.1     LangChain bridge (the only package that pulls LangChain in)
  |     +-- langchain-core            Message types, runnables, prompt templates
  |     +-- langgraph 1.0.10          StateGraph, ToolNode, CompiledStateGraph
  |     +-- langchain-nvidia-ai-endpoints 1.1.0   LLM adapter for NVIDIA NIM API
  |
  +-- nvidia-nat-mcp 1.4.1           MCP stdio client (function_groups in config.yml)
  +-- nvidia-nat-redis 1.4.1         RedisEditor for episodic memory
  +-- pymilvus / milvus-lite          Vector store client
  +-- redis                           Cache client
  +-- httpx                           Async HTTP (dormant D03 client)
  +-- docker >=7.0                    Docker Python SDK — ops tools connect via local socket
  +-- pydantic >=2.6                  Config and data models
```

LangGraph and LangChain are **transitive** dependencies. This project never
declares them directly. They enter through `nvidia-nat-langchain`.

## What Each Layer Provides

### NVIDIA NAT 1.4.1

NAT is the agent framework. It provides:

| Capability | How we use it |
|---|---|
| `@register_function` decorator | Registers every tool and the workflow so NAT discovers them from `config.yml` |
| `ToolCallAgentGraph` base class | Parent of `SafeToolCallAgentGraph` — builds the LangGraph graph, defines `agent_node` / `tool_node` / conditional edges |
| `ToolCallAgentWorkflowConfig` | Pydantic config model we extend with `SafeToolCallAgentWorkflowConfig` (adds modes, skills, memory) |
| `Builder` | Resolves LLM and tool instances from `config.yml` names at startup |
| `FunctionInfo` | Wraps our `stream_fn` callable so NAT can serve it via FastAPI |
| FastAPI server | `nat serve` exposes `/chat/stream`, `/monitor/users` — zero custom HTTP code |
| Telemetry | File tracer (JSONL traces), console/file logging, per-user metrics |
| Plugin system | `[project.entry-points.'nat.plugins']` loads our `register.py` at import time |

NAT does **not** wrap LangGraph. It imports LangGraph primitives directly.

### LangGraph 1.0.10 (transitive)

LangGraph is the graph execution engine. NAT's `ToolCallAgentGraph` builds a
standard LangGraph `StateGraph`:

```
                 +-----------+
    __start__ -->| agent_node |
                 +-----------+
                      |
              has tool_calls?
             /               \
           yes                no
            |                  |
      +-----------+       __end__
      | tool_node |
      +-----------+
            |
      +-----+-----+
      | agent_node |  (loop)
      +-----------+
```

Key primitives used:

| From `langgraph` | Usage |
|---|---|
| `StateGraph` | Graph construction in `ToolCallAgentGraph._build_graph()` |
| `CompiledStateGraph` | The compiled graph stored as `self.graph` |
| `ToolNode` | Standard prebuilt node that executes tools — used inside `tool_node()` |
| `GraphRecursionError` | Caught in our streaming loop to stop runaway iterations |

The graph is compiled once at startup per mode and reused for every request.

### LangChain Core (transitive)

Provides the message and runnable primitives:

| From `langchain_core` | Usage |
|---|---|
| `AIMessage` | LLM responses with `.tool_calls` |
| `ToolMessage` | Tool execution results with `.tool_call_id` |
| `BaseMessage` | Base type for the message list in state |
| `trim_messages` | Sliding window over conversation history |
| `RunnableConfig`, `ensure_config`, `merge_configs` | Config plumbing for graph invocation |
| `ChatPromptTemplate` | Used in `refactor_gen.py` for the refactoring LLM call |

### langchain-nvidia-ai-endpoints 1.1.0 (transitive)

The LLM adapter that talks to NVIDIA NIM. It handles:

- Serializing LangChain messages to the NIM chat API format
- Parsing NIM responses into `AIMessage` / `AIMessageChunk`
- Streaming via `astream` and non-streaming via `ainvoke`
- Tool binding (`llm.bind_tools(tools)`)

**Known serialization behavior** (affects our code):

When converting an `AIMessage` to the API payload, the adapter uses
`additional_kwargs["tool_calls"]` — not the parsed `tool_calls` list.
Streaming responses leave `additional_kwargs` empty, which causes the
serialized assistant message to omit tool_calls entirely. Our
`_normalize_tool_call_ids()` compensates by back-filling
`additional_kwargs` from the parsed list.

See `langchain_nvidia_ai_endpoints/_utils.py:91-92`:
```python
if "tool_calls" in message.additional_kwargs:
    message_dict["tool_calls"] = message.additional_kwargs["tool_calls"]
```

### Custom Code (this project)

Everything in `src/cognitive_code_agent/` is ours:

| Component | What it does |
|---|---|
| `SafeToolCallAgentGraph` | Extends NAT's graph with: tool-call timeout (`asyncio.wait_for`), `<think>` block stripping, tool_call ID normalization + `additional_kwargs` back-fill |
| `safe_tool_calling_agent_workflow` | The streaming workflow function: multi-mode routing, skill activation, memory injection, streaming with ainvoke fallback |
| `prompts/composer.py` | Skill registry loader, trigger matching, analysis mode detection |
| `prompts/system/*.md` | System prompts per mode and specialist subagents (base, analyze, execute, chat, security/qa/review/docs) |
| `prompts/skills/*.md` | Runtime skill modules injected on trigger match |
| `memory/` | Three-layer memory: working (summarization), episodic (Redis), auto-retrieval |
| `tools/` | Custom tool modules (security scanners, code review, docs, shell, clone, refactoring, findings store) |
| `tools/safety.py` | Deterministic shell safety classifier (no LLM in the safety path) |
| `tools/findings_store.py` | Milvus-backed vector store with circuit breaker and Redis query cache |
| `tools/cron_tools.py` | Agent-callable cron scheduler: APScheduler `AsyncIOScheduler` with `RedisJobStore` (namespace `ops:apscheduler:*`, Redis DB 1). Exposes `schedule_task` tool (create / list / cancel). Scheduler lifecycle tied to NAT FastAPI lifespan via lifespan patch. |
| `tools/ops_tools.py` | Ops tools (Tier 0): `list_containers`, `get_container_logs`, `inspect_container`. All use `docker.from_env()` to connect to the local Docker socket on D09. |
| `routing/query_classifier.py` | Pure-regex intent classifier (`IntentClass` enum + `QueryClassifier.classify()`), zero-LLM, runs as Tier 0 before mode resolution |
| `register.py` | NAT plugin entry point + three monkey-patches (MCP enum fix, NIM timeout extension, cron lifespan startup/shutdown) |

## State Management

`ToolCallAgentGraphState` is a plain Pydantic `BaseModel`:

```python
class ToolCallAgentGraphState(BaseModel):
    messages: list[BaseMessage] = Field(default_factory=list)
```

No `Annotated[..., add_messages]` reducer. Nodes mutate `state.messages` in-place
and return the full state object. LangGraph creates new state containers between
nodes but preserves references to the inner message objects. In-place mutation
of message attributes (like `tool_calls[0]["id"]`) persists across nodes.

## Multi-Mode Architecture

One workflow, two pre-built graphs (ops + chat). Mode selection goes through two
stages: a Tier 0 intent classifier, then prefix-based resolution.

```
User message
        |
        v
  QueryClassifier.classify()  [Tier 0 — pure regex, zero-LLM]
        |
        +-- CHAT intent + no explicit prefix --> mode overridden to "chat"
        |
        +-- UNKNOWN intent (or explicit prefix present) --> fall through
        |
        v
  resolve_mode()  -->  mode="ops" (default)
        |
        v
  mode_runtimes[mode]  -->  ModeRuntime(graph, model_name, tool_names)
        |
        v
  Skill activation uses ORIGINAL message (with prefix) for trigger matching
  [suppressed when mode == "chat"]
  LLM receives CLEANED message (without prefix) in the conversation
```

Each mode has its own:

| Mode | LLM | Tools | System Prompt | Max Iterations | Max History |
|---|---|---|---|---|---|
| `ops` (default) | Devstral 2-123B | 6 (list_containers, get_container_logs, inspect_container, schedule_task, save_note, get_notes) | `ops.md` | 20 | 8 |
| `chat` | Devstral 2-123B | 1 (get_notes) | `chat.md` | 3 | 4 |

**Tier 0 — Read Only (current bootstrap):** ops tools only issue read-equivalent Docker API calls. Write operations (restart, redeploy, exec) require a future Tier 1 change.

Code-agent modes (`analyze`, `execute`) are inactive in this fork. Their prompt files remain on disk (marked `INACTIVE`) for reference. See `FORK_NOTES.md`.

Modes are defined in `config.yml` under `workflow.modes` and compiled into
separate `CompiledStateGraph` instances at startup.

### Operational budget tuning

Runtime guardrails are non-terminating: denied calls produce `ToolMessage` feedback and the loop continues.
Per-mode `max_tool_calls_per_request` enforces deterministic budgets and should be tuned from traces:

- `ops`: `list_containers=3`, `get_container_logs=5`, `inspect_container=5`, `save_note=10`, `get_notes=3`
- `chat`: `get_notes=2`

When limits are hit, the agent should consolidate evidence and return partial output instead of terminating the request.

## Streaming Architecture

```
stream_fn(request)
    |
    v
  graph.astream(state, stream_mode="updates", version="v2")
    |
    +-- yields node update events
    |     |
    |     v
    |   _extract_token_from_update(event) --> ChatResponseChunk (SSE to client)
    |
    +-- on Exception:
          |
          v
        stream_failed = True
        graph.ainvoke(state) --> full response as single ChatResponseChunk
```

The `astream` path provides token-by-token streaming. If it fails (e.g. API
error from NVIDIA endpoints), the workflow falls back to `ainvoke` which returns
the complete response in one shot.

### Tool Call ID Normalization

Some models (Devstral) generate short tool_call IDs like `rdD5qZpBq`. NVIDIA
AI Endpoints rejects these. `_normalize_tool_call_ids()` runs in both
`agent_node` and `tool_node` to:

1. Prefix non-standard IDs with `call_`
2. Back-fill `additional_kwargs["tool_calls"]` for streaming responses (where
   the adapter otherwise omits tool_calls from the serialized message)

## Memory System

Three independent layers, all optional with graceful degradation:

```
Request arrives
    |
    v
  Auto-retrieval (first message only, 2s timeout)
    |  [suppressed when mode == "chat"]
    |-- episodic memory: RedisEditor vector search over past session summaries
    |-- findings store: Milvus semantic search over historical findings
    |
    v
  [Memory Context] block injected into system prompt
    |
    v
  Working memory (every turn)
    |-- Sliding window: trim_messages(max_history=8)
    |-- Summarize evicted messages via LLM before they leave the window
    |
    v
  Episodic persistence (end of session, fire-and-forget)
    |-- LLM generates session summary
    |-- Stored in Redis with vector embedding for future retrieval
```

| Layer | Store | TTL | Purpose |
|---|---|---|---|
| Working | In-memory (state) | Per-session | Keep recent context in the sliding window |
| Episodic | Redis (RedisEditor) | 90 days | Cross-session memory ("last time on this repo...") |
| Findings | Milvus (pymilvus) | Permanent | Historical analysis results per repo |

Configuration is resolved by `load_memory_config()` with precedence:
`src/cognitive_code_agent/configs/memory.yml` (dedicated) -> legacy `memory`
or `cognitive_memory` blocks in `config.yml` -> `MemoryConfig()` defaults.

## Skill Activation

Skills are markdown prompt modules selected at runtime:

```
User message
    |
    v
  select_skills(message, available_tools, registry)
    |  [suppressed when mode in {"chat", "analyze"}]
    |
    +-- For each enabled skill in registry.yml:
    |     1. Check required_tools are available in the current mode
    |     2. Score trigger keywords against the message (\b word boundary regex)
    |     3. Rank by (score DESC, priority ASC)
    |
    v
  Top N skills (max_active_skills=2) injected as <active_skills> system message
```

Skills have a two-layer structure:
- **Operational rules** — tool-backed directives for the agent's execution phases
- **Reference content** — checklists, patterns, deeper guidance

## MCP Integration

MCP function groups from the code-agent fork remain in `config.yml` as dormant
infrastructure. They are not active in the ops-agent because the code-agent tool
surface (`fs_tools`, `github_tools`, `context7_tools`) is not used by any active mode.

If MCP tools are added in a future change, they follow the code-agent pattern:
- Stdio transport (spawned as child processes via `npx`)
- Tool names prefixed with the group name: `fs_tools__read_text_file`
- Skill `required_tools` use suffix matching

## Monkey-Patches

`register.py` applies four patches at import time:

1. **MCP enum fix** — Forces `use_enum_values=True` on MCP-generated Pydantic
   models so enum fields serialize as strings, not Enum objects.

2. **NIM timeout extension** — Extends aiohttp client timeout from 300s to 900s
   for NIM LLM calls. Devstral with 32K output tokens can take several minutes.

3. **Cron lifespan bridge** — Integrates APScheduler startup/shutdown with NAT
   FastAPI app lifespan so persistent cron jobs are restored and cleanly stopped.
   Also registers `/api/jobs` endpoints and `/api/ops` endpoints at startup.

4. **Telegram route patch** — Registers the Telegram webhook endpoint
   (`/telegram/webhook`) on the FastAPI app and calls `bot.set_webhook` at
   startup if `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_URL` are set.

## File Map

```
src/cognitive_code_agent/
  register.py                  NAT plugin entry point + four monkey-patches
  ops_api.py                   FastAPI router: GET /api/ops/status, GET /api/ops/notes
  jobs_api.py                  FastAPI router: GET /api/jobs (cron job list)
  agents/
    safe_tool_calling_agent.py   Custom workflow: modes, skills, memory, streaming
  configs/
    config.yml                   LLMs, tools, MCP servers, modes, workflow
    memory.yml                   Dedicated L0/L1/L2 memory layer configuration
    config_eval.yml              RAGAS evaluation config
  routing/
    __init__.py                  Package init
    query_classifier.py          IntentClass enum (CHAT/UNKNOWN) + QueryClassifier.classify() static method
  memory/
    __init__.py                  Typed config dataclasses + memory config loader
    working.py                   Sliding window + eviction summarization
    episodic.py                  Cross-session Redis persistence
    retrieval.py                 Parallel pre-fetch at session start
    readiness.py                 Backend capability checks (Redis/Milvus)
    semantic.py                  L2 semantic memory extraction and retrieval
  prompts/
    composer.py                  Skill loader, trigger matching, analysis mode detection
    system/
      base.md                    Ops operator identity, tier policy, memory policy
      ops.md                     Primary ops mode prompt (tool guidance, output format, escalation)
      chat.md                    Lightweight chat mode prompt (ops identity, capability questions)
      analyze.md                 INACTIVE — code-agent only (see FORK_NOTES.md)
      execute.md                 INACTIVE — code-agent only (see FORK_NOTES.md)
    skills/
      registry.yml               Skill definitions (triggers, required_tools, priority)
      [code-agent skills]        Dormant — not triggered without code-agent tool surface
  telegram/
    __init__.py                  Package init
    bot.py                       Bot instance, webhook handler, concurrency guard
    routes.py                    register_telegram_routes(app, builder) — startup + endpoint
    session_bridge.py            Allowlist check (TELEGRAM_ALLOWED_CHAT_IDS) + session ID derivation
  tools/
    ops_tools.py                 Ops tools: list_containers, get_container_logs, inspect_container
    sqlite_tools.py              Structured memory: save_note, get_notes (SQLite, NOTES_DB_PATH)
    cron_tools.py                APScheduler cron scheduler (ops: namespace, DB 1)
    d03_client.py                Dormant HTTP client for future D03 REST API integration
    common.py                    Shared: sandbox enforcement, subprocess runner, redaction
    safety.py                    Deterministic shell command classifier (3 tiers)
    cache.py                     Redis-backed embedding/query cache
    findings_store.py            Milvus vector store with circuit breaker
    clone_tools.py               INACTIVE — code-agent only
    code_review_tools.py         INACTIVE — code-agent only
    docs_tools.py                INACTIVE — code-agent only
    qa_tools.py                  INACTIVE — code-agent only
    security_tools.py            INACTIVE — code-agent only
    shell_tools.py               INACTIVE — code-agent only
    refactor_gen.py              INACTIVE — code-agent only
    spawn_agent.py               INACTIVE — code-agent only
  data/
    qa_knowledge/                Seed knowledge files (dormant — qa_tools inactive)
```
