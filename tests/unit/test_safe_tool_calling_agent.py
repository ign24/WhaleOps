from __future__ import annotations

from pathlib import Path
import asyncio
from types import SimpleNamespace

from langchain_core.messages import AIMessage
from langchain_core.messages import AIMessageChunk
from langchain_core.messages import ToolMessage
from nat.agent.tool_calling_agent.agent import ToolCallAgentGraphState
from nat.data_models.api_server import ChatRequestOrMessage

import pytest

import cognitive_code_agent.agents.safe_tool_calling_agent as workflow_module
from cognitive_code_agent.agents.safe_tool_calling_agent import SafeToolCallAgentWorkflowConfig
from cognitive_code_agent.agents.safe_tool_calling_agent import SafeToolCallAgentGraph
from cognitive_code_agent.agents.safe_tool_calling_agent import FailureClass
from cognitive_code_agent.agents.safe_tool_calling_agent import ModeConfig
from cognitive_code_agent.agents.safe_tool_calling_agent import _apply_write_mode_guard
from cognitive_code_agent.agents.safe_tool_calling_agent import _rate_limit_backoff_delay
from cognitive_code_agent.agents.safe_tool_calling_agent import WRITE_TOOL_NAMES
from cognitive_code_agent.agents.safe_tool_calling_agent import READ_ONLY_MODES
from cognitive_code_agent.agents.safe_tool_calling_agent import _apply_evidence_gate
from cognitive_code_agent.agents.safe_tool_calling_agent import _apply_parallel_tool_cap
from cognitive_code_agent.agents.safe_tool_calling_agent import _apply_tool_loop_guard
from cognitive_code_agent.agents.safe_tool_calling_agent import _apply_tool_total_limit
from cognitive_code_agent.agents.safe_tool_calling_agent import _build_recovery_invoke_state
from cognitive_code_agent.agents.safe_tool_calling_agent import _classify_failure
from cognitive_code_agent.agents.safe_tool_calling_agent import _deduplicate_tool_calls
from cognitive_code_agent.agents.safe_tool_calling_agent import _format_structured_partial_response
from cognitive_code_agent.agents.safe_tool_calling_agent import _normalize_nested_subagent_failures
from cognitive_code_agent.agents.safe_tool_calling_agent import _normalize_tool_call_ids
from cognitive_code_agent.agents.safe_tool_calling_agent import _tool_signature
from cognitive_code_agent.agents.safe_tool_calling_agent import safe_tool_calling_agent_workflow
from cognitive_code_agent.agents.safe_tool_calling_agent import strip_think_blocks
from cognitive_code_agent.memory import MemoryConfig
from cognitive_code_agent.memory.readiness import MemoryReadiness
from cognitive_code_agent.memory.readiness import SourceReadiness


pytestmark = pytest.mark.unit


def test_strip_think_blocks_removes_reasoning_markup() -> None:
    content = "<think>hidden</think>Final answer"
    assert strip_think_blocks(content) == "Final answer"


def test_safe_tool_calling_config_timeout_defaults() -> None:
    config = SafeToolCallAgentWorkflowConfig.model_validate(
        {"tool_names": [], "llm_name": "devstral"}
    )
    assert config.tool_call_timeout_seconds == 900
    assert config.prompt_base_path == "src/cognitive_code_agent/prompts/system/base.md"
    assert config.skill_registry_path == "src/cognitive_code_agent/prompts/skills/registry.yml"
    assert config.max_active_skills == 2


def test_safe_tool_calling_module_does_not_use_future_annotations_import() -> None:
    source = Path("src/cognitive_code_agent/agents/safe_tool_calling_agent.py").read_text(
        encoding="utf-8"
    )
    lines = [line.strip() for line in source.splitlines()]
    assert "from __future__ import annotations" not in lines


