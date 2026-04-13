"""Unit tests for working memory summarization.

Tests cover: normal summarization, LLM failure graceful degradation,
empty input, cascading summaries, and the prepare_messages_with_summary helper.
"""

from __future__ import annotations

import pytest

from langchain_core.messages import AIMessage
from langchain_core.messages import HumanMessage
from langchain_core.messages import ToolMessage

from cognitive_code_agent.memory import WorkingMemoryConfig
from cognitive_code_agent.memory.working import (
    CONTEXT_SUMMARY_PREFIX,
    _find_pair_boundary,
    compress_state,
    prepare_messages_with_summary,
    repair_message_history,
    should_compact,
    summarize_evicted_messages,
)


pytestmark = pytest.mark.unit


# ---------------------------------------------------------------------------
# Fake LLM for testing
# ---------------------------------------------------------------------------


class _FakeLLM:
    """Deterministic LLM that returns a fixed summary."""

    def __init__(self, response: str = "Summary of evicted context.") -> None:
        self._response = response
        self.calls: list[str] = []

    async def ainvoke(self, prompt: str) -> str:
        self.calls.append(prompt)
        return self._response


class _FailingLLM:
    """LLM that always raises an exception."""

    async def ainvoke(self, prompt: str) -> str:
        raise RuntimeError("LLM unavailable")


# ---------------------------------------------------------------------------
# summarize_evicted_messages
# ---------------------------------------------------------------------------


class TestSummarizeEvictedMessages:
    async def test_returns_summary_from_llm(self) -> None:
        llm = _FakeLLM("The user asked about SQL injection in repo X.")
        messages = [
            {"role": "human", "content": "Analyze my repo for security issues"},
            {"role": "assistant", "content": "I'll run semgrep and bandit..."},
        ]
        result = await summarize_evicted_messages(messages, llm, max_tokens=200)
        assert result == "The user asked about SQL injection in repo X."
        assert len(llm.calls) == 1

    async def test_empty_messages_returns_empty_string(self) -> None:
        llm = _FakeLLM()
        result = await summarize_evicted_messages([], llm, max_tokens=200)
        assert result == ""
        assert len(llm.calls) == 0

    async def test_llm_failure_returns_empty_string(self) -> None:
        llm = _FailingLLM()
        messages = [
            {"role": "human", "content": "Hello"},
            {"role": "assistant", "content": "Hi there"},
        ]
        result = await summarize_evicted_messages(messages, llm, max_tokens=200)
        assert result == ""

    async def test_passes_max_tokens_in_prompt(self) -> None:
        llm = _FakeLLM("short summary")
        messages = [{"role": "human", "content": "Test message"}]
        await summarize_evicted_messages(messages, llm, max_tokens=150)
        assert "150" in llm.calls[0]

    async def test_includes_message_content_in_prompt(self) -> None:
        llm = _FakeLLM("summary")
        messages = [
            {"role": "human", "content": "Check repo acme/api"},
            {"role": "assistant", "content": "Found 3 vulnerabilities"},
        ]
        await summarize_evicted_messages(messages, llm, max_tokens=200)
        assert "acme/api" in llm.calls[0]
        assert "3 vulnerabilities" in llm.calls[0]


# ---------------------------------------------------------------------------
# prepare_messages_with_summary
# ---------------------------------------------------------------------------


