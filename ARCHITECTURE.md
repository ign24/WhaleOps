# Architecture Reference

> Internal reference for contributors. Documents what each dependency provides,
> how the layers compose, and where custom code overrides framework behavior.

## Dependency Chain

```
cognitive-code-agent (this project)
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
  +-- httpx                           Async HTTP
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
| `tools/cron_tools.py` | Agent-callable cron scheduler: APScheduler `AsyncIOScheduler` with `RedisJobStore` (namespace `cgn:apscheduler:*`). Exposes `schedule_task` tool (create / list / cancel). Scheduler lifecycle tied to NAT FastAPI lifespan via lifespan patch. |
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

One workflow, three pre-built graphs. Mode selection goes through two stages: a
Tier 0 intent classifier, then prefix-based resolution.

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
  resolve_mode()  -->  mode="execute", cleaned="fix alerts on repo"
        |
        v
  mode_runtimes[mode]  -->  ModeRuntime(graph, model_name, tool_names)
        |
        v
  Skill activation uses ORIGINAL message (with prefix) for trigger matching
  [suppressed when mode in {"chat", "analyze"}]
  LLM receives CLEANED message (without prefix) in the conversation
```

Each mode has its own:

| Mode | LLM | Tool groups | System Prompt | Max Iterations | Max History |
|---|---|---|---|---|---|
| `analyze` (default) | Devstral 2-123B | 6 (spawn orchestrator + fs/github/clone + findings tools) | `analyze.md` | 30 | 8 |
| `execute` | Devstral 2-123B | 16 (schedule/report/codegen/write fs/lint/tests/findings/shell/github/context7/web) | `execute.md` | 40 | 8 |
| `chat` | Kimi K2 (`kimi_reader`) | 2 (query_findings, fs_tools) | `chat.md` | 3 | 4 |

`/refactor` remains available as a compatibility alias and is mapped to `execute` during `resolve_mode()`.

Modes are defined in `config.yml` under `workflow.modes` and compiled into
separate `CompiledStateGraph` instances at startup.

### Operational budget tuning

Runtime guardrails are non-terminating: denied calls produce `ToolMessage` feedback and the loop continues.
Per-mode `max_tool_calls_per_request` enforces deterministic budgets and should be tuned from traces:

- `analyze`: `spawn_agent=4`, `clone_repository=2`, `persist_findings=1`
- `execute`: `shell_execute=8`, `persist_findings=1`
- `chat`: `query_findings=2`

When limits are hit, the agent should consolidate evidence and return structured partial output
(`Verified`, `Unverified`, `Blocked By`, `Next Steps`) instead of terminating the request.

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

### Filesystem Working Memory

The filesystem has two persistence tiers, independent of the in-memory layers above:

| Path | Tier | Retention | Usage |
|---|---|---|---|
| `/tmp/analysis` | Ephemeral sandbox | Lost on container restart | Temporary clones, scan artifacts, intermediate outputs during analysis runs |
| `/app/workspace` | Persistent working memory | Survives restarts | Full refactor lifecycle outputs, reports, packaged artifacts, repositories cloned for retention |

**Memory layer distinction:** Filesystem paths (`/tmp/analysis`, `/app/workspace`) are working memory — they hold the actual files being operated on. The findings store (Milvus) and episodic store (Redis) are separate memory layers for structured knowledge. They are complementary and do not replace each other.

When `clone_repository` is invoked, the `destination_root` parameter selects the tier:
- `destination_root="analysis"` (default) → `/tmp/analysis/<dest_name>` — ephemeral
- `destination_root="workspace"` → `/app/workspace/<dest_name>` — persistent

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

Four MCP servers configured as `function_groups` in `config.yml`. All use
**stdio transport** (spawned as child processes via `npx`).

NAT's `nvidia-nat-mcp` package manages the MCP lifecycle:

1. At startup, NAT spawns each MCP server as a subprocess
2. Tools are discovered via MCP's `tools/list` protocol
3. Tool names get prefixed with the group name: `fs_tools__read_text_file`
4. Skill `required_tools` use suffix matching: `write_file` matches `fs_tools_write__write_file`

| Group | Server | Allowed Paths | Timeout |
|---|---|---|---|
| `fs_tools` | `@modelcontextprotocol/server-filesystem` | `/tmp/analysis`, `/app/workspace` | 30s |
| `fs_tools_write` | `@modelcontextprotocol/server-filesystem` | `/tmp/analysis`, `/app/workspace` | 30s |
| `github_tools` | `@modelcontextprotocol/server-github` | GitHub REST API | 60s |
| `context7_tools` | `@upstash/context7-mcp` | Library documentation | 30s |

## Monkey-Patches

`register.py` applies three patches at import time:

1. **MCP enum fix** — Forces `use_enum_values=True` on MCP-generated Pydantic
   models so enum fields serialize as strings, not Enum objects.

2. **NIM timeout extension** — Extends aiohttp client timeout from 300s to 900s
   for NIM LLM calls. Devstral with 32K output tokens can take several minutes.

3. **Cron lifespan bridge** — Integrates scheduler startup/shutdown with NAT
   FastAPI app lifespan so persistent cron jobs are restored and cleanly stopped.

## File Map

```
src/cognitive_code_agent/
  register.py                  NAT plugin entry point + patches
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
      base.md                    Default system prompt (identity, policies, protocols)
      analyze.md                 Read-only analysis mode prompt
      execute.md                 Git operations mode prompt
      chat.md                    Lightweight chat mode prompt (greetings, capability questions)
      security_agent.md          Security specialist subagent prompt
      qa_agent.md                QA specialist subagent prompt
      review_agent.md            Code-review specialist subagent prompt
      docs_agent.md              Documentation specialist subagent prompt
    skills/
      registry.yml               Skill definitions (triggers, required_tools, priority)
      refactoring.md             Refactoring methodology and path policies
      security-review.md         Security audit checklist
      code-reviewer.md           Code review guidelines
      senior-qa.md               QA and test coverage
      technical-writer.md        Documentation audit
      debugger.md                Debugging methodology
      api-design.md              REST API design patterns
      email-marketing-bible.md   Email deliverability
  tools/
    common.py                    Shared: sandbox enforcement, subprocess runner, redaction
    safety.py                    Deterministic shell command classifier (3 tiers)
    cache.py                     Redis-backed embedding/query cache
    clone_tools.py               Secure GitHub clone with PAT
    code_review_tools.py         ruff, eslint, radon, git diff
    docs_tools.py                Docstring coverage, README audit, OpenAPI detection
    qa_tools.py                  pytest, jest, coverage, knowledge search
    security_tools.py            semgrep, trivy, gitleaks, bandit
    shell_tools.py               General shell execution with safety tiers
    refactor_gen.py              LLM-powered code refactoring (Devstral)
    findings_store.py            Milvus vector store with circuit breaker
  data/
    qa_knowledge/                Seed knowledge files for query_qa_knowledge
```