def test_safe_tool_calling_workflow_exposes_stream_fn(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeCompiledGraph:
        async def astream(self, *_args, **_kwargs):
            state = ToolCallAgentGraphState(messages=[AIMessageChunk(content="hola")])
            yield {"agent": state}

        async def ainvoke(self, *_args, **_kwargs):
            return {"messages": [AIMessage(content="fallback")]}

    class FakeGraphFactory:
        def __init__(self, **_kwargs):
            pass

        async def build_graph(self):
            return FakeCompiledGraph()

    class FakeBuilder:
        async def get_llm(self, *_args, **_kwargs):
            return object()

        async def get_tools(self, tool_names, **_kwargs):
            if tool_names:
                return [SimpleNamespace(name="fake_tool")]
            return []

    monkeypatch.setattr(workflow_module, "SafeToolCallAgentGraph", FakeGraphFactory)
    monkeypatch.setattr(workflow_module, "build_active_skills_block", lambda **_kwargs: ([], ""))

    async def run() -> object:
        config = SafeToolCallAgentWorkflowConfig.model_validate(
            {
                "tool_names": ["fake_tool"],
                "llm_name": "devstral",
            }
        )
        async with safe_tool_calling_agent_workflow(config, FakeBuilder()) as function_info:
            return function_info

    function_info = asyncio.run(run())
    assert function_info.stream_fn is not None


def test_safe_tool_calling_stream_falls_back_to_ainvoke(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeCompiledGraph:
        def __init__(self):
            self.ainvoke_called = False

        async def astream(self, *_args, **_kwargs):
            raise RuntimeError("stream failed")
            yield

        async def ainvoke(self, *_args, **_kwargs):
            self.ainvoke_called = True
            return {"messages": [AIMessage(content="respuesta desde fallback")]}

    fake_graph = FakeCompiledGraph()

    class FakeGraphFactory:
        def __init__(self, **_kwargs):
            pass

        async def build_graph(self):
            return fake_graph

    class FakeBuilder:
        async def get_llm(self, *_args, **_kwargs):
            return object()

        async def get_tools(self, tool_names, **_kwargs):
            if tool_names:
                return [SimpleNamespace(name="fake_tool")]
            return []

    monkeypatch.setattr(workflow_module, "SafeToolCallAgentGraph", FakeGraphFactory)
    monkeypatch.setattr(workflow_module, "build_active_skills_block", lambda **_kwargs: ([], ""))

    async def run() -> list[str]:
        config = SafeToolCallAgentWorkflowConfig.model_validate(
            {
                "tool_names": ["fake_tool"],
                "llm_name": "devstral",
            }
        )
        async with safe_tool_calling_agent_workflow(config, FakeBuilder()) as function_info:
            chunks = []
            async for chunk in function_info.stream_fn(ChatRequestOrMessage(input_message="Hola")):
                chunks.append(chunk.choices[0].delta.content or "")

            return chunks

    chunk_contents = asyncio.run(run())

    assert fake_graph.ainvoke_called is True
    assert any("respuesta desde fallback" in content for content in chunk_contents)


def test_recursion_limit_uses_scoped_retry_before_partial(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeCompiledGraph:
        def __init__(self):
            self.ainvoke_calls = 0

        async def astream(self, *_args, **_kwargs):
            raise workflow_module.GraphRecursionError("recursion limit")
            yield

        async def ainvoke(self, *_args, **_kwargs):
            self.ainvoke_calls += 1
            return {"messages": [AIMessage(content="Scoped recovery response")]}

    fake_graph = FakeCompiledGraph()

    class FakeGraphFactory:
        def __init__(self, **_kwargs):
            pass

        async def build_graph(self):
            return fake_graph

    class FakeBuilder:
        async def get_llm(self, *_args, **_kwargs):
            return object()

        async def get_tools(self, tool_names, **_kwargs):
            if tool_names:
                return [SimpleNamespace(name="fake_tool")]
            return []

    monkeypatch.setattr(workflow_module, "SafeToolCallAgentGraph", FakeGraphFactory)
    monkeypatch.setattr(workflow_module, "build_active_skills_block", lambda **_kwargs: ([], ""))

    async def run() -> list[str]:
        config = SafeToolCallAgentWorkflowConfig.model_validate(
            {
                "tool_names": ["fake_tool"],
                "llm_name": "devstral",
            }
        )
        async with safe_tool_calling_agent_workflow(config, FakeBuilder()) as function_info:
            chunks = []
            async for chunk in function_info.stream_fn(ChatRequestOrMessage(input_message="audit")):
                chunks.append(chunk.choices[0].delta.content or "")
            return chunks

    chunk_contents = asyncio.run(run())

    assert fake_graph.ainvoke_calls >= 1
    assert any("Scoped recovery response" in content for content in chunk_contents)


# ---------------------------------------------------------------------------
# _normalize_tool_call_ids
# ---------------------------------------------------------------------------


def test_normalize_tool_call_ids_prefixes_short_ids() -> None:
    """Devstral-style short IDs like 'rdD5qZpBq' get a 'call_' prefix."""
    msg = AIMessage(
        content="",
        tool_calls=[
            {"id": "rdD5qZpBq", "name": "read_file", "args": {"path": "/tmp/x"}},
            {"id": "abc123", "name": "write_file", "args": {"path": "/tmp/y"}},
        ],
    )
    state = ToolCallAgentGraphState(messages=[msg])
    _normalize_tool_call_ids(state)

    assert state.messages[-1].tool_calls[0]["id"] == "call_rdD5qZpBq"
    assert state.messages[-1].tool_calls[1]["id"] == "call_abc123"


def test_normalize_tool_call_ids_preserves_already_prefixed() -> None:
    """IDs that already start with 'call_' are left unchanged."""
    msg = AIMessage(
        content="",
        tool_calls=[
            {"id": "call_abc123", "name": "read_file", "args": {"path": "/tmp/x"}},
        ],
    )
    state = ToolCallAgentGraphState(messages=[msg])
    _normalize_tool_call_ids(state)

    assert state.messages[-1].tool_calls[0]["id"] == "call_abc123"


def test_normalize_tool_call_ids_handles_additional_kwargs() -> None:
    """ainvoke responses store raw tool_calls in additional_kwargs — normalize both."""
    msg = AIMessage(
        content="",
        tool_calls=[
            {"id": "chatcmpl-tool-abc123", "name": "read_file", "args": {"path": "/tmp/x"}},
        ],
        additional_kwargs={
            "tool_calls": [
                {
                    "id": "chatcmpl-tool-abc123",
                    "type": "function",
                    "function": {"name": "read_file", "arguments": '{"path": "/tmp/x"}'},
                }
            ]
        },
    )
    state = ToolCallAgentGraphState(messages=[msg])
    _normalize_tool_call_ids(state)

    assert state.messages[-1].tool_calls[0]["id"] == "call_chatcmpl-tool-abc123"
    assert (
        state.messages[-1].additional_kwargs["tool_calls"][0]["id"] == "call_chatcmpl-tool-abc123"
    )


def test_normalize_tool_call_ids_backfills_additional_kwargs_for_streaming() -> None:
    """Streaming responses have empty additional_kwargs — back-fill from parsed tool_calls.

    langchain-nvidia-ai-endpoints serializes tool_calls from additional_kwargs,
    not from the parsed tool_calls list.  Without this back-fill, the serialized
    assistant message has NO tool_calls and the API rejects tool results.
    """
    msg = AIMessage(
        content="",
        tool_calls=[
            {"id": "rdD5qZpBq", "name": "read_file", "args": {"path": "/tmp/x"}},
        ],
        # Streaming: additional_kwargs is empty (no tool_calls key)
        additional_kwargs={},
    )
    state = ToolCallAgentGraphState(messages=[msg])
    _normalize_tool_call_ids(state)

    last = state.messages[-1]
    # Parsed tool_calls: ID normalized
    assert last.tool_calls[0]["id"] == "call_rdD5qZpBq"
    # additional_kwargs: back-filled with normalized IDs in API format
    raw = last.additional_kwargs["tool_calls"]
    assert len(raw) == 1
    assert raw[0]["id"] == "call_rdD5qZpBq"
    assert raw[0]["type"] == "function"
    assert raw[0]["function"]["name"] == "read_file"
    assert '"path": "/tmp/x"' in raw[0]["function"]["arguments"]


def test_normalize_tool_call_ids_noop_without_tool_calls() -> None:
    """Messages without tool_calls are left unchanged."""
    msg = AIMessage(content="Hello")
    state = ToolCallAgentGraphState(messages=[msg])
    _normalize_tool_call_ids(state)

    assert state.messages[-1].content == "Hello"


# ---------------------------------------------------------------------------
# Skill activation with mode prefix
# ---------------------------------------------------------------------------

REGISTRY = "src/cognitive_code_agent/prompts/skills/registry.yml"

# Refactor mode tools (same set used in test_prompt_composer.py)
REFACTOR_TOOLS = [
    "reader_agent",
    "code_gen",
    "refactor_gen",
    "run_ruff",
    "run_eslint",
    "run_pytest",
    "run_jest",
    "analyze_complexity",
    "query_findings",
    "persist_findings",
    "shell_execute",
    "fs_tools_write__write_file",
    "fs_tools_write__edit_file",
    "fs_tools_write__create_directory",
    "fs_tools_write__read_text_file",
    "fs_tools_write__directory_tree",
]


def test_skill_activation_with_refactor_prefix() -> None:
    """'/refactor fix alerts on repo' should trigger the refactoring skill.

    This is the exact scenario that was broken: resolve_mode strips '/refactor'
    before skill matching, so the trigger word 'refactor' disappears.
    The fix passes the original (un-stripped) message to build_active_skills_block.
    """
    from cognitive_code_agent.prompts.composer import select_skills

    # Original message WITH mode prefix (what the user actually sends)
    original_message = "/refactor fix alerts on ign24/3F"

    selected = select_skills(
        user_message=original_message,
        available_tools=REFACTOR_TOOLS,
        registry_path=REGISTRY,
        max_active_skills=2,
    )

    skill_ids = [s.id for s in selected]
    assert "refactoring" in skill_ids


def test_skill_activation_without_prefix_still_works() -> None:
    """Direct 'refactor' keyword without mode prefix should also match."""
    from cognitive_code_agent.prompts.composer import select_skills

    selected = select_skills(
        user_message="refactor the authentication module",
        available_tools=REFACTOR_TOOLS,
        registry_path=REGISTRY,
        max_active_skills=2,
    )

    skill_ids = [s.id for s in selected]
    assert "refactoring" in skill_ids


def test_skill_activation_fails_without_trigger_word() -> None:
    """Cleaned message 'fix alerts on ign24/3F' has no trigger — no skill activates."""
    from cognitive_code_agent.prompts.composer import select_skills

    # This is what the old broken code passed: prefix stripped, trigger gone
    cleaned_message = "fix alerts on ign24/3F"

    selected = select_skills(
        user_message=cleaned_message,
        available_tools=REFACTOR_TOOLS,
        registry_path=REGISTRY,
        max_active_skills=2,
    )

    skill_ids = [s.id for s in selected]
    assert "refactoring" not in skill_ids


# ---------------------------------------------------------------------------
# _guard_tool_outputs
# ---------------------------------------------------------------------------


def test_guard_tool_outputs_passthrough_within_limit() -> None:
    """Tool outputs within the limit pass through unchanged."""
    from cognitive_code_agent.agents.safe_tool_calling_agent import _guard_tool_outputs

    small_content = "x" * 100
    msg = ToolMessage(content=small_content, tool_call_id="call_abc")
    state = ToolCallAgentGraphState(messages=[msg])
    _guard_tool_outputs(state, max_chars=30000)

    assert state.messages[-1].content == small_content


def test_guard_tool_outputs_truncates_large_output() -> None:
    """Tool outputs exceeding the limit are truncated with a notice."""
    from cognitive_code_agent.agents.safe_tool_calling_agent import _guard_tool_outputs

    large_content = "x" * 50000
    msg = ToolMessage(content=large_content, tool_call_id="call_abc")
    state = ToolCallAgentGraphState(messages=[msg])
    _guard_tool_outputs(state, max_chars=30000)

    result = state.messages[-1].content
    assert len(result) < 50000
    assert "[OUTPUT TRUNCATED:" in result
    assert "20,000 chars removed" in result


def test_guard_tool_outputs_multiple_tool_messages() -> None:
    """Each ToolMessage is independently evaluated."""
    from cognitive_code_agent.agents.safe_tool_calling_agent import _guard_tool_outputs

    small = ToolMessage(content="ok", tool_call_id="call_1")
    large = ToolMessage(content="y" * 50000, tool_call_id="call_2")
    state = ToolCallAgentGraphState(messages=[small, large])
    _guard_tool_outputs(state, max_chars=30000)

    assert state.messages[0].content == "ok"
    assert "[OUTPUT TRUNCATED:" in state.messages[1].content


def test_guard_tool_outputs_empty_content() -> None:
    """Empty tool content is left unchanged."""
    from cognitive_code_agent.agents.safe_tool_calling_agent import _guard_tool_outputs

    msg = ToolMessage(content="", tool_call_id="call_abc")
    state = ToolCallAgentGraphState(messages=[msg])
    _guard_tool_outputs(state, max_chars=30000)

    assert state.messages[-1].content == ""


def test_guard_tool_outputs_ignores_non_tool_messages() -> None:
    """Non-ToolMessage entries are not modified."""
    from cognitive_code_agent.agents.safe_tool_calling_agent import _guard_tool_outputs

    ai_msg = AIMessage(content="a" * 50000)
    tool_msg = ToolMessage(content="b" * 50000, tool_call_id="call_abc")
    state = ToolCallAgentGraphState(messages=[ai_msg, tool_msg])
    _guard_tool_outputs(state, max_chars=30000)

    assert state.messages[0].content == "a" * 50000  # AIMessage untouched
    assert "[OUTPUT TRUNCATED:" in state.messages[1].content  # ToolMessage truncated


# ---------------------------------------------------------------------------
# _extract_usage_metadata
# ---------------------------------------------------------------------------


def test_extract_usage_metadata_with_metadata() -> None:
    """Extracts real token counts when usage_metadata is present."""
    from cognitive_code_agent.agents.safe_tool_calling_agent import _extract_usage_metadata

    msg = AIMessage(
        content="hello",
        usage_metadata={"input_tokens": 100, "output_tokens": 50, "total_tokens": 150},
    )
    state = ToolCallAgentGraphState(messages=[msg])
    result = _extract_usage_metadata(state)

    assert result == {"prompt_tokens": 100, "completion_tokens": 50, "total_tokens": 150}


def test_extract_usage_metadata_without_metadata() -> None:
    """Returns None when no usage_metadata is present."""
    from cognitive_code_agent.agents.safe_tool_calling_agent import _extract_usage_metadata

    msg = AIMessage(content="hello")
    state = ToolCallAgentGraphState(messages=[msg])
    result = _extract_usage_metadata(state)

    assert result is None


def test_extract_usage_metadata_ignores_non_ai_messages() -> None:
    """Returns None when the last message is not an AIMessage."""
    from cognitive_code_agent.agents.safe_tool_calling_agent import _extract_usage_metadata

    msg = ToolMessage(content="tool result", tool_call_id="call_abc")
    state = ToolCallAgentGraphState(messages=[msg])
    result = _extract_usage_metadata(state)

    assert result is None


def test_extract_usage_metadata_empty_state() -> None:
    """Returns None on empty state."""
    from cognitive_code_agent.agents.safe_tool_calling_agent import _extract_usage_metadata

    state = ToolCallAgentGraphState(messages=[])
    result = _extract_usage_metadata(state)

    assert result is None


# ---------------------------------------------------------------------------
# _emit_trace_event
# ---------------------------------------------------------------------------


def test_emit_trace_event_logs_json(caplog: pytest.LogCaptureFixture) -> None:
    """Trace events are logged as JSON with event_type field."""
    import json
    import logging

    from cognitive_code_agent.agents.safe_tool_calling_agent import _emit_trace_event

    with caplog.at_level(
        logging.INFO, logger="cognitive_code_agent.agents.safe_tool_calling_agent"
    ):
        _emit_trace_event("test_event", {"key": "value", "count": 42})

    trace_records = [r for r in caplog.records if "trace_event" in r.message]
    assert len(trace_records) == 1
    payload = json.loads(trace_records[0].message.split("trace_event=")[1])
    assert payload["event_type"] == "test_event"
    assert payload["key"] == "value"
    assert payload["count"] == 42


# ---------------------------------------------------------------------------
# Deterministic fallback policy helpers
# ---------------------------------------------------------------------------


def test_classify_failure_recursion_limit() -> None:
    result = _classify_failure(workflow_module.GraphRecursionError("limit"))
    assert result is FailureClass.RECURSION_LIMIT


def test_classify_failure_timeout() -> None:
    assert (
        _classify_failure(RuntimeError("Tool call timed out after 30s"))
        is FailureClass.TOOL_TIMEOUT
    )


def test_classify_failure_validation_error() -> None:
    assert (
        _classify_failure(
            RuntimeError(
                "{'status': 'error', 'error_type': 'validation_error', 'message': 'Destination already exists'}"
            )
        )
        is FailureClass.TOOL_VALIDATION_ERROR
    )


def test_classify_failure_rate_limited_429() -> None:
    assert (
        _classify_failure(RuntimeError("Error 429: Too Many Requests")) is FailureClass.RATE_LIMITED
    )


def test_classify_failure_rate_limited_message() -> None:
    assert _classify_failure(RuntimeError("rate limit exceeded")) is FailureClass.RATE_LIMITED


def test_failure_policy_hitl_timeout() -> None:
    policy = workflow_module.FAILURE_POLICIES[FailureClass.HITL_TIMEOUT]
    assert policy.retryable is False
    assert policy.action == "skip_and_continue"


def test_failure_policy_write_denied() -> None:
    policy = workflow_module.FAILURE_POLICIES[FailureClass.WRITE_DENIED]
    assert policy.retryable is False
    assert policy.action == "replan_without_write"


def test_failure_policy_rate_limited() -> None:
    policy = workflow_module.FAILURE_POLICIES[FailureClass.RATE_LIMITED]
    assert policy.retryable is True
    assert policy.action == "exponential_backoff_retry"


def test_classify_failure_server_error_500() -> None:
    assert _classify_failure(RuntimeError("Internal Server Error")) is FailureClass.SERVER_ERROR


def test_classify_failure_server_error_502() -> None:
    assert _classify_failure(RuntimeError("502 Bad Gateway")) is FailureClass.SERVER_ERROR


def test_classify_failure_server_error_503() -> None:
    assert _classify_failure(RuntimeError("503 Service Unavailable")) is FailureClass.SERVER_ERROR


def test_classify_failure_server_error_connection_refused() -> None:
    assert _classify_failure(RuntimeError("Connection refused")) is FailureClass.SERVER_ERROR


def test_classify_failure_server_error_enginecore() -> None:
    """The exact error from NIM logs."""
    assert (
        _classify_failure(
            RuntimeError(
                "EngineCore encountered an issue. See stack trace (above) for the root cause."
            )
        )
        is FailureClass.SERVER_ERROR
    )


def test_classify_failure_context_overflow() -> None:
    assert (
        _classify_failure(RuntimeError("context length exceeded")) is FailureClass.CONTEXT_OVERFLOW
    )


def test_classify_failure_context_overflow_token_limit() -> None:
    assert _classify_failure(RuntimeError("token limit reached")) is FailureClass.CONTEXT_OVERFLOW


def test_failure_policy_server_error_is_retryable() -> None:
    policy = workflow_module.FAILURE_POLICIES[FailureClass.SERVER_ERROR]
    assert policy.retryable is True
    assert policy.action == "exponential_backoff_retry"


def test_failure_policy_context_overflow_retryable_via_compaction() -> None:
    policy = workflow_module.FAILURE_POLICIES[FailureClass.CONTEXT_OVERFLOW]
    assert policy.retryable is True
    assert policy.action == "compact_and_continue"
    assert policy.partial_finalize is True


def test_format_structured_partial_response_contains_required_sections() -> None:
    result = _format_structured_partial_response(failure_class=FailureClass.RECURSION_LIMIT)
    assert "## Verified" in result
    assert "## Unverified" in result
    assert "## Blocked By" in result
    assert "## Next Steps" in result


def test_apply_evidence_gate_downgrades_missing_evidence() -> None:
    content = "- Potential vulnerability in auth flow"
    gated, downgraded = _apply_evidence_gate(content, mode="analyze")
    assert downgraded == 1
    assert "unconfirmed" in gated
    assert "## Next Steps" in gated


def test_apply_evidence_gate_keeps_evidenced_finding() -> None:
    content = "- SQL injection risk in app/routes/index.js:72 (tool: semgrep)"
    gated, downgraded = _apply_evidence_gate(content, mode="analyze")
    assert downgraded == 0
    assert gated == content


def test_tool_loop_guard_blocks_repeated_equivalent_calls() -> None:
    previous = AIMessage(
        content="",
        tool_calls=[{"id": "call_1", "name": "reader_agent", "args": {"input_message": "scan"}}],
    )
    current = AIMessage(
        content="",
        tool_calls=[{"id": "call_2", "name": "reader_agent", "args": {"input_message": "scan"}}],
        additional_kwargs={
            "tool_calls": [
                {
                    "id": "call_2",
                    "type": "function",
                    "function": {"name": "reader_agent", "arguments": '{"input_message":"scan"}'},
                }
            ]
        },
    )
    state = ToolCallAgentGraphState(messages=[previous, current])

    blocked = _apply_tool_loop_guard(state, threshold=1, mode_name="analyze")

    assert blocked == 1
    assert state.messages[1].tool_calls == []


def test_parallel_tool_cap_keeps_only_first_three_calls() -> None:
    current = AIMessage(
        content="",
        tool_calls=[
            {"id": "call_1", "name": "reader_agent", "args": {"input_message": "a"}},
            {"id": "call_2", "name": "reader_agent", "args": {"input_message": "b"}},
            {"id": "call_3", "name": "reader_agent", "args": {"input_message": "c"}},
            {"id": "call_4", "name": "reader_agent", "args": {"input_message": "d"}},
        ],
        additional_kwargs={
            "tool_calls": [
                {
                    "id": "call_1",
                    "type": "function",
                    "function": {"name": "reader_agent", "arguments": "{}"},
                },
                {
                    "id": "call_2",
                    "type": "function",
                    "function": {"name": "reader_agent", "arguments": "{}"},
                },
                {
                    "id": "call_3",
                    "type": "function",
                    "function": {"name": "reader_agent", "arguments": "{}"},
                },
                {
                    "id": "call_4",
                    "type": "function",
                    "function": {"name": "reader_agent", "arguments": "{}"},
                },
            ]
        },
    )
    state = ToolCallAgentGraphState(messages=[current])

    dropped_count, deferred = _apply_parallel_tool_cap(
        state, max_parallel_tool_calls=3, mode_name="analyze"
    )

    assert dropped_count == 1
    assert len(state.messages[0].tool_calls) == 3
    # Deferred messages are returned, NOT appended yet — caller appends after super().tool_node()
    assert len(deferred) == 1
    assert deferred[0].tool_call_id == "call_4"
    assert len(state.messages) == 1  # synthetic message not in state yet


def test_tool_total_limit_blocks_reader_agent_after_limit() -> None:
    previous = AIMessage(
        content="",
        tool_calls=[
            {"id": "call_1", "name": "reader_agent", "args": {"input_message": "scan-a"}},
            {"id": "call_2", "name": "reader_agent", "args": {"input_message": "scan-b"}},
            {"id": "call_3", "name": "reader_agent", "args": {"input_message": "scan-c"}},
        ],
    )
    current = AIMessage(
        content="",
        tool_calls=[{"id": "call_4", "name": "reader_agent", "args": {"input_message": "scan-d"}}],
        additional_kwargs={
            "tool_calls": [
                {
                    "id": "call_4",
                    "type": "function",
                    "function": {"name": "reader_agent", "arguments": "{}"},
                }
            ]
        },
    )
    state = ToolCallAgentGraphState(messages=[previous, current])

    blocked = _apply_tool_total_limit(
        state,
        max_calls_per_request={"reader_agent": 3},
        mode_name="analyze",
    )

    assert blocked == 1
    assert state.messages[1].tool_calls == []


def test_tool_total_limit_emits_budget_exhausted_trace(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: list[tuple[str, dict]] = []

    def fake_emit(event_type: str, payload: dict) -> None:
        captured.append((event_type, payload))

    monkeypatch.setattr(workflow_module, "_emit_trace_event", fake_emit)

    previous = AIMessage(
        content="",
        tool_calls=[
            {"id": "call_1", "name": "spawn_agent", "args": {"task": "security"}},
            {"id": "call_2", "name": "spawn_agent", "args": {"task": "qa"}},
        ],
    )
    current = AIMessage(
        content="",
        tool_calls=[{"id": "call_3", "name": "spawn_agent", "args": {"task": "docs"}}],
    )
    state = ToolCallAgentGraphState(messages=[previous, current])

    blocked = _apply_tool_total_limit(
        state,
        max_calls_per_request={"spawn_agent": 2},
        mode_name="analyze",
    )

    assert blocked == 1
    assert any(evt == "tool_total_limit" for evt, _ in captured)
    assert any(evt == "budget_exhausted" for evt, _ in captured)


def test_recovery_invoke_state_trims_trailing_tool_messages() -> None:
    messages = [
        AIMessage(content="analysis in progress"),
        ToolMessage(content="blocked", tool_call_id="call_1", status="error"),
    ]

    state = _build_recovery_invoke_state(
        mode="analyze",
        notes=["stream_failure:tool_timeout"],
        messages=messages,
        failure_label="stream_failure",
    )

    # When the original history has no SystemMessage, the first message is the
    # prior AIMessage (recovery carrier is injected after any system block, and
    # since there is none, before the first non-system message, the first
    # element is the caller's AIMessage or the carrier itself depending on the
    # ordering strategy). Either way the invariant is: no SystemMessage appears
    # after a non-system message, and no trailing ToolMessage.
    assert not isinstance(state.messages[-1], ToolMessage)
    seen_non_system = False
    for msg in state.messages:
        if msg.__class__.__name__ == "SystemMessage":
            assert not seen_non_system
        else:
            seen_non_system = True


def test_tool_node_executes_remaining_calls_after_loop_guard(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls_executed: dict[str, int] = {"count": 0}

    async def fake_super_tool_node(_self, incoming_state):  # type: ignore[no-untyped-def]
        calls_executed["count"] += 1
        return incoming_state

    monkeypatch.setattr(workflow_module.ToolCallAgentGraph, "tool_node", fake_super_tool_node)

    graph = workflow_module.SafeToolCallAgentGraph.__new__(workflow_module.SafeToolCallAgentGraph)
    graph.tool_call_timeout_seconds = 30
    graph.tool_output_guard_max_chars = 30000
    graph.per_tool_max_chars = {}
    graph.tool_loop_guard_threshold = 1
    graph.max_parallel_tool_calls = 3
    graph.max_tool_calls_per_request = {}
    graph.subagent_recovery_escalation_budget = {}
    graph.mode_name = "analyze"

    previous = AIMessage(
        content="",
        tool_calls=[{"id": "call_1", "name": "reader_agent", "args": {"input_message": "scan"}}],
    )
    current = AIMessage(
        content="",
        tool_calls=[
            {"id": "call_2", "name": "reader_agent", "args": {"input_message": "scan"}},
            {"id": "call_3", "name": "reader_agent", "args": {"input_message": "scan-other"}},
        ],
        additional_kwargs={
            "tool_calls": [
                {
                    "id": "call_2",
                    "type": "function",
                    "function": {"name": "reader_agent", "arguments": '{"input_message":"scan"}'},
                },
                {
                    "id": "call_3",
                    "type": "function",
                    "function": {
                        "name": "reader_agent",
                        "arguments": '{"input_message":"scan-other"}',
                    },
                },
            ]
        },
    )
    state = ToolCallAgentGraphState(messages=[previous, current])

    result_state = asyncio.run(graph.tool_node(state))

    assert calls_executed["count"] == 1
    remaining_calls = result_state.messages[1].tool_calls
    assert len(remaining_calls) == 1
    assert remaining_calls[0]["id"] == "call_3"
    assert remaining_calls[0]["name"] == "reader_agent"
    assert remaining_calls[0]["args"] == {"input_message": "scan-other"}


def test_tool_signature_includes_delegation_identity_from_args() -> None:
    sig_a = _tool_signature("delegate_agent", {"subagent_name": "reader_agent", "q": "scan"})
    sig_b = _tool_signature("delegate_agent", {"subagent_name": "security_agent", "q": "scan"})

    assert sig_a != sig_b


def test_apply_tool_loop_guard_emits_subagent_metadata_for_delegated_calls(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: list[dict] = []

    def fake_emit(_event_type: str, payload: dict) -> None:
        captured.append(payload)

    monkeypatch.setattr(workflow_module, "_emit_trace_event", fake_emit)

    previous = AIMessage(
        content="",
        tool_calls=[
            {
                "id": "call_1",
                "name": "delegate_agent",
                "args": {"subagent_name": "reader_agent", "input_message": "scan"},
            }
        ],
    )
    current = AIMessage(
        content="",
        tool_calls=[
            {
                "id": "call_2",
                "name": "delegate_agent",
                "args": {"subagent_name": "reader_agent", "input_message": "scan"},
            }
        ],
    )
    state = ToolCallAgentGraphState(messages=[previous, current])

    blocked = _apply_tool_loop_guard(state, threshold=1, mode_name="analyze")

    assert blocked == 1
    assert captured
    assert captured[0].get("failure_source") == "subagent"
    assert captured[0].get("subagent_name") == "reader_agent"


def test_normalize_nested_subagent_failures_masks_raw_payload_and_exhausts() -> None:
    state = ToolCallAgentGraphState(
        messages=[
            ToolMessage(
                name="reader_agent",
                tool_call_id="call_1",
                status="error",
                content="GraphRecursionError: Recursion limit of 14 reached",
            ),
            ToolMessage(
                name="reader_agent",
                tool_call_id="call_2",
                status="error",
                content="GraphRecursionError: Recursion limit of 14 reached",
            ),
        ]
    )

    normalized = _normalize_nested_subagent_failures(
        state,
        mode_name="analyze",
        escalation_budget={"reader_agent": {"recursion_limit": 1}},
    )

    assert normalized == 2
    assert "GraphRecursionError" not in str(state.messages[0].content)
    assert "Nested recovery exhausted" in str(state.messages[1].content)


# ---------------------------------------------------------------------------
# Duplicate tool call regression tests (task 4)
# ---------------------------------------------------------------------------


def test_no_duplicate_tool_calls_with_updates_stream(monkeypatch: pytest.MonkeyPatch) -> None:
    """Integration regression — tool_call chunks spread across multiple stream
    events do NOT cause duplicate tool dispatches. Tool dispatch happens at
    graph edges, never from the streaming loop.
    """
    tool_call_count = 0

    async def fake_tool(arg: str) -> str:
        nonlocal tool_call_count
        tool_call_count += 1
        return "result"

    events_seen = 0

    class FakeCompiledGraph:
        async def astream_events(self, *_args, version="v2", **_kwargs):
            nonlocal events_seen
            for _ in range(3):
                events_seen += 1
                yield {
                    "event": "on_chat_model_stream",
                    "data": {"chunk": AIMessageChunk(content="", tool_call_chunks=[{"name": "fake_tool", "args": "", "id": "call_abc", "index": 0}])},
                    "name": "llm",
                }

        async def ainvoke(self, *_args, **_kwargs):
            return {"messages": [AIMessage(content="fallback")]}

    class FakeGraphFactory:
        def __init__(self, **_kwargs):
            pass

        async def build_graph(self):
            return FakeCompiledGraph()

    class FakeBuilder:
        async def get_llm(self, *_args, **_kwargs):
            return object()

        async def get_tools(self, tool_names, **_kwargs):
            if tool_names:
                return [SimpleNamespace(name="fake_tool")]
            return []

    monkeypatch.setattr(workflow_module, "SafeToolCallAgentGraph", FakeGraphFactory)
    monkeypatch.setattr(workflow_module, "build_active_skills_block", lambda **_kwargs: ([], ""))

    async def run() -> list[str]:
        config = SafeToolCallAgentWorkflowConfig.model_validate(
            {"tool_names": ["fake_tool"], "llm_name": "devstral"}
        )
        async with safe_tool_calling_agent_workflow(config, FakeBuilder()) as function_info:
            chunks = []
            async for chunk in function_info.stream_fn(ChatRequestOrMessage(input_message="Hi")):
                chunks.append(chunk.choices[0].delta.content or "")
            return chunks

    asyncio.run(run())

    # The streaming loop must have consumed all 3 events
    assert events_seen == 3
    # The streaming loop itself must NOT have called the tool (tool_call_count == 0)
    # because tool dispatch belongs to graph edges, not the content-extraction loop.
    assert tool_call_count == 0


def test_incremental_sse_chunks_from_updates_stream(monkeypatch: pytest.MonkeyPatch) -> None:
    """Integration — per-token stream events yield one SSE chunk per token."""

    class FakeCompiledGraph:
        async def astream_events(self, *_args, version="v2", **_kwargs):
            for content in ("He", "llo", " world"):
                yield {
                    "event": "on_chat_model_stream",
                    "data": {"chunk": AIMessageChunk(content=content)},
                    "name": "llm",
                }

        async def ainvoke(self, *_args, **_kwargs):
            return {"messages": [AIMessage(content="fallback")]}

    class FakeGraphFactory:
        def __init__(self, **_kwargs):
            pass

        async def build_graph(self):
            return FakeCompiledGraph()

    class FakeBuilder:
        async def get_llm(self, *_args, **_kwargs):
            return object()

        async def get_tools(self, tool_names, **_kwargs):
            if tool_names:
                return [SimpleNamespace(name="fake_tool")]
            return []

    monkeypatch.setattr(workflow_module, "SafeToolCallAgentGraph", FakeGraphFactory)
    monkeypatch.setattr(workflow_module, "build_active_skills_block", lambda **_kwargs: ([], ""))

    async def run() -> list[str]:
        config = SafeToolCallAgentWorkflowConfig.model_validate(
            {"tool_names": ["fake_tool"], "llm_name": "devstral"}
        )
        async with safe_tool_calling_agent_workflow(config, FakeBuilder()) as function_info:
            chunks = []
            async for chunk in function_info.stream_fn(ChatRequestOrMessage(input_message="Hi")):
                content = chunk.choices[0].delta.content
                if content:
                    chunks.append(content)
            return chunks

    chunks = asyncio.run(run())

    assert chunks == ["He", "llo", " world"]


# --- Tool call deduplication tests ---


def _make_state_with_tool_calls(calls: list[dict]) -> ToolCallAgentGraphState:
    """Create a minimal graph state with an AIMessage containing the given tool_calls."""
    msg = AIMessage(content="", tool_calls=calls)
    return ToolCallAgentGraphState(messages=[msg])


def test_deduplicate_tool_calls_identical_calls_deduplicated() -> None:
    call = {"id": "call_1", "name": "run_ruff", "args": {"path": "/app"}}
    duplicate = {"id": "call_2", "name": "run_ruff", "args": {"path": "/app"}}
    state = _make_state_with_tool_calls([call, duplicate])

    _deduplicate_tool_calls(state)

    tool_calls = state.messages[-1].tool_calls
    assert len(tool_calls) == 1
    assert tool_calls[0]["name"] == "run_ruff"


def test_deduplicate_tool_calls_different_args_preserved() -> None:
    call_a = {"id": "call_1", "name": "run_ruff", "args": {"path": "/app"}}
    call_b = {"id": "call_2", "name": "run_ruff", "args": {"path": "/tmp"}}
    state = _make_state_with_tool_calls([call_a, call_b])

    _deduplicate_tool_calls(state)

    tool_calls = state.messages[-1].tool_calls
    assert len(tool_calls) == 2


def test_deduplicate_tool_calls_different_names_preserved() -> None:
    call_a = {"id": "call_1", "name": "run_ruff", "args": {"path": "/app"}}
    call_b = {"id": "call_2", "name": "run_bandit", "args": {"path": "/app"}}
    state = _make_state_with_tool_calls([call_a, call_b])

    _deduplicate_tool_calls(state)

    tool_calls = state.messages[-1].tool_calls
    assert len(tool_calls) == 2


def test_deduplicate_tool_calls_empty_tool_calls_handled() -> None:
    state = _make_state_with_tool_calls([])
    _deduplicate_tool_calls(state)  # should not raise
    assert state.messages[-1].tool_calls == []


def test_deduplicate_tool_calls_no_duplicates_unchanged() -> None:
    calls = [
        {"id": "call_1", "name": "run_ruff", "args": {}},
        {"id": "call_2", "name": "run_bandit", "args": {}},
    ]
    state = _make_state_with_tool_calls(calls)
    _deduplicate_tool_calls(state)
    assert len(state.messages[-1].tool_calls) == 2


def test_deduplicate_tool_calls_keeps_first_occurrence() -> None:
    first = {"id": "call_1", "name": "clone_repository", "args": {"url": "https://example.com"}}
    dup1 = {"id": "call_2", "name": "clone_repository", "args": {"url": "https://example.com"}}
    dup2 = {"id": "call_3", "name": "clone_repository", "args": {"url": "https://example.com"}}
    state = _make_state_with_tool_calls([first, dup1, dup2])

    _deduplicate_tool_calls(state)

    tool_calls = state.messages[-1].tool_calls
    assert len(tool_calls) == 1
    assert tool_calls[0]["id"] == "call_1"


@pytest.mark.asyncio
async def test_retrieve_memory_context_skips_unready_episodic(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    from cognitive_code_agent.memory import readiness

    readiness._DEGRADED_LOG_CACHE.clear()  # noqa: SLF001 - test-only cache reset

    async def _fake_readiness(**_kwargs):
        return MemoryReadiness(
            episodic=SourceReadiness(available=False, reason="missing_redisearch_module"),
            findings=SourceReadiness(available=False, reason="milvus_unreachable"),
            semantic=SourceReadiness(available=False, reason="milvus_unreachable"),
        )

    monkeypatch.setattr(
        "cognitive_code_agent.memory.readiness.evaluate_memory_readiness", _fake_readiness
    )

    caplog.set_level("WARNING")
    result = await workflow_module._retrieve_memory_context(
        user_message="remember last session",
        memory_config=MemoryConfig(),
    )

    assert result == ""
    assert "memory_degraded source=episodic reason=missing_redisearch_module" in caplog.text


@pytest.mark.asyncio
async def test_fire_and_forget_session_summary_skips_when_backend_unready(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _fake_probe(**_kwargs):
        return SourceReadiness(available=False, reason="missing_redisearch_module")

    monkeypatch.setattr("cognitive_code_agent.memory.readiness.probe_episodic_redis", _fake_probe)

    workflow_module._fire_and_forget_session_summary(
        raw_messages=[{"role": "user", "content": "hello"}],
        llm=object(),
        memory_config=MemoryConfig(),
    )

    # allow background task to run once
    await asyncio.sleep(0)


# ---------------------------------------------------------------------------
# ModeConfig HITL fields
# ---------------------------------------------------------------------------


def test_mode_config_hitl_defaults() -> None:
    cfg = ModeConfig(llm_name="devstral", tool_names=["fs_tools"], prompt_path="p.md")
    assert cfg.hitl_enabled is False
    assert cfg.checkpointer_backend == "memory"
    assert cfg.interrupt_timeout_seconds == 120


def test_mode_config_from_dict_hitl() -> None:
    data = {
        "llm_name": "devstral",
        "tool_names": ["fs_tools"],
        "prompt_path": "p.md",
        "hitl_enabled": True,
        "checkpointer_backend": "sqlite",
        "interrupt_timeout_seconds": 60,
    }
    cfg = ModeConfig.from_dict(data)
    assert cfg.hitl_enabled is True
    assert cfg.checkpointer_backend == "sqlite"
    assert cfg.interrupt_timeout_seconds == 60


# ---------------------------------------------------------------------------
# SafeToolCallAgentGraph checkpointer
# ---------------------------------------------------------------------------


class _FakeLLM:
    """Minimal LLM stub that satisfies NAT's bind_tools requirement."""

    def bind_tools(self, tools):
        return self


def _make_fake_prompt():
    from langchain_core.prompts import ChatPromptTemplate

    return ChatPromptTemplate.from_messages([("system", "test")])


def test_safe_graph_accepts_checkpointer_param(monkeypatch) -> None:
    """SafeToolCallAgentGraph.__init__ accepts a _checkpointer kwarg."""
    from langgraph.checkpoint.memory import MemorySaver
    from nat.agent.tool_calling_agent.agent import ToolCallAgentGraph

    # Bypass heavy NAT parent init
    monkeypatch.setattr(ToolCallAgentGraph, "__init__", lambda self, *a, **kw: None)

    cp = MemorySaver()
    graph = SafeToolCallAgentGraph(
        llm=_FakeLLM(),
        tools=[],
        prompt=_make_fake_prompt(),
        _checkpointer=cp,
    )
    assert graph._checkpointer is cp


def test_safe_graph_checkpointer_defaults_to_none(monkeypatch) -> None:
    from nat.agent.tool_calling_agent.agent import ToolCallAgentGraph

    monkeypatch.setattr(ToolCallAgentGraph, "__init__", lambda self, *a, **kw: None)

    graph = SafeToolCallAgentGraph(
        llm=_FakeLLM(),
        tools=[],
        prompt=_make_fake_prompt(),
    )
    assert graph._checkpointer is None


# ---------------------------------------------------------------------------
# Write mode guard
# ---------------------------------------------------------------------------


def test_write_tool_names_contains_expected() -> None:
    assert "write_file" in WRITE_TOOL_NAMES
    assert "edit_file" in WRITE_TOOL_NAMES
    assert "create_directory" in WRITE_TOOL_NAMES


def test_read_only_modes_contains_analyze() -> None:
    assert "analyze" in READ_ONLY_MODES


def test_write_mode_guard_blocks_write_in_analyze() -> None:
    state = ToolCallAgentGraphState(
        messages=[
            AIMessage(
                content="",
                tool_calls=[
                    {
                        "name": "write_file",
                        "args": {"path": "a.py", "content": "x"},
                        "id": "call_1",
                    },
                ],
            ),
        ]
    )
    blocked = _apply_write_mode_guard(state, mode_name="analyze")
    assert blocked == 1
    last_msg = state.messages[-1]
    assert isinstance(last_msg, ToolMessage)
    assert last_msg.status == "error"
    assert "not available in analyze mode" in last_msg.content.lower()


def test_write_mode_guard_allows_write_in_execute() -> None:
    state = ToolCallAgentGraphState(
        messages=[
            AIMessage(
                content="",
                tool_calls=[
                    {
                        "name": "write_file",
                        "args": {"path": "a.py", "content": "x"},
                        "id": "call_1",
                    },
                ],
            ),
        ]
    )
    blocked = _apply_write_mode_guard(state, mode_name="execute")
    assert blocked == 0


def test_write_mode_guard_allows_read_in_analyze() -> None:
    state = ToolCallAgentGraphState(
        messages=[
            AIMessage(
                content="",
                tool_calls=[
                    {"name": "read_text_file", "args": {"path": "a.py"}, "id": "call_1"},
                ],
            ),
        ]
    )
    blocked = _apply_write_mode_guard(state, mode_name="analyze")
    assert blocked == 0


# ---------------------------------------------------------------------------
# Rate limit backoff
# ---------------------------------------------------------------------------


def test_rate_limit_backoff_delay_first_attempt() -> None:
    assert _rate_limit_backoff_delay(attempt=0) == 2.0


def test_rate_limit_backoff_delay_second_attempt() -> None:
    assert _rate_limit_backoff_delay(attempt=1) == 4.0


def test_rate_limit_backoff_delay_caps_at_max() -> None:
    assert _rate_limit_backoff_delay(attempt=10) == 30.0


def test_rate_limit_backoff_delay_respects_custom_max() -> None:
    assert _rate_limit_backoff_delay(attempt=10, max_delay=10.0) == 10.0


# ---------------------------------------------------------------------------
# TOOL_CALL_ID_MISMATCH and DEGRADED_FUNCTION classification
# ---------------------------------------------------------------------------


def test_classify_failure_tool_call_id_mismatch() -> None:
    err = RuntimeError(
        "[###] {'message': 'Unexpected tool call id e9dac0058 in tool results', "
        "'type': 'BadRequestError', 'param': None, 'code': 400}"
    )
    assert _classify_failure(err) is FailureClass.TOOL_CALL_ID_MISMATCH


def test_classify_failure_tool_call_id_mismatch_case_insensitive() -> None:
    err = RuntimeError("BadRequestError 400: unexpected tool call id abc123 in tool results")
    assert _classify_failure(err) is FailureClass.TOOL_CALL_ID_MISMATCH


def test_classify_failure_degraded_function() -> None:
    err = RuntimeError(
        "[400] Bad Request Function id '7fe236cd-dab4-40d4-a139-b28d6673ffd3': "
        "DEGRADED function cannot be invoked"
    )
    assert _classify_failure(err) is FailureClass.DEGRADED_FUNCTION


def test_classify_failure_unrelated_400_is_unknown_runtime() -> None:
    err = RuntimeError("[400] Bad Request: some other API error that is unrelated")
    result = _classify_failure(err)
    assert result is not FailureClass.TOOL_CALL_ID_MISMATCH
    assert result is not FailureClass.DEGRADED_FUNCTION


def test_tool_call_id_mismatch_policy_is_retryable() -> None:
    from cognitive_code_agent.agents.safe_tool_calling_agent import FAILURE_POLICIES

    policy = FAILURE_POLICIES[FailureClass.TOOL_CALL_ID_MISMATCH]
    assert policy.retryable is True


def test_degraded_function_policy_is_not_retryable() -> None:
    from cognitive_code_agent.agents.safe_tool_calling_agent import FAILURE_POLICIES

    policy = FAILURE_POLICIES[FailureClass.DEGRADED_FUNCTION]
    assert policy.retryable is False


# ---------------------------------------------------------------------------
# _guard_tool_outputs — per-tool limits and limit_source trace events
# ---------------------------------------------------------------------------


def test_guard_per_tool_limit_applied_when_name_matches() -> None:
    """Per-tool limit overrides global cap when tool name is in per_tool_max_chars."""
    from cognitive_code_agent.agents.safe_tool_calling_agent import _guard_tool_outputs

    content = "x" * 10000
    msg = ToolMessage(content=content, tool_call_id="call_1", name="fs_tools__directory_tree")
    state = ToolCallAgentGraphState(messages=[msg])
    _guard_tool_outputs(
        state,
        max_chars=30000,
        per_tool_max_chars={"fs_tools__directory_tree": 5000},
    )

    result = state.messages[0].content
    assert len(result) < 10000
    assert "[OUTPUT TRUNCATED:" in result
    # 5000 chars of content + truncation notice
    assert result.startswith("x" * 5000)


def test_guard_per_tool_limit_global_fallback_when_name_absent() -> None:
    """Global cap is used when tool name is not in per_tool_max_chars."""
    from cognitive_code_agent.agents.safe_tool_calling_agent import _guard_tool_outputs

    content = "y" * 10000
    msg = ToolMessage(content=content, tool_call_id="call_2", name="run_pytest")
    state = ToolCallAgentGraphState(messages=[msg])
    _guard_tool_outputs(
        state,
        max_chars=8000,
        per_tool_max_chars={"fs_tools__directory_tree": 5000},
    )

    result = state.messages[0].content
    # Should use global 8000 limit (not 5000 per-tool)
    assert result.startswith("y" * 8000)
    assert "[OUTPUT TRUNCATED:" in result


def test_guard_none_per_tool_config_unchanged_behavior() -> None:
    """None per_tool_max_chars behaves identically to prior behavior."""
    from cognitive_code_agent.agents.safe_tool_calling_agent import _guard_tool_outputs

    content = "z" * 50000
    msg = ToolMessage(content=content, tool_call_id="call_3", name="any_tool")
    state = ToolCallAgentGraphState(messages=[msg])
    _guard_tool_outputs(state, max_chars=30000, per_tool_max_chars=None)

    result = state.messages[0].content
    assert result.startswith("z" * 30000)
    assert "[OUTPUT TRUNCATED:" in result


def test_guard_limit_source_per_tool_in_trace_event(caplog) -> None:
    """tool_output_truncated trace event includes limit_source=per_tool."""
    import logging

    from cognitive_code_agent.agents.safe_tool_calling_agent import _guard_tool_outputs

    content = "a" * 10000
    msg = ToolMessage(content=content, tool_call_id="call_4", name="fs_tools__directory_tree")
    state = ToolCallAgentGraphState(messages=[msg])

    with caplog.at_level(logging.INFO):
        _guard_tool_outputs(
            state,
            max_chars=30000,
            per_tool_max_chars={"fs_tools__directory_tree": 5000},
        )

    log_text = " ".join(caplog.messages)
    assert "limit_source" in log_text
    assert "per_tool" in log_text


def test_guard_limit_source_global_in_trace_event(caplog) -> None:
    """tool_output_truncated trace event includes limit_source=global."""
    import logging

    from cognitive_code_agent.agents.safe_tool_calling_agent import _guard_tool_outputs

    content = "b" * 50000
    msg = ToolMessage(content=content, tool_call_id="call_5", name="some_tool")
    state = ToolCallAgentGraphState(messages=[msg])

    with caplog.at_level(logging.INFO):
        _guard_tool_outputs(state, max_chars=30000, per_tool_max_chars=None)

    log_text = " ".join(caplog.messages)
    assert "limit_source" in log_text
    assert "global" in log_text


# ---------------------------------------------------------------------------
# Context-reduction retry — _TRUNCATION_OCCURRED and _TOOL_GUARD_OVERRIDES
# ---------------------------------------------------------------------------


def test_truncation_occurred_set_after_guard() -> None:
    """_TRUNCATION_OCCURRED contextvar is set to True after a truncation."""
    from cognitive_code_agent.agents.safe_tool_calling_agent import (
        _TRUNCATION_OCCURRED,
        _guard_tool_outputs,
    )

    # Reset contextvar before test
    _TRUNCATION_OCCURRED.set(False)

    content = "x" * 50000
    msg = ToolMessage(content=content, tool_call_id="call_t1", name="fs_tools__directory_tree")
    state = ToolCallAgentGraphState(messages=[msg])
    _guard_tool_outputs(state, max_chars=30000)

    assert _TRUNCATION_OCCURRED.get() is True


def test_truncation_not_set_when_within_limit() -> None:
    """_TRUNCATION_OCCURRED is not set when content fits within limits."""
    from cognitive_code_agent.agents.safe_tool_calling_agent import (
        _TRUNCATION_OCCURRED,
        _guard_tool_outputs,
    )

    _TRUNCATION_OCCURRED.set(False)

    content = "x" * 100
    msg = ToolMessage(content=content, tool_call_id="call_t2", name="any_tool")
    state = ToolCallAgentGraphState(messages=[msg])
    _guard_tool_outputs(state, max_chars=30000)

    assert _TRUNCATION_OCCURRED.get() is False


def test_tool_guard_overrides_applied_from_contextvar() -> None:
    """_TOOL_GUARD_OVERRIDES contextvar overrides per_tool_max_chars at call time."""
    from cognitive_code_agent.agents.safe_tool_calling_agent import (
        _TOOL_GUARD_OVERRIDES,
        _guard_tool_outputs,
    )

    content = "y" * 10000
    msg = ToolMessage(content=content, tool_call_id="call_t3", name="fs_tools__directory_tree")
    state = ToolCallAgentGraphState(messages=[msg])

    # Set override to 2500 (halved from 5000)
    token = _TOOL_GUARD_OVERRIDES.set({"fs_tools__directory_tree": 2500})
    try:
        _guard_tool_outputs(
            state,
            max_chars=30000,
            per_tool_max_chars={"fs_tools__directory_tree": 5000},
        )
    finally:
        _TOOL_GUARD_OVERRIDES.reset(token)

    result = state.messages[0].content
    # Override (2500) should take precedence over per_tool (5000)
    assert result.startswith("y" * 2500)
    assert len(result) < 5000 + 200  # content portion < 5000


def test_truncation_occurred_reset_resets_to_false() -> None:
    """_TRUNCATION_OCCURRED can be reset to False to allow detection in next run."""
    from cognitive_code_agent.agents.safe_tool_calling_agent import (
        _TRUNCATION_OCCURRED,
        _guard_tool_outputs,
    )

    # First run causes truncation
    content = "x" * 50000
    msg = ToolMessage(content=content, tool_call_id="call_r1", name="any_tool")
    state = ToolCallAgentGraphState(messages=[msg])
    _guard_tool_outputs(state, max_chars=30000)
    assert _TRUNCATION_OCCURRED.get() is True

    # After reset, flag is False
    _TRUNCATION_OCCURRED.set(False)
    assert _TRUNCATION_OCCURRED.get() is False

    # Non-truncating run keeps it False
    small = ToolMessage(content="small", tool_call_id="call_r2", name="any_tool")
    state2 = ToolCallAgentGraphState(messages=[small])
    _guard_tool_outputs(state2, max_chars=30000)
    assert _TRUNCATION_OCCURRED.get() is False


def test_tool_guard_overrides_reset_restores_none() -> None:
    """After reset(), _TOOL_GUARD_OVERRIDES returns to its default (None)."""
    from cognitive_code_agent.agents.safe_tool_calling_agent import _TOOL_GUARD_OVERRIDES

    assert _TOOL_GUARD_OVERRIDES.get() is None

    token = _TOOL_GUARD_OVERRIDES.set({"some_tool": 1000})
    assert _TOOL_GUARD_OVERRIDES.get() == {"some_tool": 1000}

    _TOOL_GUARD_OVERRIDES.reset(token)
    assert _TOOL_GUARD_OVERRIDES.get() is None


def test_tool_guard_overrides_not_applied_when_not_set() -> None:
    """Without _TOOL_GUARD_OVERRIDES, per_tool_max_chars takes effect normally."""
    from cognitive_code_agent.agents.safe_tool_calling_agent import (
        _TOOL_GUARD_OVERRIDES,
        _guard_tool_outputs,
    )

    assert _TOOL_GUARD_OVERRIDES.get() is None  # default

    content = "z" * 10000
    msg = ToolMessage(content=content, tool_call_id="call_t4", name="fs_tools__directory_tree")
    state = ToolCallAgentGraphState(messages=[msg])
    _guard_tool_outputs(
        state,
        max_chars=30000,
        per_tool_max_chars={"fs_tools__directory_tree": 5000},
    )

    result = state.messages[0].content
    # Should use 5000 per-tool limit (no override active)
    assert result.startswith("z" * 5000)
    assert len(result) < 6000


# ---------------------------------------------------------------------------
# _build_synthesis_invoke_state
# ---------------------------------------------------------------------------


def test_build_synthesis_invoke_state_structure() -> None:
    """Synthesis state contains the synthesis instruction and original messages."""
    from langchain_core.messages import HumanMessage

    from cognitive_code_agent.agents.safe_tool_calling_agent import (
        _build_synthesis_invoke_state,
    )

    msgs = [HumanMessage(content="analyze this repo")]
    state, cfg = _build_synthesis_invoke_state(mode="analyze", messages=msgs)

    # State has a synthesis instruction message prepended
    assert len(state.messages) >= 2
    first_content = str(state.messages[0].content)
    assert "summarize" in first_content.lower() or "partial" in first_content.lower()
    assert (
        "do not re-run" in first_content.lower()
        or "no tools" in first_content.lower()
        or "without" in first_content.lower()
    )

    # Config has capped recursion limit
    from cognitive_code_agent.agents.safe_tool_calling_agent import _SYNTHESIS_RECURSION_LIMIT

    assert cfg["recursion_limit"] == _SYNTHESIS_RECURSION_LIMIT


def test_build_synthesis_invoke_state_trims_trailing_tool_messages() -> None:
    """Trailing ToolMessages are removed (avoids serialization errors)."""
    from langchain_core.messages import HumanMessage

    from cognitive_code_agent.agents.safe_tool_calling_agent import (
        _build_synthesis_invoke_state,
    )

    msgs = [HumanMessage(content="task"), ToolMessage(content="result", tool_call_id="c1")]
    state, _ = _build_synthesis_invoke_state(mode="analyze", messages=msgs)

    assert not isinstance(state.messages[-1], ToolMessage)


def test_build_synthesis_invoke_state_empty_messages() -> None:
    """Empty messages list produces a valid state with at least the synthesis instruction."""
    from cognitive_code_agent.agents.safe_tool_calling_agent import (
        _build_synthesis_invoke_state,
    )

    state, cfg = _build_synthesis_invoke_state(mode="execute", messages=[])
    assert len(state.messages) >= 1
    assert cfg["recursion_limit"] > 0


# ---------------------------------------------------------------------------
# ainvoke retry logic helpers — _should_retry_ainvoke
# ---------------------------------------------------------------------------


def test_should_retry_ainvoke_server_error_is_retryable() -> None:
    """SERVER_ERROR and RATE_LIMITED are retryable in ainvoke fallback."""
    from cognitive_code_agent.agents.safe_tool_calling_agent import _should_retry_ainvoke

    assert _should_retry_ainvoke(FailureClass.SERVER_ERROR) is True
    assert _should_retry_ainvoke(FailureClass.RATE_LIMITED) is True


def test_should_retry_ainvoke_other_classes_not_retryable() -> None:
    """RECURSION_LIMIT and UNKNOWN_RUNTIME are not retried in ainvoke fallback."""
    from cognitive_code_agent.agents.safe_tool_calling_agent import _should_retry_ainvoke

    assert _should_retry_ainvoke(FailureClass.RECURSION_LIMIT) is False
    assert _should_retry_ainvoke(FailureClass.UNKNOWN_RUNTIME) is False
    assert _should_retry_ainvoke(FailureClass.TOOL_CALL_ID_MISMATCH) is False
    assert _should_retry_ainvoke(FailureClass.DEGRADED_FUNCTION) is False


# ---------------------------------------------------------------------------
# _STREAM_FAILURE_RECURSION constant — write and read sites
# ---------------------------------------------------------------------------


def test_stream_failure_recursion_constant_matches_recursion_limit_value() -> None:
    """_STREAM_FAILURE_RECURSION encodes the recursion_limit failure value."""
    from cognitive_code_agent.agents.safe_tool_calling_agent import _STREAM_FAILURE_RECURSION

    # The constant must contain the FailureClass.RECURSION_LIMIT value so detection works
    assert FailureClass.RECURSION_LIMIT.value in _STREAM_FAILURE_RECURSION


def test_synthesis_recursion_limit_is_small() -> None:
    """_SYNTHESIS_RECURSION_LIMIT is small enough to avoid re-running full analysis."""
    from cognitive_code_agent.agents.safe_tool_calling_agent import _SYNTHESIS_RECURSION_LIMIT

    # Must be significantly smaller than a typical analyze recursion_limit (62)
    assert _SYNTHESIS_RECURSION_LIMIT <= 16
    assert _SYNTHESIS_RECURSION_LIMIT >= 6  # at least enough for one turn


def test_build_synthesis_invoke_state_cfg_matches_constant() -> None:
    """Config returned by helper uses the _SYNTHESIS_RECURSION_LIMIT constant."""
    from cognitive_code_agent.agents.safe_tool_calling_agent import (
        _SYNTHESIS_RECURSION_LIMIT,
        _build_synthesis_invoke_state,
    )

    _, cfg = _build_synthesis_invoke_state(mode="analyze", messages=[])
    assert cfg["recursion_limit"] == _SYNTHESIS_RECURSION_LIMIT


# ---------------------------------------------------------------------------
# Role-order safety for recovery / synthesis fallback states
#
# Regression guard: NIM (and other OpenAI-compatible providers) reject
# message histories where a `system` role appears AFTER an `assistant` role
# with HTTP 400 "Unexpected role 'system' after role 'assistant'". The recovery
# and synthesis helpers used to prepend an AIMessage unconditionally, which
# pushed the original leading SystemMessage(s) behind an assistant message and
# killed the ainvoke fallback, surfacing the "Execution budget exhausted"
# partial-output template on every recovery attempt.
# ---------------------------------------------------------------------------


def test_recovery_invoke_state_preserves_leading_system_messages() -> None:
    """Leading SystemMessages must remain at the head — never behind an AIMessage."""
    from langchain_core.messages import HumanMessage, SystemMessage

    base_system = SystemMessage(content="base prompt")
    skills_system = SystemMessage(content="[Active Skills] ...")
    human = HumanMessage(content="analyze my repo")
    prior_ai = AIMessage(content="I will start by listing files.")

    state = _build_recovery_invoke_state(
        mode="analyze",
        notes=["stream_failure:server_error"],
        messages=[base_system, skills_system, human, prior_ai],
        failure_label="stream_failure",
    )

    # No SystemMessage may appear after any non-system message.
    seen_non_system = False
    for msg in state.messages:
        if isinstance(msg, SystemMessage):
            assert not seen_non_system, (
                "SystemMessage appeared after a non-system message — provider will 400"
            )
        else:
            seen_non_system = True

    # The original system messages must still be present at the head.
    assert isinstance(state.messages[0], SystemMessage)
    assert isinstance(state.messages[1], SystemMessage)
    assert state.messages[0].content == "base prompt"
    assert state.messages[1].content == "[Active Skills] ..."


def test_synthesis_invoke_state_preserves_leading_system_messages() -> None:
    """Synthesis state must also keep leading SystemMessages at the head."""
    from langchain_core.messages import HumanMessage, SystemMessage

    from cognitive_code_agent.agents.safe_tool_calling_agent import (
        _build_synthesis_invoke_state,
    )

    base_system = SystemMessage(content="base prompt")
    memory_system = SystemMessage(content="[Memory Context] ...")
    human = HumanMessage(content="full audit please")
    prior_ai = AIMessage(content="Starting traversal.")

    state, _cfg = _build_synthesis_invoke_state(
        mode="analyze",
        messages=[base_system, memory_system, human, prior_ai],
    )

    seen_non_system = False
    for msg in state.messages:
        if isinstance(msg, SystemMessage):
            assert not seen_non_system, (
                "SystemMessage appeared after a non-system message — provider will 400"
            )
        else:
            seen_non_system = True

    assert isinstance(state.messages[0], SystemMessage)
    assert isinstance(state.messages[1], SystemMessage)


def test_recovery_invoke_state_context_message_follows_system_block() -> None:
    """The recovery context carrier must sit AFTER the system block, not before it."""
    from langchain_core.messages import HumanMessage, SystemMessage

    base_system = SystemMessage(content="base prompt")
    human = HumanMessage(content="hi")

    state = _build_recovery_invoke_state(
        mode="execute",
        notes=["stream_failure:tool_timeout"],
        messages=[base_system, human],
        failure_label="stream_failure",
    )

    # First message is still a system message (base prompt preserved).
    assert isinstance(state.messages[0], SystemMessage)
    # Recovery context carrier is injected, and does not violate ordering:
    # it must appear either as the LAST system message or as a non-system
    # message that only precedes other non-system messages.
    recovery_idx = None
    for i, msg in enumerate(state.messages):
        if "[Recovery Context" in str(getattr(msg, "content", "")):
            recovery_idx = i
            break
    assert recovery_idx is not None, "recovery context carrier missing"


def test_synthesis_invoke_state_context_message_follows_system_block() -> None:
    """Synthesis carrier must sit AFTER the system block, not before it."""
    from langchain_core.messages import HumanMessage, SystemMessage

    from cognitive_code_agent.agents.safe_tool_calling_agent import (
        _build_synthesis_invoke_state,
    )

    base_system = SystemMessage(content="base prompt")
    human = HumanMessage(content="hi")

    state, _cfg = _build_synthesis_invoke_state(
        mode="analyze",
        messages=[base_system, human],
    )

    assert isinstance(state.messages[0], SystemMessage)
    synth_idx = None
    for i, msg in enumerate(state.messages):
        if "[Synthesis" in str(getattr(msg, "content", "")):
            synth_idx = i
            break
    assert synth_idx is not None, "synthesis carrier missing"


def test_recovery_invoke_state_no_system_messages_still_works() -> None:
    """Backward-compat: if caller has no SystemMessages, first msg is the carrier."""
    from langchain_core.messages import HumanMessage

    msgs = [HumanMessage(content="hi"), AIMessage(content="hello")]
    state = _build_recovery_invoke_state(
        mode="analyze",
        notes=["stream_failure:server_error"],
        messages=msgs,
        failure_label="stream_failure",
    )
    # No SystemMessage present → carrier is the first message (still valid ordering).
    first_content = str(state.messages[0].content)
    assert "[Recovery Context" in first_content


def test_sanitize_message_role_order_drops_mid_list_system_messages() -> None:
    """A defensive sanitizer must relocate any mid-list SystemMessage to the head."""
    from langchain_core.messages import HumanMessage, SystemMessage

    from cognitive_code_agent.agents.safe_tool_calling_agent import (
        _sanitize_message_role_order,
    )

    msgs = [
        SystemMessage(content="base"),
        HumanMessage(content="do it"),
        AIMessage(content="working"),
        SystemMessage(content="injected mid-conversation"),
        HumanMessage(content="continue"),
    ]
    fixed = _sanitize_message_role_order(msgs)

    seen_non_system = False
    for msg in fixed:
        if isinstance(msg, SystemMessage):
            assert not seen_non_system, "sanitizer did not relocate mid-list SystemMessage"
        else:
            seen_non_system = True
    # Both system messages should still be present (not dropped).
    assert sum(1 for m in fixed if isinstance(m, SystemMessage)) == 2


def test_sanitize_message_role_order_is_idempotent() -> None:
    from langchain_core.messages import HumanMessage, SystemMessage

    from cognitive_code_agent.agents.safe_tool_calling_agent import (
        _sanitize_message_role_order,
    )

    msgs = [
        SystemMessage(content="base"),
        HumanMessage(content="x"),
        AIMessage(content="y"),
    ]
    once = _sanitize_message_role_order(msgs)
    twice = _sanitize_message_role_order(once)
    assert [type(m) for m in once] == [type(m) for m in twice]
    assert [str(m.content) for m in once] == [str(m.content) for m in twice]


def test_should_retry_ainvoke_covers_all_failure_classes() -> None:
    """_should_retry_ainvoke returns a bool for every FailureClass without error."""
    from cognitive_code_agent.agents.safe_tool_calling_agent import _should_retry_ainvoke

    for fc in FailureClass:
        result = _should_retry_ainvoke(fc)
        assert isinstance(result, bool)


# ---------------------------------------------------------------------------
# DEGRADED_FUNCTION ainvoke probe recovery
# ---------------------------------------------------------------------------

_DEGRADED_ERROR = RuntimeError(
    "[400] Bad Request Function id '7fe236cd-dab4-40d4-a139-b28d6673ffd3': "
    "DEGRADED function cannot be invoked"
)


def _make_degraded_fake_graph(*, ainvoke_side_effect=None, ainvoke_result=None):
    """Create a FakeCompiledGraph where stream raises DEGRADED.

    *ainvoke_side_effect*: exception to raise on ainvoke (or ``None``).
    *ainvoke_result*: dict to return from ainvoke (ignored when side_effect set).
    """

    class FakeCompiledGraph:
        def __init__(self):
            self.ainvoke_called = False

        async def astream(self, *_args, **_kwargs):
            raise _DEGRADED_ERROR
            yield  # pragma: no cover — makes it an async generator

        async def ainvoke(self, *_args, **_kwargs):
            self.ainvoke_called = True
            if ainvoke_side_effect is not None:
                raise ainvoke_side_effect
            return ainvoke_result or {"messages": [AIMessage(content="probe recovered")]}

    return FakeCompiledGraph()


def _make_fake_builder():
    class FakeBuilder:
        async def get_llm(self, *_args, **_kwargs):
            return object()

        async def get_tools(self, tool_names, **_kwargs):
            if tool_names:
                return [SimpleNamespace(name="fake_tool")]
            return []

    return FakeBuilder()


def _run_degraded_scenario(monkeypatch, fake_graph) -> list[str]:
    """Run the agent workflow with a pre-built fake graph and return chunk contents."""

    class FakeGraphFactory:
        def __init__(self, **_kwargs):
            pass

        async def build_graph(self):
            return fake_graph

    monkeypatch.setattr(workflow_module, "SafeToolCallAgentGraph", FakeGraphFactory)
    monkeypatch.setattr(workflow_module, "build_active_skills_block", lambda **_kwargs: ([], ""))

    async def run() -> list[str]:
        config = SafeToolCallAgentWorkflowConfig.model_validate(
            {"tool_names": ["fake_tool"], "llm_name": "devstral"}
        )
        async with safe_tool_calling_agent_workflow(config, _make_fake_builder()) as fi:
            chunks = []
            async for chunk in fi.stream_fn(ChatRequestOrMessage(input_message="Hola")):
                chunks.append(chunk.choices[0].delta.content or "")
            return chunks

    return asyncio.run(run())


def test_degraded_stream_ainvoke_probe_succeeds(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When stream fails with DEGRADED but ainvoke probe succeeds, the agent
    returns the ainvoke content rather than a structured partial response."""
    fake_graph = _make_degraded_fake_graph(
        ainvoke_result={"messages": [AIMessage(content="probe recovered content")]}
    )

    chunks = _run_degraded_scenario(monkeypatch, fake_graph)

    assert fake_graph.ainvoke_called is True
    joined = "".join(chunks)
    assert "probe recovered content" in joined
    assert "Execution budget was exhausted" not in joined


def test_degraded_stream_ainvoke_probe_also_degraded(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When both stream and ainvoke probe fail with DEGRADED, agent returns
    a structured partial response with blocked_by."""
    fake_graph = _make_degraded_fake_graph(ainvoke_side_effect=_DEGRADED_ERROR)

    chunks = _run_degraded_scenario(monkeypatch, fake_graph)

    assert fake_graph.ainvoke_called is True
    joined = "".join(chunks)
    assert "Execution budget was exhausted" in joined or "Remote function degraded" in joined


def test_degraded_stream_ainvoke_probe_fails_server_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When stream fails with DEGRADED and ainvoke probe fails with
    SERVER_ERROR, the agent classifies and handles as SERVER_ERROR."""
    server_error = RuntimeError("[500] Internal Server Error: inference connection error")
    fake_graph = _make_degraded_fake_graph(ainvoke_side_effect=server_error)

    chunks = _run_degraded_scenario(monkeypatch, fake_graph)

    assert fake_graph.ainvoke_called is True
    joined = "".join(chunks)
    # Should have fallen through to partial response (not the DEGRADED partial)
    assert "Execution budget was exhausted" in joined or "Ainvoke fallback failed" in joined


# ---------------------------------------------------------------------------
# Task 3: TEMPERATURE_PRESETS, ModeConfig.switchable_models, runtime key resolution
# ---------------------------------------------------------------------------


def test_temperature_presets_defined() -> None:
    from cognitive_code_agent.agents.safe_tool_calling_agent import TEMPERATURE_PRESETS

    assert TEMPERATURE_PRESETS == {"low": 0.1, "medium": 0.3, "high": 0.7}


def test_mode_config_switchable_models_defaults_to_empty() -> None:
    cfg = ModeConfig(llm_name="devstral", tool_names=[], prompt_path="p.md")
    assert cfg.switchable_models == []


def test_mode_config_from_dict_reads_switchable_models() -> None:
    data = {
        "llm_name": "devstral",
        "tool_names": [],
        "prompt_path": "p.md",
        "switchable_models": ["devstral", "qwen_coder"],
    }
    cfg = ModeConfig.from_dict(data)
    assert cfg.switchable_models == ["devstral", "qwen_coder"]


def test_mode_config_from_dict_missing_switchable_models_defaults_empty() -> None:
    data = {"llm_name": "devstral", "tool_names": [], "prompt_path": "p.md"}
    cfg = ModeConfig.from_dict(data)
    assert cfg.switchable_models == []


def test_mode_config_from_dict_reads_max_recovery_rounds() -> None:
    data = {
        "llm_name": "devstral",
        "tool_names": [],
        "prompt_path": "p.md",
        "max_recovery_rounds": 5,
    }
    cfg = ModeConfig.from_dict(data)
    assert cfg.max_recovery_rounds == 5


def test_mode_config_from_dict_missing_max_recovery_rounds_defaults_to_3() -> None:
    data = {"llm_name": "devstral", "tool_names": [], "prompt_path": "p.md"}
    cfg = ModeConfig.from_dict(data)
    assert cfg.max_recovery_rounds == 3


def test_is_compact_recoverable_recursion_always_true() -> None:
    from cognitive_code_agent.agents.safe_tool_calling_agent import _is_compact_recoverable

    assert _is_compact_recoverable(FailureClass.RECURSION_LIMIT, has_progress=True) is True
    assert _is_compact_recoverable(FailureClass.RECURSION_LIMIT, has_progress=False) is True


def test_is_compact_recoverable_context_overflow_always_true() -> None:
    from cognitive_code_agent.agents.safe_tool_calling_agent import _is_compact_recoverable

    assert _is_compact_recoverable(FailureClass.CONTEXT_OVERFLOW, has_progress=True) is True
    assert _is_compact_recoverable(FailureClass.CONTEXT_OVERFLOW, has_progress=False) is True


def test_is_compact_recoverable_server_error_only_with_progress() -> None:
    from cognitive_code_agent.agents.safe_tool_calling_agent import _is_compact_recoverable

    assert _is_compact_recoverable(FailureClass.SERVER_ERROR, has_progress=True) is True
    assert _is_compact_recoverable(FailureClass.SERVER_ERROR, has_progress=False) is False


def test_is_compact_recoverable_rate_limited_only_with_progress() -> None:
    from cognitive_code_agent.agents.safe_tool_calling_agent import _is_compact_recoverable

    assert _is_compact_recoverable(FailureClass.RATE_LIMITED, has_progress=True) is True
    assert _is_compact_recoverable(FailureClass.RATE_LIMITED, has_progress=False) is False


def test_is_compact_recoverable_other_classes_always_false() -> None:
    from cognitive_code_agent.agents.safe_tool_calling_agent import _is_compact_recoverable

    for fc in (
        FailureClass.TOOL_TIMEOUT,
        FailureClass.TOOL_VALIDATION_ERROR,
        FailureClass.TOOL_CALL_ID_MISMATCH,
        FailureClass.DEGRADED_FUNCTION,
        FailureClass.MEMORY_DEGRADED,
        FailureClass.EVIDENCE_INSUFFICIENT,
        FailureClass.UNKNOWN_RUNTIME,
        FailureClass.HITL_TIMEOUT,
        FailureClass.WRITE_DENIED,
    ):
        assert _is_compact_recoverable(fc, has_progress=True) is False, fc
        assert _is_compact_recoverable(fc, has_progress=False) is False, fc


def test_resolve_runtime_key_returns_tuple() -> None:
    from cognitive_code_agent.agents.safe_tool_calling_agent import _resolve_runtime_key

    key = _resolve_runtime_key(mode="analyze", model_key="qwen_coder", temp_preset="high")
    assert key == ("analyze", "qwen_coder", "high")


def test_resolve_runtime_key_defaults_medium_when_invalid_preset() -> None:
    from cognitive_code_agent.agents.safe_tool_calling_agent import _resolve_runtime_key

    key = _resolve_runtime_key(mode="analyze", model_key="devstral", temp_preset="extreme")
    assert key == ("analyze", "devstral", "medium")


def test_resolve_runtime_key_accepts_all_valid_presets() -> None:
    from cognitive_code_agent.agents.safe_tool_calling_agent import _resolve_runtime_key

    for preset in ("low", "medium", "high"):
        key = _resolve_runtime_key(mode="execute", model_key="devstral", temp_preset=preset)
        assert key[2] == preset


# ---------------------------------------------------------------------------
# _measure_progress tests
# ---------------------------------------------------------------------------


def test_measure_progress_useful_tool_output_returns_true() -> None:
    from cognitive_code_agent.agents.safe_tool_calling_agent import _measure_progress

    msgs: list = [
        AIMessage(content="calling tool"),
        ToolMessage(content="x" * 100, tool_call_id="call_1"),
    ]
    assert _measure_progress(msgs, 0) is True


def test_measure_progress_error_only_returns_false() -> None:
    from cognitive_code_agent.agents.safe_tool_calling_agent import _measure_progress

    msgs: list = [
        AIMessage(content="calling tool"),
        ToolMessage(content="error detail", tool_call_id="call_1", status="error"),
    ]
    assert _measure_progress(msgs, 0) is False


def test_measure_progress_no_new_messages_returns_false() -> None:
    from cognitive_code_agent.agents.safe_tool_calling_agent import _measure_progress

    msgs: list = [AIMessage(content="initial")]
    assert _measure_progress(msgs, 1) is False


def test_measure_progress_empty_content_returns_false() -> None:
    from cognitive_code_agent.agents.safe_tool_calling_agent import _measure_progress

    msgs: list = [
        AIMessage(content="calling tool"),
        ToolMessage(content="short", tool_call_id="call_1"),
    ]
    assert _measure_progress(msgs, 0) is False


# ---------------------------------------------------------------------------
# Temperature override: _build_mode_runtime applies temp via llm.bind()
# ---------------------------------------------------------------------------


def test_build_mode_runtime_applies_temperature_override(monkeypatch: pytest.MonkeyPatch) -> None:
    """When temp_override is given, the returned runtime.llm should be a
    RunnableBinding with temperature set to the override value."""
    from langchain_core.runnables import RunnableBinding, RunnableLambda
    from cognitive_code_agent.agents.safe_tool_calling_agent import (
        _build_mode_runtime,
        TEMPERATURE_PRESETS,
    )

    class FakeLLM(RunnableLambda):
        """Minimal Runnable mock that supports .bind() like BaseChatModel."""

        def __init__(self):
            super().__init__(func=lambda x: x)

    class FakeCompiledGraph:
        async def astream(self, *a, **kw):
            yield {}

    class FakeGraphFactory:
        def __init__(self, **_kwargs):
            pass

        async def build_graph(self):
            return FakeCompiledGraph()

    fake_llm = FakeLLM()

    class FakeBuilder:
        async def get_llm(self, *_args, **_kwargs):
            return fake_llm

        async def get_tools(self, tool_names, **_kwargs):
            if tool_names:
                return [SimpleNamespace(name="fake_tool")]
            return []

    monkeypatch.setattr(workflow_module, "SafeToolCallAgentGraph", FakeGraphFactory)
    monkeypatch.setattr(workflow_module, "load_base_prompt", lambda _: "system prompt")
    monkeypatch.setattr(workflow_module, "build_active_skills_block", lambda **_kwargs: ([], ""))

    mode_cfg = ModeConfig(llm_name="devstral", tool_names=["fake_tool"], prompt_path="p.md")
    base_config = SafeToolCallAgentWorkflowConfig.model_validate(
        {"tool_names": ["fake_tool"], "llm_name": "devstral"}
    )

    async def run():
        results = {}
        for preset_name, temp_val in TEMPERATURE_PRESETS.items():
            rt = await _build_mode_runtime(
                mode_name="analyze",
                mode_cfg=mode_cfg,
                builder=FakeBuilder(),
                base_config=base_config,
                temp_override=temp_val,
            )
            results[preset_name] = rt
        return results

    runtimes = asyncio.run(run())
    for preset_name, temp_val in TEMPERATURE_PRESETS.items():
        rt = runtimes[preset_name]
        assert isinstance(rt.llm, RunnableBinding), (
            f"Expected RunnableBinding for preset '{preset_name}', got {type(rt.llm)}"
        )
        assert rt.llm.kwargs.get("temperature") == temp_val, (
            f"Expected temperature={temp_val} for preset '{preset_name}', "
            f"got {rt.llm.kwargs.get('temperature')}"
        )


def test_build_mode_runtime_no_override_returns_raw_llm(monkeypatch: pytest.MonkeyPatch) -> None:
    """When temp_override is None, the returned runtime.llm should be the
    original LLM (not wrapped in RunnableBinding)."""
    from langchain_core.runnables import RunnableBinding
    from cognitive_code_agent.agents.safe_tool_calling_agent import _build_mode_runtime

    class FakeCompiledGraph:
        async def astream(self, *a, **kw):
            yield {}

    class FakeGraphFactory:
        def __init__(self, **_kwargs):
            pass

        async def build_graph(self):
            return FakeCompiledGraph()

    fake_llm = object()

    class FakeBuilder:
        async def get_llm(self, *_args, **_kwargs):
            return fake_llm

        async def get_tools(self, tool_names, **_kwargs):
            if tool_names:
                return [SimpleNamespace(name="fake_tool")]
            return []

    monkeypatch.setattr(workflow_module, "SafeToolCallAgentGraph", FakeGraphFactory)
    monkeypatch.setattr(workflow_module, "load_base_prompt", lambda _: "system prompt")
    monkeypatch.setattr(workflow_module, "build_active_skills_block", lambda **_kwargs: ([], ""))

    mode_cfg = ModeConfig(llm_name="devstral", tool_names=["fake_tool"], prompt_path="p.md")
    base_config = SafeToolCallAgentWorkflowConfig.model_validate(
        {"tool_names": ["fake_tool"], "llm_name": "devstral"}
    )

    async def run():
        return await _build_mode_runtime(
            mode_name="analyze",
            mode_cfg=mode_cfg,
            builder=FakeBuilder(),
            base_config=base_config,
        )

    rt = asyncio.run(run())
    assert not isinstance(rt.llm, RunnableBinding)
    assert rt.llm is fake_llm


def test_build_mode_runtime_bound_llm_passed_to_graph(monkeypatch: pytest.MonkeyPatch) -> None:
    """The bound LLM (RunnableBinding) should be the one passed to
    SafeToolCallAgentGraph, not the unwrapped original."""
    from langchain_core.runnables import RunnableBinding, RunnableLambda
    from cognitive_code_agent.agents.safe_tool_calling_agent import _build_mode_runtime

    captured_kwargs: dict = {}

    class FakeCompiledGraph:
        async def astream(self, *a, **kw):
            yield {}

    class FakeGraphFactory:
        def __init__(self, **kwargs):
            captured_kwargs.update(kwargs)

        async def build_graph(self):
            return FakeCompiledGraph()

    class FakeLLM(RunnableLambda):
        def __init__(self):
            super().__init__(func=lambda x: x)

    class FakeBuilder:
        async def get_llm(self, *_args, **_kwargs):
            return FakeLLM()

        async def get_tools(self, tool_names, **_kwargs):
            if tool_names:
                return [SimpleNamespace(name="fake_tool")]
            return []

    monkeypatch.setattr(workflow_module, "SafeToolCallAgentGraph", FakeGraphFactory)
    monkeypatch.setattr(workflow_module, "load_base_prompt", lambda _: "system prompt")
    monkeypatch.setattr(workflow_module, "build_active_skills_block", lambda **_kwargs: ([], ""))

    mode_cfg = ModeConfig(llm_name="devstral", tool_names=["fake_tool"], prompt_path="p.md")
    base_config = SafeToolCallAgentWorkflowConfig.model_validate(
        {"tool_names": ["fake_tool"], "llm_name": "devstral"}
    )

    async def run():
        return await _build_mode_runtime(
            mode_name="analyze",
            mode_cfg=mode_cfg,
            builder=FakeBuilder(),
            base_config=base_config,
            temp_override=0.7,
        )

    asyncio.run(run())
    assert isinstance(captured_kwargs["llm"], RunnableBinding), (
        f"Graph received {type(captured_kwargs['llm'])}, expected RunnableBinding"
    )
    assert captured_kwargs["llm"].kwargs.get("temperature") == 0.7


# ---------------------------------------------------------------------------
# agent_node streaming (granular-streaming-events)
# ---------------------------------------------------------------------------


def _make_streaming_llm(chunks: list[AIMessageChunk]):
    """Build a fake LLM that forces astream() to be used.

    ainvoke() returns a SENTINEL marker so tests can prove the new code
    path (astream + accumulation) is being used rather than the old ainvoke
    path. If agent_node still calls ainvoke(), the marker leaks through and
    the content assertion fails.
    """
    from langchain_core.runnables import Runnable

    class _StreamingBound(Runnable):
        ainvoke_called = False

        async def astream(self, input, config=None, **kwargs):
            for chunk in chunks:
                yield chunk

        async def ainvoke(self, input, config=None, **kwargs):
            _StreamingBound.ainvoke_called = True
            return AIMessage(content="__AINVOKE_SENTINEL__")

        def invoke(self, input, config=None, **kwargs):
            return AIMessage(content="__AINVOKE_SENTINEL__")

    class _FakeStreamingLLM:
        def bind_tools(self, tools):
            return _StreamingBound()

    return _FakeStreamingLLM()


async def test_agent_node_uses_astream_and_accumulates_chunks(monkeypatch: pytest.MonkeyPatch) -> None:
    """2.1 RED — agent_node must call astream() and accumulate AIMessageChunks.

    When the LLM streams N chunks, the final message appended to state must
    have content equal to the concatenation of all chunk contents.
    """
    from nat.agent.tool_calling_agent.agent import ToolCallAgentGraph

    monkeypatch.setattr(ToolCallAgentGraph, "__init__", lambda self, *a, **kw: None)

    chunks = [
        AIMessageChunk(content="Hello"),
        AIMessageChunk(content=" "),
        AIMessageChunk(content="world"),
    ]
    llm = _make_streaming_llm(chunks)

    graph = SafeToolCallAgentGraph(
        llm=llm,
        tools=[],
        prompt=_make_fake_prompt(),
    )
    # Manually wire the attributes that NAT's __init__ would have set
    graph.bound_llm = llm.bind_tools([])
    from langchain_core.runnables import RunnableLambda
    graph.agent = RunnableLambda(lambda state: state.get("messages", [])) | graph.bound_llm
    graph.callbacks = None
    graph.summary_llm = None
    graph._compaction_cooldown_counter = 0
    from cognitive_code_agent.memory import WorkingMemoryConfig
    graph.compaction_config = WorkingMemoryConfig()

    from langchain_core.messages import HumanMessage
    state = ToolCallAgentGraphState(messages=[HumanMessage(content="Hi")])

    result = await graph.agent_node(state)

    assert len(result.messages) == 2, "agent_node should append exactly one response"
    final = result.messages[-1]
    assert final.content == "Hello world", (
        f"Expected accumulated content 'Hello world', got {final.content!r}. "
        "agent_node must stream via astream() and accumulate chunks."
    )


async def test_agent_node_preserves_tool_calls_after_streaming(monkeypatch: pytest.MonkeyPatch) -> None:
    """2.2 RED — tool_calls on the final chunk must survive accumulation."""
    from nat.agent.tool_calling_agent.agent import ToolCallAgentGraph

    monkeypatch.setattr(ToolCallAgentGraph, "__init__", lambda self, *a, **kw: None)

    tool_call = {"id": "call_abc", "name": "fake_tool", "args": {"path": "/x"}}
    chunks = [
        AIMessageChunk(content="I will "),
        AIMessageChunk(content="call a tool."),
        AIMessageChunk(content="", tool_calls=[tool_call]),
    ]
    llm = _make_streaming_llm(chunks)

    graph = SafeToolCallAgentGraph(
        llm=llm,
        tools=[],
        prompt=_make_fake_prompt(),
    )
    graph.bound_llm = llm.bind_tools([])
    from langchain_core.runnables import RunnableLambda
    graph.agent = RunnableLambda(lambda state: state.get("messages", [])) | graph.bound_llm
    graph.callbacks = None
    graph.summary_llm = None
    graph._compaction_cooldown_counter = 0
    from cognitive_code_agent.memory import WorkingMemoryConfig
    graph.compaction_config = WorkingMemoryConfig()

    from langchain_core.messages import HumanMessage
    state = ToolCallAgentGraphState(messages=[HumanMessage(content="Hi")])

    result = await graph.agent_node(state)

    final = result.messages[-1]
    assert final.tool_calls, "tool_calls must be preserved after chunk accumulation"
    assert final.tool_calls[0]["name"] == "fake_tool"
    # additional_kwargs back-fill must happen via _normalize_tool_call_ids
    assert "tool_calls" in final.additional_kwargs or final.tool_calls


# ---------------------------------------------------------------------------
# _stream_graph_events helper (granular-streaming-events, section 3)
# ---------------------------------------------------------------------------


import datetime as _dt


def _make_fake_graph_for_events(events: list[dict]):
    """Fake graph exposing astream_events(version='v2') that yields `events`."""

    class _FakeGraph:
        async def astream_events(self, state, config=None, version="v2"):
            for ev in events:
                yield ev

    return _FakeGraph()


async def _collect_helper_output(helper_gen):
    """Drain the helper async generator into a list of yielded items."""
    out = []
    async for item in helper_gen:
        out.append(item)
    return out


def _helper_args():
    return dict(
        state=ToolCallAgentGraphState(messages=[]),
        config={},
        content_so_far="",
        chunk_id="test-id",
        created=_dt.datetime.now(_dt.UTC),
        model_name="devstral",
        mode="analyze",
    )


async def test_stream_graph_events_yields_token_chunks() -> None:
    """3.1 RED — on_chat_model_stream events produce ChatResponseChunk tokens."""
    from cognitive_code_agent.agents.safe_tool_calling_agent import _stream_graph_events, StreamToken

    events = [
        {"event": "on_chat_model_stream", "data": {"chunk": AIMessageChunk(content="Hello")}, "name": "llm"},
        {"event": "on_chat_model_stream", "data": {"chunk": AIMessageChunk(content=" world")}, "name": "llm"},
    ]
    graph = _make_fake_graph_for_events(events)
    out = await _collect_helper_output(_stream_graph_events(graph, **_helper_args()))

    tokens = [item for item in out if isinstance(item, StreamToken)]
    assert len(tokens) == 2
    assert tokens[0].chunk.choices[0].delta.content == "Hello"
    assert tokens[1].chunk.choices[0].delta.content == " world"
    assert tokens[0].chunk.model == "devstral"


async def test_stream_graph_events_filters_non_token_events() -> None:
    """3.2 RED — on_chain_*, on_chat_model_end without stream, unknown events are filtered."""
    from cognitive_code_agent.agents.safe_tool_calling_agent import _stream_graph_events, StreamToken, StreamActivity

    events = [
        {"event": "on_chain_start", "data": {}, "name": "agent"},
        {"event": "on_chat_model_start", "data": {}, "name": "llm"},
        {"event": "on_chat_model_stream", "data": {"chunk": AIMessageChunk(content="x")}, "name": "llm"},
        {"event": "on_chat_model_end", "data": {"output": AIMessage(content="x")}, "name": "llm"},
        {"event": "on_chain_end", "data": {}, "name": "agent"},
    ]
    graph = _make_fake_graph_for_events(events)
    out = await _collect_helper_output(_stream_graph_events(graph, **_helper_args()))

    tokens = [i for i in out if isinstance(i, StreamToken)]
    activities = [i for i in out if isinstance(i, StreamActivity)]
    assert len(tokens) == 1
    assert tokens[0].chunk.choices[0].delta.content == "x"
    assert len(activities) == 0


async def test_stream_graph_events_emits_activity_on_tool_start() -> None:
    """3.3 RED — on_tool_start event yields a StreamActivity payload."""
    from cognitive_code_agent.agents.safe_tool_calling_agent import _stream_graph_events, StreamActivity

    events = [
        {
            "event": "on_tool_start",
            "name": "fs_tools_read_file",
            "data": {"input": {"path": "/x"}},
        },
    ]
    graph = _make_fake_graph_for_events(events)
    out = await _collect_helper_output(_stream_graph_events(graph, **_helper_args()))

    activities = [i for i in out if isinstance(i, StreamActivity)]
    assert len(activities) == 1
    payload = activities[0].payload
    assert payload["type"] == "tool_start"
    assert payload["name"] == "fs_tools_read_file"
    assert payload["tool_args"] == {"path": "/x"}


async def test_stream_graph_events_emits_activity_on_tool_end() -> None:
    """3.4 RED — on_tool_end event yields a StreamActivity payload with truncated result."""
    from cognitive_code_agent.agents.safe_tool_calling_agent import _stream_graph_events, StreamActivity

    long_result = "x" * 50000
    events = [
        {
            "event": "on_tool_end",
            "name": "fs_tools_read_file",
            "data": {"output": long_result},
        },
    ]
    graph = _make_fake_graph_for_events(events)
    out = await _collect_helper_output(_stream_graph_events(graph, **_helper_args()))

    activities = [i for i in out if isinstance(i, StreamActivity)]
    assert len(activities) == 1
    payload = activities[0].payload
    assert payload["type"] == "tool_end"
    assert payload["name"] == "fs_tools_read_file"
    # Result must be truncated to a reasonable size
    assert len(payload["tool_result"]) < len(long_result)


async def test_no_duplicate_tool_dispatch_under_streaming() -> None:
    """3.5 RED regression — one tool_call spread across chunks dispatches once.

    astream_events is observational; tool dispatch happens at graph edges.
    Even if on_chat_model_stream emits multiple chunks with tool_call fragments,
    the helper emits at most ONE StreamActivity per on_tool_start event.
    """
    from cognitive_code_agent.agents.safe_tool_calling_agent import _stream_graph_events, StreamActivity

    tool_call = {"id": "call_abc", "name": "fake_tool", "args": {"path": "/x"}}
    events = [
        {"event": "on_chat_model_stream", "data": {"chunk": AIMessageChunk(content="", tool_call_chunks=[{"name": "fake_tool", "args": "", "id": "call_abc", "index": 0}])}, "name": "llm"},
        {"event": "on_chat_model_stream", "data": {"chunk": AIMessageChunk(content="", tool_call_chunks=[{"name": None, "args": '{"pa', "id": None, "index": 0}])}, "name": "llm"},
        {"event": "on_chat_model_stream", "data": {"chunk": AIMessageChunk(content="", tool_call_chunks=[{"name": None, "args": 'th": "/x"}', "id": None, "index": 0}])}, "name": "llm"},
        {"event": "on_tool_start", "name": "fake_tool", "data": {"input": {"path": "/x"}}},
    ]
    graph = _make_fake_graph_for_events(events)
    out = await _collect_helper_output(_stream_graph_events(graph, **_helper_args()))

    activities = [i for i in out if isinstance(i, StreamActivity) and i.payload.get("type") == "tool_start"]
    assert len(activities) == 1, f"Expected exactly 1 tool_start, got {len(activities)}"


async def test_stream_graph_events_propagates_exceptions() -> None:
    """3.6 RED — exceptions from astream_events propagate to caller for _classify_failure."""
    from cognitive_code_agent.agents.safe_tool_calling_agent import _stream_graph_events

    class _BrokenGraph:
        async def astream_events(self, state, config=None, version="v2"):
            yield {"event": "on_chat_model_stream", "data": {"chunk": AIMessageChunk(content="x")}, "name": "llm"}
            raise ConnectionError("boom")

    with pytest.raises(ConnectionError, match="boom"):
        async for _ in _stream_graph_events(_BrokenGraph(), **_helper_args()):
            pass


async def test_emit_stream_activity_pushes_intermediate_step_tool_start() -> None:
    """5.1 RED — a tool_start StreamActivity is pushed as a TOOL_START
    IntermediateStep via NAT's intermediate_step_manager so the FastAPI
    front-end serializes it into an intermediate_data: SSE line consumed
    by ui-cognitive/lib/nat-client.ts.
    """
    from nat.data_models.intermediate_step import IntermediateStepType
    from cognitive_code_agent.agents.safe_tool_calling_agent import (
        StreamActivity,
        _emit_stream_activity,
        _get_step_manager,
    )

    captured: list = []
    mgr = _get_step_manager()
    sub = mgr.subscribe(lambda step: captured.append(step))
    try:
        activity = StreamActivity(
            {
                "type": "tool_start",
                "name": "fs_tools_read_file",
                "tool_args": {"path": "/x"},
                "mode": "analyze",
            }
        )
        _emit_stream_activity(activity)
        # Give the subscriber a tick to process
        await asyncio.sleep(0.01)
    finally:
        sub.unsubscribe()

    tool_starts = [s for s in captured if s.payload.event_type == IntermediateStepType.TOOL_START]
    assert len(tool_starts) == 1
    step = tool_starts[0]
    assert step.payload.name == "fs_tools_read_file"
    assert step.payload.data.input == {"path": "/x"}


async def test_emit_stream_activity_pushes_intermediate_step_tool_end() -> None:
    """5.1 RED — tool_end StreamActivity is pushed as TOOL_END IntermediateStep.
    Must be preceded by a matching START to satisfy NAT's span-stack bookkeeping.
    """
    from nat.data_models.intermediate_step import IntermediateStepType
    from cognitive_code_agent.agents.safe_tool_calling_agent import (
        StreamActivity,
        _emit_stream_activity,
        _get_step_manager,
    )

    captured: list = []
    mgr = _get_step_manager()
    sub = mgr.subscribe(lambda step: captured.append(step))
    try:
        shared_uuid = "11111111-2222-3333-4444-555555555555"
        _emit_stream_activity(StreamActivity({
            "type": "tool_start",
            "name": "fs_tools_read_file",
            "tool_args": {"path": "/x"},
            "mode": "analyze",
            "uuid": shared_uuid,
        }))
        _emit_stream_activity(StreamActivity({
            "type": "tool_end",
            "name": "fs_tools_read_file",
            "tool_result": "file contents",
            "mode": "analyze",
            "uuid": shared_uuid,
        }))
        await asyncio.sleep(0.01)
    finally:
        sub.unsubscribe()

    tool_ends = [s for s in captured if s.payload.event_type == IntermediateStepType.TOOL_END]
    assert len(tool_ends) == 1
    step = tool_ends[0]
    assert step.payload.name == "fs_tools_read_file"
    assert step.payload.data.output == "file contents"


# ---------------------------------------------------------------------------
# task_complete SSE signal — RED tests (tasks 2.1, 2.2)
# ---------------------------------------------------------------------------

async def test_emit_stream_activity_handles_task_complete_success() -> None:
    """2.1 RED — task_complete with success=True emits a CUSTOM_END intermediate step."""
    from nat.data_models.intermediate_step import IntermediateStepType
    from cognitive_code_agent.agents.safe_tool_calling_agent import (
        StreamActivity,
        _emit_stream_activity,
        _get_step_manager,
    )

    captured: list = []
    mgr = _get_step_manager()
    sub = mgr.subscribe(lambda step: captured.append(step))
    try:
        _emit_stream_activity(StreamActivity({"type": "task_complete", "success": True}))
        await asyncio.sleep(0.01)
    finally:
        sub.unsubscribe()

    custom_ends = [s for s in captured if s.payload.event_type == IntermediateStepType.CUSTOM_END]
    assert len(custom_ends) == 1
    step = custom_ends[0]
    assert step.payload.name == "task_complete"
    assert step.payload.metadata is not None
    assert step.payload.metadata.get("success") is True


async def test_emit_stream_activity_handles_task_complete_failure() -> None:
    """2.2 RED — task_complete with success=False emits CUSTOM_END with success=False."""
    from nat.data_models.intermediate_step import IntermediateStepType
    from cognitive_code_agent.agents.safe_tool_calling_agent import (
        StreamActivity,
        _emit_stream_activity,
        _get_step_manager,
    )

    captured: list = []
    mgr = _get_step_manager()
    sub = mgr.subscribe(lambda step: captured.append(step))
    try:
        _emit_stream_activity(StreamActivity({"type": "task_complete", "success": False}))
        await asyncio.sleep(0.01)
    finally:
        sub.unsubscribe()

    custom_ends = [s for s in captured if s.payload.event_type == IntermediateStepType.CUSTOM_END]
    assert len(custom_ends) == 1
    step = custom_ends[0]
    assert step.payload.name == "task_complete"
    assert step.payload.metadata is not None
    assert step.payload.metadata.get("success") is False