class TestPrepareMessagesWithSummary:
    async def test_no_eviction_when_under_limit(self) -> None:
        llm = _FakeLLM()
        messages = [
            {"role": "system", "content": "You are an agent."},
            {"role": "human", "content": "Hello"},
            {"role": "assistant", "content": "Hi"},
        ]
        result = await prepare_messages_with_summary(messages, max_history=8, llm=llm, enabled=True)
        assert len(result) == 3
        assert len(llm.calls) == 0

    async def test_eviction_triggers_summary_insertion(self) -> None:
        llm = _FakeLLM("Earlier: user greeted and asked about repo X.")
        # system + 5 pairs = 11 messages, max_history=4 means evict some
        messages = [{"role": "system", "content": "You are an agent."}]
        for i in range(5):
            messages.append({"role": "human", "content": f"Question {i}"})
            messages.append({"role": "assistant", "content": f"Answer {i}"})

        result = await prepare_messages_with_summary(messages, max_history=4, llm=llm, enabled=True)
        # Should have: system + summary + last 4 non-system messages
        assert len(llm.calls) == 1
        summary_msgs = [
            m
            for m in result
            if isinstance(m.get("content", ""), str)
            and m.get("content", "").startswith(CONTEXT_SUMMARY_PREFIX)
        ]
        assert len(summary_msgs) == 1

    async def test_disabled_skips_summarization(self) -> None:
        llm = _FakeLLM()
        messages = [{"role": "system", "content": "sys"}]
        for i in range(10):
            messages.append({"role": "human", "content": f"Q{i}"})
            messages.append({"role": "assistant", "content": f"A{i}"})

        result = await prepare_messages_with_summary(
            messages, max_history=4, llm=llm, enabled=False
        )
        # No summary, just returns messages unchanged (trimming happens later)
        assert len(llm.calls) == 0
        assert result == messages

    async def test_cascading_summary_replaces_existing(self) -> None:
        llm = _FakeLLM("Combined: old context + new context.")
        # Messages already have a summary from previous eviction
        messages = [
            {"role": "system", "content": "You are an agent."},
            {"role": "assistant", "content": f"{CONTEXT_SUMMARY_PREFIX} Old summary here."},
            {"role": "human", "content": "Question A"},
            {"role": "assistant", "content": "Answer A"},
            {"role": "human", "content": "Question B"},
            {"role": "assistant", "content": "Answer B"},
            {"role": "human", "content": "Question C"},
            {"role": "assistant", "content": "Answer C"},
            {"role": "human", "content": "Question D"},
            {"role": "assistant", "content": "Answer D"},
        ]

        result = await prepare_messages_with_summary(messages, max_history=4, llm=llm, enabled=True)

        # Old summary should be included in LLM prompt for cascading
        assert "Old summary here." in llm.calls[0]

        # Only ONE summary message in result (not old + new)
        summary_msgs = [
            m
            for m in result
            if isinstance(m.get("content", ""), str)
            and m.get("content", "").startswith(CONTEXT_SUMMARY_PREFIX)
        ]
        assert len(summary_msgs) == 1
        assert "Combined" in summary_msgs[0]["content"]

    async def test_llm_failure_returns_messages_unchanged(self) -> None:
        llm = _FailingLLM()
        messages = [{"role": "system", "content": "sys"}]
        for i in range(10):
            messages.append({"role": "human", "content": f"Q{i}"})
            messages.append({"role": "assistant", "content": f"A{i}"})

        result = await prepare_messages_with_summary(messages, max_history=4, llm=llm, enabled=True)
        # On failure, returns original messages (trim_messages will handle later)
        assert result == messages


# ---------------------------------------------------------------------------
# should_compact
# ---------------------------------------------------------------------------


def _make_cfg(**kwargs) -> WorkingMemoryConfig:
    fields = {
        "compaction_char_threshold": 40000,
        "compaction_message_threshold": 30,
        "compaction_retain_recent": 8,
        "compaction_cooldown_messages": 10,
        "summary_max_tokens": 400,
        "summary_llm_name": None,
    }
    fields.update(kwargs)
    return WorkingMemoryConfig(**fields)


class TestShouldCompact:
    def test_false_when_under_both_thresholds(self) -> None:
        cfg = _make_cfg()
        messages = [HumanMessage(content="short")] * 5
        assert should_compact(messages, cfg) is False

    def test_true_when_message_count_exceeds_threshold(self) -> None:
        cfg = _make_cfg(compaction_message_threshold=5)
        messages = [HumanMessage(content="x")] * 6
        assert should_compact(messages, cfg) is True

    def test_true_when_char_count_exceeds_threshold(self) -> None:
        cfg = _make_cfg(compaction_char_threshold=100)
        # 5 messages, each with 25 chars → 125 total
        messages = [HumanMessage(content="a" * 25)] * 5
        assert should_compact(messages, cfg) is True

    def test_false_when_exactly_at_threshold(self) -> None:
        cfg = _make_cfg(compaction_message_threshold=5, compaction_char_threshold=100)
        messages = [HumanMessage(content="x")] * 5
        assert should_compact(messages, cfg) is False

    def test_empty_messages_returns_false(self) -> None:
        cfg = _make_cfg()
        assert should_compact([], cfg) is False


# ---------------------------------------------------------------------------
# compress_state — preservation guarantees
# ---------------------------------------------------------------------------


