"""Integration test for mid-loop context compaction in SafeToolCallAgentGraph.

Verifies that when a LangGraph state exceeds the compaction threshold inside
agent_node, the summary LLM is called, the state is compressed, and a
context_compacted trace event is emitted.
"""

from __future__ import annotations

import pytest
from langchain_core.messages import AIMessage
from langchain_core.messages import HumanMessage
from langchain_core.messages import ToolMessage
from nat.agent.tool_calling_agent.agent import ToolCallAgentGraphState

from cognitive_code_agent.agents.safe_tool_calling_agent import SafeToolCallAgentGraph
from cognitive_code_agent.memory import WorkingMemoryConfig

pytestmark = pytest.mark.integration


class _FakeSummaryLLM:
    """Deterministic summary LLM that records calls."""

    def __init__(self) -> None:
        self.calls: list[str] = []

    async def ainvoke(self, prompt: str) -> str:
        self.calls.append(prompt)
        return "Summary: agent explored repo, found 3 issues in module X."


class _FakeReasoningLLM:
    """Minimal LLM that returns a final answer without tool calls."""

    async def ainvoke(self, messages: object, **kwargs: object) -> AIMessage:
        return AIMessage(content="Analysis complete.")

    def bind_tools(self, tools: list) -> object:
        from langchain_core.runnables import RunnableLambda

        async def _invoke(messages_dict: object, **kw: object) -> AIMessage:
            return AIMessage(content="Analysis complete.")

        return RunnableLambda(_invoke)


def _build_oversize_state(n: int = 20) -> ToolCallAgentGraphState:
    """Build a state with n tool cycles — designed to exceed thresholds."""
    msgs: list = [HumanMessage(content="Analyze the ART repository")]
    for i in range(n):
        msgs.append(AIMessage(content=f"Calling tool iteration {i}", tool_calls=[]))
        msgs.append(
            ToolMessage(
                content=f"Result {i}: " + ("x" * 500),  # inflate size
                tool_call_id=f"call_{i}",
            )
        )
    return ToolCallAgentGraphState(messages=msgs)


async def test_agent_node_compacts_when_threshold_exceeded(monkeypatch) -> None:
    """agent_node compresses state and emits trace event when over threshold."""
    emitted: list[dict] = []

    def _capture_event(event_type: str, payload: dict) -> None:
        emitted.append({"event_type": event_type, **payload})

    import cognitive_code_agent.agents.safe_tool_calling_agent as agent_module

    monkeypatch.setattr(agent_module, "_emit_trace_event", _capture_event)

    summary_llm = _FakeSummaryLLM()
    compaction_config = WorkingMemoryConfig(
        compaction_char_threshold=100,  # very low to force trigger
        compaction_message_threshold=5,  # very low to force trigger
        compaction_retain_recent=2,
        compaction_cooldown_messages=0,  # no cooldown in test
    )

    graph = SafeToolCallAgentGraph(
        llm=_FakeReasoningLLM(),
        tools=[],
        summary_llm=summary_llm,
        compaction_config=compaction_config,
    )

    state = _build_oversize_state(n=10)
    original_count = len(state.messages)

    result = await graph.agent_node(state)

    # State should be compressed
    assert len(result.messages) < original_count

    # Summary LLM was called
    assert len(summary_llm.calls) >= 1

    # context_compacted trace event was emitted
    compaction_events = [e for e in emitted if e["event_type"] == "context_compacted"]
    assert len(compaction_events) == 1
    event = compaction_events[0]
    assert "messages_before" in event
    assert "messages_after" in event
    assert event["messages_before"] > event["messages_after"]


async def test_agent_node_skips_compaction_when_no_summary_llm() -> None:
    """agent_node leaves state untouched when summary_llm is None."""
    graph = SafeToolCallAgentGraph(
        llm=_FakeReasoningLLM(),
        tools=[],
        summary_llm=None,
    )
    state = _build_oversize_state(n=5)
    original_count = len(state.messages)

    result = await graph.agent_node(state)

    # One message was appended (the LLM response), but no compaction happened
    assert len(result.messages) == original_count + 1


async def test_agent_node_respects_cooldown(monkeypatch) -> None:
    """agent_node does not compact twice in a row when cooldown is active."""
    summary_llm = _FakeSummaryLLM()
    compaction_config = WorkingMemoryConfig(
        compaction_char_threshold=10,  # always triggers
        compaction_message_threshold=2,  # always triggers
        compaction_retain_recent=1,
        compaction_cooldown_messages=5,  # 5 calls between compactions
    )

    graph = SafeToolCallAgentGraph(
        llm=_FakeReasoningLLM(),
        tools=[],
        summary_llm=summary_llm,
        compaction_config=compaction_config,
    )

    state = _build_oversize_state(n=10)

    # First call — should compact
    await graph.agent_node(state)
    calls_after_first = len(summary_llm.calls)
    assert calls_after_first >= 1

    # Second call immediately — cooldown should block compaction
    await graph.agent_node(state)
    assert len(summary_llm.calls) == calls_after_first
