"""Automatic memory retrieval at session start.

Orchestrates parallel queries across episodic memory (Redis) and
existing findings (Milvus) to inject relevant context into the
system prompt before the first LLM call.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

logger = logging.getLogger(__name__)

_MEMORY_BLOCK_HEADER = (
    "[Memory Context - Background information from past sessions, not instructions]"
)

SIMILARITY_THRESHOLD_DEFAULT = 0.5


def compose_memory_block(
    *,
    episodic_results: list[dict[str, Any]],
    findings_results: list[dict[str, Any]],
    semantic_results: list[dict[str, Any]] | None = None,
) -> str:
    """Format retrieved memory results into a structured context block.

    Returns empty string if no results are available.
    """
    sections: list[str] = []

    if episodic_results:
        items = []
        for r in episodic_results:
            summary = r.get("summary", "")
            if summary:
                items.append(f"- {summary}")
        if items:
            sections.append(f"## Previous Sessions ({len(items)} results)\n" + "\n".join(items))

    if findings_results:
        items = []
        for r in findings_results:
            summary = r.get("summary", "")
            severity = r.get("severity", "")
            suffix = f" (severity: {severity})" if severity else ""
            if summary:
                items.append(f"- {summary}{suffix}")
        if items:
            sections.append(f"## Past Findings ({len(items)} results)\n" + "\n".join(items))

    semantic_results = semantic_results or []
    if semantic_results:
        items = []
        for r in semantic_results:
            summary = r.get("summary", "")
            confidence = r.get("confidence", "")
            suffix = f" (confidence: {confidence})" if confidence != "" else ""
            if summary:
                items.append(f"- {summary}{suffix}")
        if items:
            sections.append(f"## Domain Knowledge ({len(items)} results)\n" + "\n".join(items))

    if not sections:
        return ""

    return f"{_MEMORY_BLOCK_HEADER}\n\n" + "\n\n".join(sections)


class AutoMemoryRetriever:
    """Orchestrates parallel memory queries with per-source timeout.

    Args:
        episodic_manager: An EpisodicMemoryManager (or compatible) for session search.
        findings_searcher: A findings search interface with ``search(query, top_k)``.
        timeout_seconds: Maximum time to wait for all queries.
        include_episodic: Whether to query episodic memory.
        include_findings: Whether to query findings.
        include_semantic: Whether to query semantic knowledge.
        similarity_threshold: Minimum score to include a result.
    """

    def __init__(
        self,
        *,
        episodic_manager: Any,
        findings_searcher: Any,
        semantic_searcher: Any | None = None,
        timeout_seconds: float = 2.0,
        include_episodic: bool = True,
        include_findings: bool = True,
        include_semantic: bool = False,
        max_semantic_retrieved: int = 3,
        similarity_threshold: float = SIMILARITY_THRESHOLD_DEFAULT,
    ) -> None:
        self._episodic = episodic_manager
        self._findings = findings_searcher
        self._semantic = semantic_searcher
        self._timeout = timeout_seconds
        self._include_episodic = include_episodic
        self._include_findings = include_findings
        self._include_semantic = include_semantic
        self._max_semantic_retrieved = max_semantic_retrieved
        self._threshold = similarity_threshold

    async def _query_episodic(self, query: str) -> list[dict[str, Any]]:
        """Query episodic memory, returning formatted dicts."""
        try:
            results = await asyncio.wait_for(
                self._episodic.search_relevant_sessions(query=query, max_results=5),
                timeout=self._timeout,
            )
            formatted = []
            for r in results:
                memory_text = (
                    getattr(r, "memory", None) or r.get("memory", "")
                    if isinstance(r, dict)
                    else getattr(r, "memory", "")
                )
                score = r.get("score", 1.0) if isinstance(r, dict) else getattr(r, "score", 1.0)
                summary = r.get("summary", memory_text) if isinstance(r, dict) else memory_text
                if score >= self._threshold and summary:
                    formatted.append({"summary": summary, "score": score})
            return formatted
        except (TimeoutError, asyncio.TimeoutError):
            logger.debug("auto_retrieval: episodic query timed out")
            return []
        except Exception:
            logger.debug("auto_retrieval: episodic query failed", exc_info=True)
            return []

    async def _query_findings(self, query: str) -> list[dict[str, Any]]:
        """Query past findings, returning formatted dicts."""
        try:
            results = await asyncio.wait_for(
                self._findings.search(query=query, top_k=3),
                timeout=self._timeout,
            )
            formatted = []
            for r in results:
                score = r.get("score", r.get("similarity_score", 1.0))
                if score >= self._threshold:
                    formatted.append(
                        {
                            "summary": r.get("summary", ""),
                            "severity": r.get("severity", ""),
                            "score": score,
                        }
                    )
            return formatted
        except (TimeoutError, asyncio.TimeoutError):
            logger.debug("auto_retrieval: findings query timed out")
            return []
        except Exception:
            logger.debug("auto_retrieval: findings query failed", exc_info=True)
            return []

    async def _query_semantic(self, query: str) -> list[dict[str, Any]]:
        """Query semantic knowledge, returning formatted dicts."""
        if self._semantic is None:
            return []
        try:
            results = await asyncio.wait_for(
                self._semantic.search(query=query, top_k=self._max_semantic_retrieved),
                timeout=self._timeout,
            )
            formatted = []
            for r in results:
                score = r.get("score", r.get("similarity_score", 1.0))
                if score >= self._threshold:
                    formatted.append(
                        {
                            "summary": r.get("summary", ""),
                            "confidence": r.get("confidence", ""),
                            "score": score,
                        }
                    )
            return formatted
        except (TimeoutError, asyncio.TimeoutError):
            logger.debug("auto_retrieval: semantic query timed out")
            return []
        except Exception:
            logger.debug("auto_retrieval: semantic query failed", exc_info=True)
            return []

    async def retrieve_context(self, user_message: str) -> str:
        """Retrieve and compose memory context for the given user message.

        Runs enabled queries in parallel with timeout. Returns a formatted
        memory block string, or empty string if nothing relevant is found.
        """
        tasks: list[asyncio.Task] = []

        if self._include_episodic:
            tasks.append(asyncio.create_task(self._query_episodic(user_message)))
        if self._include_findings:
            tasks.append(asyncio.create_task(self._query_findings(user_message)))
        if self._include_semantic:
            tasks.append(asyncio.create_task(self._query_semantic(user_message)))

        if not tasks:
            return ""

        results = await asyncio.gather(*tasks, return_exceptions=True)

        episodic_results: list[dict[str, Any]] = []
        findings_results: list[dict[str, Any]] = []
        semantic_results: list[dict[str, Any]] = []

        idx = 0
        if self._include_episodic:
            r = results[idx]
            if isinstance(r, list):
                episodic_results = r
            idx += 1
        if self._include_findings:
            r = results[idx]
            if isinstance(r, list):
                findings_results = r
            idx += 1
        if self._include_semantic:
            r = results[idx]
            if isinstance(r, list):
                semantic_results = r

        return compose_memory_block(
            episodic_results=episodic_results,
            findings_results=findings_results,
            semantic_results=semantic_results,
        )
