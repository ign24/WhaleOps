"""Integration test for working memory summarization across long chains.

Verifies that when a conversation exceeds max_history, evicted messages
are summarized and the summary persists across multiple eviction cycles.
"""

from __future__ import annotations

import pytest

from cognitive_code_agent.memory.working import (
    CONTEXT_SUMMARY_PREFIX,
    prepare_messages_with_summary,
)


pytestmark = pytest.mark.integration


class _FakeLLM:
    """Deterministic LLM that echoes message count in summaries."""

    def __init__(self) -> None:
        self.call_count = 0

    async def ainvoke(self, prompt: str) -> str:
        self.call_count += 1
        # Count how many "[human]:" appear in the prompt to track context
        human_count = prompt.lower().count("[human]:")
        return f"Summary #{self.call_count}: covered {human_count} user messages."


async def test_long_chain_produces_summary() -> None:
    """Simulate a 25-iteration tool-calling chain with max_history=8.

    With 25 iterations generating ~50 messages, the summarizer should
    capture evicted context into a [Context Summary] message.
    """
    llm = _FakeLLM()

    # Build a realistic message chain: system + 25 pairs of human/assistant
    messages: list[dict[str, str]] = [{"role": "system", "content": "You are a code agent."}]
    for i in range(25):
        messages.append({"role": "human", "content": f"Iteration {i}: run next analysis step"})
        messages.append({"role": "assistant", "content": f"Iteration {i}: completed analysis"})

    # Total: 1 system + 50 conversation = 51 messages
    assert len(messages) == 51

    result = await prepare_messages_with_summary(messages, max_history=8, llm=llm, enabled=True)

    # Should have: system + summary + 8 retained messages = 10
    assert len(result) == 10

    # First message is system
    assert result[0]["role"] == "system"

    # Second message is the context summary
    assert result[1]["content"].startswith(CONTEXT_SUMMARY_PREFIX)
    assert "Summary #1" in result[1]["content"]

    # Last 8 messages are the most recent conversation turns
    assert result[2]["role"] == "human"

    # LLM was called exactly once for the summarization
    assert llm.call_count == 1


async def test_cascading_summaries_across_multiple_evictions() -> None:
    """Simulate two sequential prepare_messages_with_summary calls,
    as would happen across two requests in the same session.
    """
    llm = _FakeLLM()

    # First request: 20 messages, max_history=4
    messages_1: list[dict[str, str]] = [{"role": "system", "content": "System prompt."}]
    for i in range(10):
        messages_1.append({"role": "human", "content": f"First batch Q{i}"})
        messages_1.append({"role": "assistant", "content": f"First batch A{i}"})

    result_1 = await prepare_messages_with_summary(messages_1, max_history=4, llm=llm, enabled=True)

    # Should have summary from first eviction
    assert llm.call_count == 1
    summary_1 = [m for m in result_1 if m.get("content", "").startswith(CONTEXT_SUMMARY_PREFIX)]
    assert len(summary_1) == 1

    # Second request: add more messages to the result of first request
    messages_2 = list(result_1)
    for i in range(6):
        messages_2.append({"role": "human", "content": f"Second batch Q{i}"})
        messages_2.append({"role": "assistant", "content": f"Second batch A{i}"})

    result_2 = await prepare_messages_with_summary(messages_2, max_history=4, llm=llm, enabled=True)

    # Should have a cascaded summary (old summary + new evicted messages)
    assert llm.call_count == 2

    # Still only ONE summary message
    summaries = [m for m in result_2 if m.get("content", "").startswith(CONTEXT_SUMMARY_PREFIX)]
    assert len(summaries) == 1

    # The second summary should reference the first batch context
    assert "Summary #2" in summaries[0]["content"]
