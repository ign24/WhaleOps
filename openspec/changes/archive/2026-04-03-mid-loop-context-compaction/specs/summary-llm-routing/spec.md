## ADDED Requirements

### Requirement: Summary LLM is configured independently from the reasoning LLM
The system SHALL support a dedicated `summary_llm_name` field in `WorkingMemoryConfig` that, when set, uses a different LLM for all summarization operations (both between-request compaction and mid-loop compaction) than the mode's primary reasoning LLM.

#### Scenario: kimi_reader used for summaries when configured
- **WHEN** `memory.yml` sets `working.summary_llm_name: kimi_reader`
- **THEN** all `summarize_evicted_messages()` and `compress_state()` calls use the kimi_reader LLM instance, not devstral

#### Scenario: Falls back to reasoning LLM when summary_llm_name is absent
- **WHEN** `memory.yml` does not set `working.summary_llm_name`
- **THEN** summarization uses the mode's reasoning LLM, preserving existing behavior

### Requirement: Summary LLM is resolved at workflow startup
The system SHALL resolve the `summary_llm_name` to an LLM instance during `safe_tool_calling_agent_workflow` startup (same phase as mode runtimes are built) and pass it to `SafeToolCallAgentGraph` at construction time.

#### Scenario: Summary LLM resolved once at startup
- **WHEN** the workflow starts and `summary_llm_name` is configured
- **THEN** the LLM is fetched via `builder.get_llm()` once and reused across all requests, not re-fetched per request

#### Scenario: Summary LLM resolution failure is non-fatal
- **WHEN** `builder.get_llm(summary_llm_name)` raises an exception at startup
- **THEN** a warning is logged, `summary_llm` defaults to `None`, and compaction is disabled for the session
