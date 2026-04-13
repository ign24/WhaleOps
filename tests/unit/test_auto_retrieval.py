"""Unit tests for automatic memory retrieval at session start.

Tests cover: parallel queries, timeout behavior, similarity filtering,
empty results, disabled sources, and memory block composition.
"""

from __future__ import annotations

import asyncio
from typing import Any

import pytest

from cognitive_code_agent.memory.retrieval import AutoMemoryRetriever, compose_memory_block


pytestmark = pytest.mark.unit


# ---------------------------------------------------------------------------
# Fakes
# ---------------------------------------------------------------------------


class _FakeEpisodicManager:
    """Returns canned session summaries."""

    def __init__(self, results: list[dict[str, Any]] | None = None, delay: float = 0) -> None:
        self._results = results or []
        self._delay = delay

    async def search_relevant_sessions(
        self, query: str, *, max_results: int = 5, user_id: str = ""
    ) -> list[Any]:
        if self._delay:
            await asyncio.sleep(self._delay)
        return self._results


class _FakeFindingsSearcher:
    """Returns canned findings results."""

    def __init__(self, results: list[dict[str, Any]] | None = None, delay: float = 0) -> None:
        self._results = results or []
        self._delay = delay

    async def search(self, query: str, *, top_k: int = 3) -> list[dict[str, Any]]:
        if self._delay:
            await asyncio.sleep(self._delay)
        return self._results


class _FailingEpisodicManager:
    async def search_relevant_sessions(self, query: str, **kwargs: Any) -> list[Any]:
        raise ConnectionError("Redis down")


class _FailingFindingsSearcher:
    async def search(self, query: str, **kwargs: Any) -> list[dict[str, Any]]:
        raise ConnectionError("Milvus down")


class _FakeSemanticSearcher:
    def __init__(self, results: list[dict[str, Any]] | None = None, delay: float = 0) -> None:
        self._results = results or []
        self._delay = delay

    async def search(self, query: str, *, top_k: int = 3) -> list[dict[str, Any]]:
        if self._delay:
            await asyncio.sleep(self._delay)
        return self._results


# ---------------------------------------------------------------------------
# compose_memory_block
# ---------------------------------------------------------------------------


class TestComposeMemoryBlock:
    def test_empty_results_returns_empty_string(self) -> None:
        block = compose_memory_block(episodic_results=[], findings_results=[])
        assert block == ""

    def test_episodic_only(self) -> None:
        block = compose_memory_block(
            episodic_results=[{"summary": "Analyzed repo X last week.", "score": 0.8}],
            findings_results=[],
        )
        assert "[Memory Context" in block
        assert "Previous Sessions" in block
        assert "Analyzed repo X last week." in block
        assert "Past Findings" not in block

    def test_findings_only(self) -> None:
        block = compose_memory_block(
            episodic_results=[],
            findings_results=[
                {"summary": "SQL injection in db.py", "severity": "critical", "score": 0.9}
            ],
        )
        assert "[Memory Context" in block
        assert "Past Findings" in block
        assert "SQL injection" in block
        assert "Previous Sessions" not in block

    def test_both_sources(self) -> None:
        block = compose_memory_block(
            episodic_results=[{"summary": "Session about security review.", "score": 0.7}],
            findings_results=[{"summary": "XSS vulnerability", "severity": "high", "score": 0.85}],
        )
        assert "Previous Sessions" in block
        assert "Past Findings" in block

    def test_semantic_section(self) -> None:
        block = compose_memory_block(
            episodic_results=[],
            findings_results=[],
            semantic_results=[
                {"summary": "Validate all external input.", "confidence": 0.7, "score": 0.8}
            ],
        )
        assert "Domain Knowledge" in block
        assert "Validate all external input" in block


# ---------------------------------------------------------------------------
# AutoMemoryRetriever.retrieve_context
# ---------------------------------------------------------------------------


