## 1. Memory Configuration Layer

- [x] 1.1 Add `memory` section to `config.yml` with working, episodic, and auto_retrieval subsections (semantic deferred to phase 2)
- [x] 1.2 Create `src/cognitive_code_agent/memory/__init__.py` module with config dataclass `MemoryConfig` that parses the YAML memory section
- [x] 1.3 Write unit tests for `MemoryConfig` parsing: defaults, partial overrides, disabled flags

## 2. Working Memory Summarization

- [x] 2.1 Create `src/cognitive_code_agent/memory/working.py` with `summarize_evicted_messages()` function that takes evicted messages and returns a summary string via LLM call
- [x] 2.2 Write unit tests for `summarize_evicted_messages`: normal summarization, LLM failure graceful degradation, empty input returns empty string
- [x] 2.3 Modify `safe_tool_calling_agent.py`: before `trim_messages`, detect if messages will be evicted, call summarization, insert `[Context Summary]` message
- [x] 2.4 Handle cascading summaries: if a `[Context Summary]` message already exists, include it in the next summarization input and replace (not duplicate)
- [x] 2.5 Write integration test: simulate a 25-iteration chain, verify summary message is present and evicted context is captured in it

## 3. Episodic Memory (Redis-backed)

- [x] 3.1 Create `src/cognitive_code_agent/memory/episodic.py` with `EpisodicMemoryManager` class wrapping NAT's `RedisEditor` for persist and search operations
- [x] 3.2 Implement `persist_session_summary()`: generate summary from conversation messages via LLM, embed it, store as `MemoryItem` with structured metadata (session_id, repo_id, outcome, tools_used, findings_count)
- [x] 3.3 Implement `search_relevant_sessions()`: vector similarity search with tag filtering, returns top N results respecting `max_sessions_retrieved`
- [x] 3.4 Write unit tests with mocked RedisEditor: persist creates correct MemoryItem structure, search returns filtered results, Redis-unavailable degrades gracefully
- [x] 3.5 Wire session end hook in `safe_tool_calling_agent.py`: after the final LLM response, call `persist_session_summary()` as fire-and-forget async task
- [x] 3.6 Write integration test: persist a session summary, search it back, verify metadata fields and similarity search works (completed in deployed environment)

## 4. Automatic Memory Retrieval

- [x] 4.1 Create `src/cognitive_code_agent/memory/retrieval.py` with `AutoMemoryRetriever` class that orchestrates parallel queries across episodic memory and existing findings
- [x] 4.2 Implement `retrieve_context()`: takes first user message, runs parallel queries (episodic + qa_findings) with `asyncio.gather` and per-source timeout, applies similarity threshold (0.5)
- [x] 4.3 Implement `compose_memory_block()`: formats retrieved results into the `[Memory Context]` structured block as specified in the auto-retrieval spec
- [x] 4.4 Write unit tests: parallel timeout behavior (one source slow, others fast), similarity filtering, empty results produce no block, disabled sources are skipped
- [x] 4.5 Wire into `safe_tool_calling_agent.py`: detect first message in session, call `retrieve_context()`, inject memory block as system message after base prompt
- [x] 4.6 Write integration test: seed episodic + findings data, start new session, verify memory block is injected with correct sections (completed in deployed environment)

## 5. Prompt and Documentation Updates

- [x] 5.1 Update `base.md` system prompt: revise `<memory_policy>` section to reference auto-injected memory context, explain when the agent should use `persist_findings` vs when memories are captured automatically
- [x] 5.2 Update `EASYPANEL_SETUP.md`: add memory configuration section, document the `memory` config block
- [x] 5.3 Update `config.yml` comments to explain each memory subsection

## 6. Final Verification

- [x] 6.1 Run full test suite: `uv run pytest tests/unit tests/integration -v` -- all tests pass (198 passed, 1 skipped)
- [x] 6.2 Run linter: `uv run ruff check . && uv run ruff format --check .` -- all new files clean
- [x] 6.3 Manual smoke test on EasyPanel: verify persist, query, auto-retrieval, and session summary work end-to-end (completed)