class TestCompressState:
    def _make_state(self, n_middle: int = 20) -> list:
        """Build a realistic state: user task + n tool cycles + recent messages."""
        msgs: list = [HumanMessage(content="Analyze the ART repository")]
        for i in range(n_middle):
            msgs.append(AIMessage(content=f"Calling tool {i}", tool_calls=[]))
            msgs.append(
                ToolMessage(
                    content=f"Result of tool {i}: some output data",
                    tool_call_id=f"call_{i}",
                )
            )
        return msgs

    async def test_user_message_always_preserved(self) -> None:
        cfg = _make_cfg()
        llm = _FakeLLM("summary of old tool calls")
        messages = self._make_state(20)
        result = await compress_state(messages, llm, cfg)
        assert result[0].content == "Analyze the ART repository"

    async def test_last_retain_recent_messages_preserved(self) -> None:
        cfg = _make_cfg(compaction_retain_recent=4)
        llm = _FakeLLM("summary")
        messages = self._make_state(10)
        result = await compress_state(messages, llm, cfg)
        # Last 4 messages of original must be last 4 of result
        assert result[-4:] == messages[-4:]

    async def test_error_tool_messages_preserved(self) -> None:
        cfg = _make_cfg(compaction_retain_recent=2)
        llm = _FakeLLM("summary")
        messages = [HumanMessage(content="task")]
        # Add error message in the middle
        messages.append(AIMessage(content="calling tool", tool_calls=[]))
        error_msg = ToolMessage(content="Error: tool failed", tool_call_id="call_0", status="error")
        messages.append(error_msg)
        # Add more messages to exceed retain
        for i in range(10):
            messages.append(AIMessage(content=f"msg {i}", tool_calls=[]))
        result = await compress_state(messages, llm, cfg)
        assert error_msg in result

    async def test_evicted_messages_replaced_by_summary_block(self) -> None:
        cfg = _make_cfg(compaction_retain_recent=2)
        llm = _FakeLLM("tools ran, found issues in module X")
        messages = self._make_state(10)
        result = await compress_state(messages, llm, cfg)
        summary_msgs = [
            m
            for m in result
            if isinstance(m, AIMessage) and str(m.content).startswith(CONTEXT_SUMMARY_PREFIX)
        ]
        assert len(summary_msgs) == 1

    async def test_message_count_reduced_after_compaction(self) -> None:
        cfg = _make_cfg(compaction_retain_recent=4)
        llm = _FakeLLM("summary")
        messages = self._make_state(15)  # 1 + 30 messages
        result = await compress_state(messages, llm, cfg)
        assert len(result) < len(messages)

    async def test_no_summary_llm_returns_unchanged(self) -> None:
        cfg = _make_cfg()
        messages = self._make_state(10)
        result = await compress_state(messages, None, cfg)
        assert result == messages

    async def test_nothing_to_evict_returns_unchanged(self) -> None:
        cfg = _make_cfg(compaction_retain_recent=20)
        llm = _FakeLLM("summary")
        messages = self._make_state(5)  # fewer than retain_recent
        result = await compress_state(messages, llm, cfg)
        assert result == messages


# ---------------------------------------------------------------------------
# compress_state — failure path
# ---------------------------------------------------------------------------


class TestCompressStateFailure:
    async def test_llm_exception_returns_original_state(self) -> None:
        cfg = _make_cfg(compaction_retain_recent=2)
        llm = _FailingLLM()
        messages = [HumanMessage(content="task")]
        for i in range(15):
            messages.append(AIMessage(content=f"step {i}", tool_calls=[]))
        result = await compress_state(messages, llm, cfg)
        assert result == messages


def _make_ai_with_calls(*call_ids: str) -> AIMessage:
    """Build an AIMessage with the given tool call IDs."""
    return AIMessage(
        content="calling tools",
        tool_calls=[{"id": cid, "name": "some_tool", "args": {}} for cid in call_ids],
    )


def _make_tool_result(call_id: str) -> ToolMessage:
    return ToolMessage(content=f"result for {call_id}", tool_call_id=call_id)


# ---------------------------------------------------------------------------
# _find_pair_boundary
# ---------------------------------------------------------------------------