class TestAutoMemoryRetriever:
    async def test_returns_block_with_both_sources(self) -> None:
        retriever = AutoMemoryRetriever(
            episodic_manager=_FakeEpisodicManager(
                results=[{"summary": "Past session data.", "score": 0.8}]
            ),
            findings_searcher=_FakeFindingsSearcher(
                results=[{"summary": "Old finding.", "severity": "medium", "score": 0.7}]
            ),
            timeout_seconds=2,
            include_episodic=True,
            include_findings=True,
        )
        block = await retriever.retrieve_context("analyze my repo")
        assert "Previous Sessions" in block
        assert "Past Findings" in block

    async def test_disabled_episodic_skips_it(self) -> None:
        retriever = AutoMemoryRetriever(
            episodic_manager=_FakeEpisodicManager(
                results=[{"summary": "Should not appear.", "score": 0.9}]
            ),
            findings_searcher=_FakeFindingsSearcher(
                results=[{"summary": "Finding.", "severity": "low", "score": 0.6}]
            ),
            timeout_seconds=2,
            include_episodic=False,
            include_findings=True,
        )
        block = await retriever.retrieve_context("test")
        assert "Previous Sessions" not in block
        assert "Past Findings" in block

    async def test_disabled_findings_skips_it(self) -> None:
        retriever = AutoMemoryRetriever(
            episodic_manager=_FakeEpisodicManager(results=[{"summary": "Session.", "score": 0.7}]),
            findings_searcher=_FakeFindingsSearcher(
                results=[{"summary": "Should not appear.", "severity": "high", "score": 0.9}]
            ),
            timeout_seconds=2,
            include_episodic=True,
            include_findings=False,
        )
        block = await retriever.retrieve_context("test")
        assert "Previous Sessions" in block
        assert "Past Findings" not in block

    async def test_both_disabled_returns_empty(self) -> None:
        retriever = AutoMemoryRetriever(
            episodic_manager=_FakeEpisodicManager(),
            findings_searcher=_FakeFindingsSearcher(),
            timeout_seconds=2,
            include_episodic=False,
            include_findings=False,
        )
        block = await retriever.retrieve_context("test")
        assert block == ""

    async def test_slow_source_is_abandoned_on_timeout(self) -> None:
        retriever = AutoMemoryRetriever(
            episodic_manager=_FakeEpisodicManager(
                results=[{"summary": "Slow.", "score": 0.9}], delay=5.0
            ),
            findings_searcher=_FakeFindingsSearcher(
                results=[{"summary": "Fast finding.", "severity": "low", "score": 0.6}]
            ),
            timeout_seconds=0.1,
            include_episodic=True,
            include_findings=True,
        )
        block = await retriever.retrieve_context("test")
        # Episodic timed out, findings should still be present
        assert "Past Findings" in block
        assert "Fast finding." in block

    async def test_all_sources_fail_returns_empty(self) -> None:
        retriever = AutoMemoryRetriever(
            episodic_manager=_FailingEpisodicManager(),
            findings_searcher=_FailingFindingsSearcher(),
            timeout_seconds=2,
            include_episodic=True,
            include_findings=True,
        )
        block = await retriever.retrieve_context("test")
        assert block == ""

    async def test_similarity_filtering_excludes_low_scores(self) -> None:
        retriever = AutoMemoryRetriever(
            episodic_manager=_FakeEpisodicManager(
                results=[
                    {"summary": "Relevant.", "score": 0.8},
                    {"summary": "Irrelevant.", "score": 0.3},
                ]
            ),
            findings_searcher=_FakeFindingsSearcher(),
            timeout_seconds=2,
            include_episodic=True,
            include_findings=False,
            similarity_threshold=0.5,
        )
        block = await retriever.retrieve_context("test")
        assert "Relevant." in block
        assert "Irrelevant." not in block

    async def test_semantic_enabled_adds_domain_knowledge_section(self) -> None:
        retriever = AutoMemoryRetriever(
            episodic_manager=_FakeEpisodicManager(),
            findings_searcher=_FakeFindingsSearcher(),
            semantic_searcher=_FakeSemanticSearcher(
                results=[{"summary": "Use prepared statements", "confidence": 0.6, "score": 0.9}]
            ),
            timeout_seconds=2,
            include_episodic=False,
            include_findings=False,
            include_semantic=True,
        )
        block = await retriever.retrieve_context("db safety")
        assert "Domain Knowledge" in block
        assert "prepared statements" in block.lower()
