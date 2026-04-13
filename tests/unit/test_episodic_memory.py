"""Unit tests for episodic memory manager.

Tests cover: session summary persistence, search, graceful degradation
when Redis is unavailable, and metadata structure.
"""

from __future__ import annotations

from typing import Any

import pytest

from cognitive_code_agent.memory.episodic import EpisodicMemoryManager


pytestmark = pytest.mark.unit


# ---------------------------------------------------------------------------
# Fakes
# ---------------------------------------------------------------------------


class _FakeLLM:
    """LLM that returns a deterministic session summary."""

    def __init__(self, response: str = "Session summary: analyzed repo X.") -> None:
        self._response = response
        self.calls: list[str] = []

    async def ainvoke(self, prompt: str) -> str:
        self.calls.append(prompt)
        return self._response


class _FailingLLM:
    async def ainvoke(self, prompt: str) -> str:
        raise RuntimeError("LLM down")


class _FakeRedisEditor:
    """In-memory mock of NAT's RedisEditor for unit testing."""

    def __init__(self) -> None:
        self.stored_items: list[Any] = []
        self.search_results: list[Any] = []

    async def add_items(self, items: list[Any]) -> None:
        self.stored_items.extend(items)

    async def search(self, query: str, top_k: int = 5, **kwargs: Any) -> list[Any]:
        return self.search_results[:top_k]


class _FailingRedisEditor:
    """RedisEditor that simulates Redis being down."""

    async def add_items(self, items: list[Any]) -> None:
        raise ConnectionError("Redis connection refused")

    async def search(self, query: str, top_k: int = 5, **kwargs: Any) -> list[Any]:
        raise ConnectionError("Redis connection refused")


# ---------------------------------------------------------------------------
# persist_session_summary
# ---------------------------------------------------------------------------


class TestPersistSessionSummary:
    async def test_persists_summary_with_correct_metadata(self) -> None:
        editor = _FakeRedisEditor()
        llm = _FakeLLM("Analyzed repo acme/api, found 3 critical vulns.")
        manager = EpisodicMemoryManager(editor=editor, llm=llm, ttl_days=90)

        messages = [
            {"role": "human", "content": "Analyze acme/api for security"},
            {"role": "assistant", "content": "Running semgrep..."},
            {"role": "assistant", "content": "Found 3 critical vulnerabilities."},
        ]

        await manager.persist_session_summary(
            messages=messages,
            session_id="sess-001",
            repo_id="acme/api",
            tools_used=["run_semgrep", "run_bandit"],
            findings_count=3,
            outcome="completed",
        )

        assert len(editor.stored_items) == 1
        item = editor.stored_items[0]
        assert item.memory is not None
        assert "acme/api" in item.memory
        assert item.user_id == "session:sess-001"
        assert "session-summary" in item.tags
        assert "repo:acme/api" in item.tags
        assert item.metadata["session_id"] == "sess-001"
        assert item.metadata["repo_id"] == "acme/api"
        assert item.metadata["outcome"] == "completed"
        assert item.metadata["findings_count"] == 3
        assert item.metadata["tools_used"] == ["run_semgrep", "run_bandit"]
        assert "timestamp" in item.metadata

    async def test_persists_with_empty_repo_id(self) -> None:
        editor = _FakeRedisEditor()
        llm = _FakeLLM("General discussion session.")
        manager = EpisodicMemoryManager(editor=editor, llm=llm, ttl_days=90)

        await manager.persist_session_summary(
            messages=[{"role": "human", "content": "Hello"}],
            session_id="sess-002",
            repo_id="",
            tools_used=[],
            findings_count=0,
            outcome="completed",
        )

        assert len(editor.stored_items) == 1
        item = editor.stored_items[0]
        assert "repo:" not in " ".join(item.tags)

    async def test_llm_failure_does_not_raise(self) -> None:
        editor = _FakeRedisEditor()
        llm = _FailingLLM()
        manager = EpisodicMemoryManager(editor=editor, llm=llm, ttl_days=90)

        # Should not raise, should degrade gracefully
        await manager.persist_session_summary(
            messages=[{"role": "human", "content": "Test"}],
            session_id="sess-003",
            repo_id="",
            tools_used=[],
            findings_count=0,
            outcome="error",
        )

        # Nothing persisted because summary generation failed
        assert len(editor.stored_items) == 0

    async def test_redis_failure_does_not_raise(self) -> None:
        editor = _FailingRedisEditor()
        llm = _FakeLLM("Summary text.")
        manager = EpisodicMemoryManager(editor=editor, llm=llm, ttl_days=90)

        # Should not raise
        await manager.persist_session_summary(
            messages=[{"role": "human", "content": "Test"}],
            session_id="sess-004",
            repo_id="test-repo",
            tools_used=[],
            findings_count=0,
            outcome="completed",
        )

    async def test_empty_messages_does_not_persist(self) -> None:
        editor = _FakeRedisEditor()
        llm = _FakeLLM()
        manager = EpisodicMemoryManager(editor=editor, llm=llm, ttl_days=90)

        await manager.persist_session_summary(
            messages=[],
            session_id="sess-005",
            repo_id="",
            tools_used=[],
            findings_count=0,
            outcome="completed",
        )

        assert len(editor.stored_items) == 0


# ---------------------------------------------------------------------------
# search_relevant_sessions
# ---------------------------------------------------------------------------


class TestSearchRelevantSessions:
    async def test_returns_search_results(self) -> None:
        from nat.memory.models import MemoryItem

        editor = _FakeRedisEditor()
        editor.search_results = [
            MemoryItem(
                user_id="session:old-sess",
                memory="Analyzed acme/api last week.",
                tags=["session-summary"],
                metadata={"session_id": "old-sess", "outcome": "completed"},
            )
        ]
        llm = _FakeLLM()
        manager = EpisodicMemoryManager(editor=editor, llm=llm, ttl_days=90)

        results = await manager.search_relevant_sessions(
            query="acme/api security",
            max_results=5,
        )

        assert len(results) == 1
        assert results[0].memory == "Analyzed acme/api last week."

    async def test_empty_results_on_no_matches(self) -> None:
        editor = _FakeRedisEditor()
        editor.search_results = []
        llm = _FakeLLM()
        manager = EpisodicMemoryManager(editor=editor, llm=llm, ttl_days=90)

        results = await manager.search_relevant_sessions(query="something", max_results=5)
        assert results == []

    async def test_redis_failure_returns_empty_list(self) -> None:
        editor = _FailingRedisEditor()
        llm = _FakeLLM()
        manager = EpisodicMemoryManager(editor=editor, llm=llm, ttl_days=90)

        results = await manager.search_relevant_sessions(query="test", max_results=5)
        assert results == []
