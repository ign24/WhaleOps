"""Episodic memory manager for cross-session conversation persistence.

Wraps NAT's RedisEditor to persist session summaries and retrieve
relevant past sessions by vector similarity search.

Prerequisites:
- Redis Stack (redis/redis-stack-server) with RediSearch + RedisJSON modules
- Index created via ``ensure_index_exists()`` before first search
"""

from __future__ import annotations

import logging
import time
from typing import Any

from nat.memory.models import MemoryItem

logger = logging.getLogger(__name__)

_SESSION_SUMMARY_PROMPT = """Summarize this conversation session in 2-3 sentences.
Include: main topics discussed, repos analyzed (if any), tools used, key outcomes.
Be concise and factual.

Conversation:
{messages_text}

Summary:"""

_SESSION_USER_PREFIX = "session:"
_SEARCH_USER_ID = "session:*"


def _format_messages(messages: list[dict[str, Any]]) -> str:
    """Format message dicts into readable text for the LLM."""
    parts: list[str] = []
    for msg in messages:
        role = msg.get("role", "unknown")
        content = str(msg.get("content", ""))
        if content:
            parts.append(f"[{role}]: {content}")
    return "\n".join(parts)


class EpisodicMemoryManager:
    """Manages cross-session episodic memories via NAT's RedisEditor."""

    def __init__(self, editor: Any, llm: Any, ttl_days: int = 90) -> None:
        self._editor = editor
        self._llm = llm
        self._ttl_days = ttl_days

    async def persist_session_summary(
        self,
        *,
        messages: list[dict[str, Any]],
        session_id: str,
        repo_id: str = "",
        tools_used: list[str] | None = None,
        findings_count: int = 0,
        outcome: str = "completed",
    ) -> None:
        """Generate and persist a session summary as an episodic memory."""
        if not messages:
            return

        messages_text = _format_messages(messages)
        prompt = _SESSION_SUMMARY_PROMPT.format(messages_text=messages_text)

        try:
            summary = await self._llm.ainvoke(prompt)
            summary = str(summary).strip()
        except Exception:
            logger.warning(
                "episodic_memory: failed to generate session summary",
                exc_info=True,
            )
            return

        if not summary:
            return

        tags = ["session-summary"]
        if repo_id:
            tags.append(f"repo:{repo_id}")

        metadata: dict[str, Any] = {
            "session_id": session_id,
            "repo_id": repo_id,
            "timestamp": int(time.time()),
            "outcome": outcome,
            "findings_count": findings_count,
            "tools_used": list(tools_used or []),
        }

        item = MemoryItem(
            user_id=f"{_SESSION_USER_PREFIX}{session_id}",
            memory=summary,
            tags=tags,
            metadata=metadata,
            conversation=messages[:10],
        )

        try:
            await self._editor.add_items([item])
            logger.info(
                "episodic_memory: persisted session summary session_id=%s repo_id=%s",
                session_id,
                repo_id,
            )
        except Exception:
            logger.warning(
                "episodic_memory: failed to persist session summary to Redis",
                exc_info=True,
            )

    async def search_relevant_sessions(
        self,
        query: str,
        *,
        max_results: int = 5,
        user_id: str = "",
    ) -> list[MemoryItem]:
        """Search past session summaries by vector similarity."""
        try:
            search_user = user_id or _SEARCH_USER_ID
            results = await self._editor.search(
                query=query,
                top_k=max_results,
                user_id=search_user,
            )
            return results
        except Exception:
            logger.warning(
                "episodic_memory: search failed, returning empty results",
                exc_info=True,
            )
            return []