class TestFindPairBoundary:
    def test_no_split_returns_naive_boundary(self) -> None:
        # All pairs fully in middle — no split
        msgs = [
            HumanMessage(content="task"),  # anchor
            _make_ai_with_calls("call_0"),  # middle
            _make_tool_result("call_0"),  # middle
            AIMessage(content="done", tool_calls=[]),  # recent
            AIMessage(content="final", tool_calls=[]),  # recent
        ]
        boundary = _find_pair_boundary(msgs, retain_recent=2)
        assert boundary == 3  # naive = 5 - 2

    def test_tool_message_at_boundary_expands(self) -> None:
        # ToolMessage is first message of recent window but its AIMessage is in middle
        msgs = [
            HumanMessage(content="task"),  # anchor [0]
            AIMessage(content="step1", tool_calls=[]),  # middle [1]
            _make_ai_with_calls("call_0"),  # middle [2]
            _make_tool_result("call_0"),  # naive boundary [3] — ToolMessage, AIMessage at [2]
            AIMessage(content="step3", tool_calls=[]),  # recent [4]
        ]
        # naive boundary = 5 - 2 = 3. messages[3] is ToolMessage("call_0"),
        # its AIMessage is at [2] which is in middle → must expand to 2
        boundary = _find_pair_boundary(msgs, retain_recent=2)
        assert boundary == 2

    def test_ai_message_at_end_of_middle_expands(self) -> None:
        # AIMessage with tool_calls is last message of middle; its result is in recent
        msgs = [
            HumanMessage(content="task"),  # anchor [0]
            AIMessage(content="step1", tool_calls=[]),  # middle [1]
            _make_ai_with_calls("call_0"),  # last of middle [2]
            _make_tool_result("call_0"),  # recent[0] [3]
            AIMessage(content="done", tool_calls=[]),  # recent[1] [4]
        ]
        # naive boundary = 3. messages[2] (last of middle) is AIMessage with call_0,
        # messages[3] (in recent) is its result → must expand to 2
        boundary = _find_pair_boundary(msgs, retain_recent=2)
        assert boundary == 2

    def test_expansion_cap_applied(self) -> None:
        # Build a long chain of interleaved pairs at the boundary to force cap
        # retain_recent=2, cap = retain_recent*2 = 4 slots from end at most
        msgs = [HumanMessage(content="task")]  # [0]
        for i in range(8):
            msgs.append(_make_ai_with_calls(f"call_{i}"))
            msgs.append(_make_tool_result(f"call_{i}"))
        # 1 + 16 = 17 messages, all AIMessage/ToolMessage pairs interleaved
        # naive boundary = 17 - 2 = 15
        # Scenario: all of messages[15:] are ToolMessages or AIMessages needing expansion
        # The cap should limit expansion to naive - retain_recent = 15 - 2 = 13
        boundary = _find_pair_boundary(msgs, retain_recent=2)
        # Cap means we can't go below naive - retain_recent*2 = 15 - 4 = 11
        naive = 17 - 2
        cap = max(1, naive - 2 * 2)  # retain_recent * 2 = 4 extra
        assert boundary >= cap

    def test_multiple_pairs_at_boundary_expands_all(self) -> None:
        # Two consecutive ToolMessages at boundary, both need expansion
        msgs = [
            HumanMessage(content="task"),  # [0]
            AIMessage(content="s0", tool_calls=[]),  # [1] middle
            _make_ai_with_calls("call_0", "call_1"),  # [2] middle — has 2 calls
            _make_tool_result("call_0"),  # [3] naive boundary
            _make_tool_result("call_1"),  # [4] recent
            AIMessage(content="done", tool_calls=[]),  # [5] recent
        ]
        # retain_recent=3, naive = 6-3 = 3
        # messages[3] is ToolMessage("call_0"), its AIMessage at [2] is in middle
        boundary = _find_pair_boundary(msgs, retain_recent=3)
        assert boundary == 2


# ---------------------------------------------------------------------------
# compress_state — message pair preservation
# ---------------------------------------------------------------------------


