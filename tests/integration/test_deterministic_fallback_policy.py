from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest
from langchain_core.messages import AIMessage
from langchain_core.messages import ToolMessage
from nat.data_models.api_server import ChatRequestOrMessage

import cognitive_code_agent.agents.safe_tool_calling_agent as workflow_module
from cognitive_code_agent.agents.safe_tool_calling_agent import SafeToolCallAgentWorkflowConfig
from cognitive_code_agent.agents.safe_tool_calling_agent import safe_tool_calling_agent_workflow


pytestmark = pytest.mark.integration


def test_recursion_fallback_returns_structured_partial(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeCompiledGraph:
        async def astream(self, *_args, **_kwargs):
            raise workflow_module.GraphRecursionError("recursion budget")
            yield

        async def ainvoke(self, *_args, **_kwargs):
            raise workflow_module.GraphRecursionError("recursion budget")

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

    async def run() -> str:
        config = SafeToolCallAgentWorkflowConfig.model_validate(
            {"tool_names": ["fake_tool"], "llm_name": "devstral"}
        )
        async with safe_tool_calling_agent_workflow(config, FakeBuilder()) as function_info:
            chunks = []
            async for chunk in function_info.stream_fn(
                ChatRequestOrMessage(input_message="analiza")
            ):
                piece = chunk.choices[0].delta.content
                if piece:
                    chunks.append(piece)
            return "\n".join(chunks)

    result = asyncio.run(run())
    assert "## Verified" in result
    assert "## Unverified" in result
    assert "## Blocked By" in result
    assert "## Next Steps" in result


def test_analyze_mode_evidence_gate_marks_unconfirmed(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeCompiledGraph:
        async def astream(self, *_args, **_kwargs):
            raise RuntimeError("stream failed")
            yield

        async def ainvoke(self, *_args, **_kwargs):
            return {
                "messages": [AIMessage(content="- Potential vulnerability in authentication flow")]
            }

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

    async def run() -> str:
        config = SafeToolCallAgentWorkflowConfig.model_validate(
            {
                "tool_names": ["fake_tool"],
                "llm_name": "devstral",
                "modes": {
                    "analyze": {
                        "llm_name": "devstral",
                        "prompt_path": "src/cognitive_code_agent/prompts/system/analyze.md",
                        "tool_names": ["fake_tool"],
                        "max_iterations": 4,
                        "max_history": 4,
                        "tool_call_timeout_seconds": 30,
                    }
                },
            }
        )
        async with safe_tool_calling_agent_workflow(config, FakeBuilder()) as function_info:
            chunks = []
            async for chunk in function_info.stream_fn(
                ChatRequestOrMessage(input_message="analiza")
            ):
                piece = chunk.choices[0].delta.content
                if piece:
                    chunks.append(piece)
            return "\n".join(chunks)

    result = asyncio.run(run())
    assert "unconfirmed" in result


def test_nested_reader_agent_recursion_payload_is_filtered_and_continues(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeCompiledGraph:
        async def astream(self, *_args, **_kwargs):
            raise RuntimeError("stream failed")
            yield

        async def ainvoke(self, *_args, **_kwargs):
            return {
                "messages": [
                    AIMessage(
                        content=(
                            "- GraphRecursionError: Recursion limit of 14 reached in reader_agent\n"
                            "- Potential vulnerability in app/auth.py:18 (tool: semgrep)"
                        )
                    )
                ]
            }

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

    async def run() -> str:
        config = SafeToolCallAgentWorkflowConfig.model_validate(
            {"tool_names": ["fake_tool"], "llm_name": "devstral"}
        )
        async with safe_tool_calling_agent_workflow(config, FakeBuilder()) as function_info:
            chunks = []
            async for chunk in function_info.stream_fn(
                ChatRequestOrMessage(input_message="analiza")
            ):
                piece = chunk.choices[0].delta.content
                if piece:
                    chunks.append(piece)
            return "\n".join(chunks)

    result = asyncio.run(run())
    assert "GraphRecursionError" not in result
    assert "app/auth.py:18" in result


def test_stream_fallback_handles_terminal_tool_message_state(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeCompiledGraph:
        async def astream(self, state, *_args, **_kwargs):
            state.messages.append(
                ToolMessage(
                    name="spawn_agent", tool_call_id="call_1", status="error", content="blocked"
                )
            )
            raise RuntimeError("stream failed")
            yield

        async def ainvoke(self, state, *_args, **_kwargs):
            # Regression simulator: old flow failed when trailing message was ToolMessage
            if isinstance(state.messages[-1], ToolMessage):
                raise RuntimeError("'ToolMessage' object has no attribute 'tool_calls'")
            return {"messages": [AIMessage(content="Recovered safely")]}

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

    async def run() -> str:
        config = SafeToolCallAgentWorkflowConfig.model_validate(
            {"tool_names": ["fake_tool"], "llm_name": "devstral"}
        )
        async with safe_tool_calling_agent_workflow(config, FakeBuilder()) as function_info:
            chunks = []
            async for chunk in function_info.stream_fn(
                ChatRequestOrMessage(input_message="analiza")
            ):
                piece = chunk.choices[0].delta.content
                if piece:
                    chunks.append(piece)
            return "\n".join(chunks)

    result = asyncio.run(run())
    assert "Recovered safely" in result
    assert "could not be completed due to a processing error" not in result.lower()


def test_ainvoke_fallback_failure_returns_structured_sections(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeCompiledGraph:
        async def astream(self, *_args, **_kwargs):
            raise RuntimeError("stream failed")
            yield

        async def ainvoke(self, *_args, **_kwargs):
            raise RuntimeError("Tool call blocked: 'spawn_agent' reached per-request limit (4)")

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

    async def run() -> str:
        config = SafeToolCallAgentWorkflowConfig.model_validate(
            {"tool_names": ["fake_tool"], "llm_name": "devstral"}
        )
        async with safe_tool_calling_agent_workflow(config, FakeBuilder()) as function_info:
            chunks = []
            async for chunk in function_info.stream_fn(
                ChatRequestOrMessage(input_message="analiza")
            ):
                piece = chunk.choices[0].delta.content
                if piece:
                    chunks.append(piece)
            return "\n".join(chunks)

    result = asyncio.run(run())
    assert "## Verified" in result
    assert "## Unverified" in result
    assert "## Blocked By" in result
    assert "## Next Steps" in result
    assert "processing error" not in result.lower()


# ---------------------------------------------------------------------------
# Compact-and-continue recovery loop integration tests
# ---------------------------------------------------------------------------


def test_recovery_loop_compacts_and_retries_on_recursion_with_progress(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When stream raises GraphRecursionError and state has progress,
    the recovery loop compacts and the recovery ainvoke succeeds."""
    call_count = 0

    class FakeCompiledGraph:
        async def astream(self, state, *_args, **_kwargs):
            # Inject progress into state before raising
            state.messages.append(ToolMessage(content="x" * 100, tool_call_id="call_progress_1"))
            raise workflow_module.GraphRecursionError("recursion budget")
            yield  # noqa: unreachable — makes this an async generator

        async def ainvoke(self, state, *_args, **_kwargs):
            nonlocal call_count
            call_count += 1
            # Recovery ainvoke succeeds
            msgs = list(getattr(state, "messages", []))
            msgs.append(AIMessage(content="Recovery analysis complete."))
            return {"messages": msgs}

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

    async def run() -> str:
        config = SafeToolCallAgentWorkflowConfig.model_validate(
            {"tool_names": ["fake_tool"], "llm_name": "devstral"}
        )
        async with safe_tool_calling_agent_workflow(config, FakeBuilder()) as function_info:
            chunks = []
            async for chunk in function_info.stream_fn(
                ChatRequestOrMessage(input_message="analiza")
            ):
                piece = chunk.choices[0].delta.content
                if piece:
                    chunks.append(piece)
            return "\n".join(chunks)

    result = asyncio.run(run())
    assert "Recovery analysis complete" in result
    assert call_count >= 1


def test_recovery_loop_synthesis_on_no_progress(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When stream raises GraphRecursionError but no progress exists,
    synthesis fires immediately without recovery loop."""
    ainvoke_count = 0

    class FakeCompiledGraph:
        async def astream(self, *_args, **_kwargs):
            raise workflow_module.GraphRecursionError("recursion budget")
            yield

        async def ainvoke(self, state, *_args, **_kwargs):
            nonlocal ainvoke_count
            ainvoke_count += 1
            # Synthesis succeeds
            msgs = list(getattr(state, "messages", []))
            msgs.append(AIMessage(content="Synthesis summary."))
            return {"messages": msgs}

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

    async def run() -> str:
        config = SafeToolCallAgentWorkflowConfig.model_validate(
            {"tool_names": ["fake_tool"], "llm_name": "devstral"}
        )
        async with safe_tool_calling_agent_workflow(config, FakeBuilder()) as function_info:
            chunks = []
            async for chunk in function_info.stream_fn(
                ChatRequestOrMessage(input_message="analiza")
            ):
                piece = chunk.choices[0].delta.content
                if piece:
                    chunks.append(piece)
            return "\n".join(chunks)

    result = asyncio.run(run())
    assert "Synthesis summary" in result
    # Only 1 ainvoke (synthesis) — no recovery loop iterations
    assert ainvoke_count == 1


def test_recovery_loop_handles_context_overflow(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """CONTEXT_OVERFLOW is now retryable — recovery loop compacts and retries."""
    call_count = 0

    class FakeCompiledGraph:
        async def astream(self, state, *_args, **_kwargs):
            nonlocal call_count
            call_count += 1
            state.messages.append(ToolMessage(content="y" * 100, tool_call_id="call_data_1"))
            raise RuntimeError("maximum context length exceeded")
            yield

        async def ainvoke(self, state, *_args, **_kwargs):
            msgs = list(getattr(state, "messages", []))
            msgs.append(AIMessage(content="Recovered from context overflow."))
            return {"messages": msgs}

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

    async def run() -> str:
        config = SafeToolCallAgentWorkflowConfig.model_validate(
            {"tool_names": ["fake_tool"], "llm_name": "devstral"}
        )
        async with safe_tool_calling_agent_workflow(config, FakeBuilder()) as function_info:
            chunks = []
            async for chunk in function_info.stream_fn(
                ChatRequestOrMessage(input_message="analiza")
            ):
                piece = chunk.choices[0].delta.content
                if piece:
                    chunks.append(piece)
            return "\n".join(chunks)

    result = asyncio.run(run())
    assert "Recovered from context overflow" in result


def test_recovery_loop_max_rounds_exhausted_emits_synthesis(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When max_recovery_rounds exhausted, synthesis is emitted."""
    recovery_ainvoke_count = 0

    class FakeCompiledGraph:
        async def astream(self, state, *_args, **_kwargs):
            state.messages.append(ToolMessage(content="z" * 100, tool_call_id="call_prog_1"))
            raise workflow_module.GraphRecursionError("recursion budget")
            yield

        async def ainvoke(self, state, *_args, **_kwargs):
            nonlocal recovery_ainvoke_count
            recovery_ainvoke_count += 1
            msgs = list(getattr(state, "messages", []))
            # Check if this is a synthesis call (has synthesis instruction)
            if any("[Synthesis" in str(getattr(m, "content", "")) for m in msgs):
                msgs.append(AIMessage(content="Final synthesis after exhaustion."))
                return {"messages": msgs}
            # Recovery ainvoke also hits recursion
            raise workflow_module.GraphRecursionError("recursion budget again")

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

    async def run() -> str:
        config = SafeToolCallAgentWorkflowConfig.model_validate(
            {"tool_names": ["fake_tool"], "llm_name": "devstral"}
        )
        async with safe_tool_calling_agent_workflow(config, FakeBuilder()) as function_info:
            chunks = []
            async for chunk in function_info.stream_fn(
                ChatRequestOrMessage(input_message="analiza")
            ):
                piece = chunk.choices[0].delta.content
                if piece:
                    chunks.append(piece)
            return "\n".join(chunks)

    result = asyncio.run(run())
    assert "Final synthesis after exhaustion" in result
    # Recovery rounds used: default max_recovery_rounds=3
    assert recovery_ainvoke_count >= 2
