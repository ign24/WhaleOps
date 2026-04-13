## ADDED Requirements

### Requirement: SafeToolCallAgentGraph compiles with checkpointer
`SafeToolCallAgentGraph` SHALL override `_build_graph()` to pass a checkpointer to `graph.compile()`, enabling LangGraph `interrupt()`/`Command(resume=...)` flow.

#### Scenario: Graph compiles with MemorySaver checkpointer
- **WHEN** `_build_mode_runtime` creates a `SafeToolCallAgentGraph` with `hitl_enabled: true`
- **THEN** the graph is compiled with a `MemorySaver` checkpointer and supports `interrupt()` calls within tool functions

#### Scenario: Graph compiles without checkpointer when HITL disabled
- **WHEN** `_build_mode_runtime` creates a `SafeToolCallAgentGraph` with `hitl_enabled: false`
- **THEN** the graph is compiled without a checkpointer (same as current behavior) and `interrupt()` is not available

### Requirement: Thread ID flows through invocation config
Every graph invocation SHALL include a unique `thread_id` in the LangGraph config to scope checkpointer state.

#### Scenario: Per-request thread ID generation
- **WHEN** a new `/execute` request arrives
- **THEN** a UUID is generated and passed as `{"configurable": {"thread_id": uuid}}` to `graph.astream()` and `graph.ainvoke()`

#### Scenario: Resume uses same thread ID
- **WHEN** an interrupt is resumed via `Command(resume=...)`
- **THEN** the same `thread_id` from the original request is used, allowing the checkpointer to restore paused state

### Requirement: Checkpointer backend is configurable
The checkpointer backend SHALL be configurable via `config.yml` field `checkpointer_backend`.

#### Scenario: Memory backend (default)
- **WHEN** `checkpointer_backend` is `memory` or not specified
- **THEN** `MemorySaver` is used (in-process, no persistence across restarts)

#### Scenario: SQLite backend
- **WHEN** `checkpointer_backend` is `sqlite`
- **THEN** `SqliteSaver` is used with a configurable file path for state persistence