class TestCompressStatePairPreservation:
    async def test_no_orphaned_tool_call_ids_after_compaction(self) -> None:
        """After compaction, every ToolMessage must have its AIMessage in retained."""
        cfg = _make_cfg(compaction_retain_recent=3)
        llm = _FakeLLM("summary text")

        msgs = [
            HumanMessage(content="task"),  # anchor
            _make_ai_with_calls("call_A"),  # evictable middle
            _make_tool_result("call_A"),  # evictable middle
            _make_ai_with_calls("call_B"),  # split boundary risk
            _make_tool_result("call_B"),  # retain_recent starts here
            AIMessage(content="thinking", tool_calls=[]),
            AIMessage(content="final", tool_calls=[]),
        ]
        result = await compress_state(msgs, llm, cfg)

        # Collect all tool_call_id values from ToolMessages in result
        tool_call_ids_in_result = {
            getattr(m, "tool_call_id", None) for m in result if isinstance(m, ToolMessage)
        }
        tool_call_ids_in_result.discard(None)

        # For each ToolMessage, its AIMessage must have a matching tool_calls entry
        for tm in result:
            if not isinstance(tm, ToolMessage):
                continue
            tid = getattr(tm, "tool_call_id", None)
            has_matching_ai = any(
                isinstance(m, AIMessage)
                and any(
                    (tc.get("id") if isinstance(tc, dict) else getattr(tc, "id", None)) == tid
                    for tc in (getattr(m, "tool_calls", None) or [])
                )
                for m in result
            )
            assert has_matching_ai, f"Orphaned ToolMessage with tool_call_id={tid}"

    async def test_compacted_result_has_no_orphaned_ai_tool_calls(self) -> None:
        """After compaction, every tool_calls entry in AIMessages must have its ToolMessage."""
        cfg = _make_cfg(compaction_retain_recent=2)
        llm = _FakeLLM("summary")

        msgs = [
            HumanMessage(content="task"),
            AIMessage(content="step1", tool_calls=[]),
            AIMessage(content="step2", tool_calls=[]),
            AIMessage(content="step3", tool_calls=[]),
            AIMessage(content="step4", tool_calls=[]),
            AIMessage(content="step5", tool_calls=[]),
            _make_ai_with_calls("call_Z"),
            _make_tool_result("call_Z"),
            AIMessage(content="final", tool_calls=[]),
        ]
        result = await compress_state(msgs, llm, cfg)

        result_tool_msg_ids = {
            getattr(m, "tool_call_id", None) for m in result if isinstance(m, ToolMessage)
        }

        for m in result:
            if not isinstance(m, AIMessage):
                continue
            for tc in getattr(m, "tool_calls", None) or []:
                cid = tc.get("id") if isinstance(tc, dict) else getattr(tc, "id", None)
                if cid:
                    assert cid in result_tool_msg_ids, (
                        f"AIMessage has tool_calls entry id={cid} with no matching ToolMessage"
                    )


# ---------------------------------------------------------------------------
# repair_message_history
# ---------------------------------------------------------------------------


class TestRepairMessageHistory:
    def test_no_orphans_returns_unchanged(self) -> None:
        msgs = [
            HumanMessage(content="task"),
            _make_ai_with_calls("call_0"),
            _make_tool_result("call_0"),
        ]
        result, changed = repair_message_history(msgs)
        assert changed is False
        assert result == msgs

    def test_orphaned_tool_message_removed(self) -> None:
        orphaned_tm = _make_tool_result("call_orphan")
        msgs = [
            HumanMessage(content="task"),
            AIMessage(content="no calls", tool_calls=[]),
            orphaned_tm,
            AIMessage(content="final", tool_calls=[]),
        ]
        result, changed = repair_message_history(msgs)
        assert changed is True
        assert orphaned_tm not in result

    def test_orphaned_tool_call_entry_stripped_from_ai_message(self) -> None:
        ai_with_orphan = _make_ai_with_calls("call_orphan")
        msgs = [
            HumanMessage(content="task"),
            ai_with_orphan,
            # No ToolMessage with tool_call_id="call_orphan"
            AIMessage(content="final", tool_calls=[]),
        ]
        result, changed = repair_message_history(msgs)
        assert changed is True
        # The AIMessage with the orphaned call should have the call removed
        for m in result:
            if isinstance(m, AIMessage):
                for tc in getattr(m, "tool_calls", None) or []:
                    cid = tc.get("id") if isinstance(tc, dict) else getattr(tc, "id", None)
                    assert cid != "call_orphan"

    def test_mixed_valid_and_orphaned_calls_only_orphan_removed(self) -> None:
        # AIMessage has two calls: one valid, one orphan
        ai_msg = AIMessage(
            content="calling",
            tool_calls=[
                {"id": "call_valid", "name": "tool_a", "args": {}},
                {"id": "call_orphan", "name": "tool_b", "args": {}},
            ],
        )
        tm_valid = _make_tool_result("call_valid")
        msgs = [
            HumanMessage(content="task"),
            ai_msg,
            tm_valid,
            AIMessage(content="final", tool_calls=[]),
        ]
        result, changed = repair_message_history(msgs)
        assert changed is True
        # The AIMessage should still be in result, but only with call_valid
        repaired_ai = next(
            (m for m in result if isinstance(m, AIMessage) and m.content == "calling"), None
        )
        assert repaired_ai is not None
        remaining_ids = {
            tc.get("id") if isinstance(tc, dict) else getattr(tc, "id", None)
            for tc in (getattr(repaired_ai, "tool_calls", None) or [])
        }
        assert "call_valid" in remaining_ids
        assert "call_orphan" not in remaining_ids

    def test_paired_entries_untouched(self) -> None:
        ai = _make_ai_with_calls("call_0")
        tm = _make_tool_result("call_0")
        msgs = [HumanMessage(content="task"), ai, tm, AIMessage(content="done", tool_calls=[])]
        result, changed = repair_message_history(msgs)
        assert changed is False
        assert ai in result
        assert tm in result
