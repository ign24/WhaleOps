"""Redis-backed cache layer for findings embeddings and query results.

This module provides :class:`FindingsCache` — a thin wrapper around Redis that
caches two kinds of data:

1. **Embedding vectors** (key prefix ``emb:``) — avoids redundant NIM API calls
   when the same text is embedded more than once (e.g. re-scanning the same
   repo).  Default TTL: 7 days.
2. **Query results** (key prefix ``qr:``) — caches the full JSON response of
   ``query_findings`` so repeated identical queries hit Redis instead of Milvus.
   Default TTL: 1 hour.

The cache is **100 % optional**.  If Redis is unavailable (down, misconfigured,
or not deployed) every method degrades gracefully — it logs a warning and
returns ``None`` so callers fall through to the primary data path.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

# Default TTLs (seconds)
EMBEDDING_TTL = 7 * 24 * 3600  # 7 days
QUERY_RESULT_TTL = 3600  # 1 hour

# Key prefixes
_EMB_PREFIX = "emb:"
_QR_PREFIX = "qr:"


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


class FindingsCache:
    """Graceful Redis cache for embeddings and query results.

    Parameters
    ----------
    redis_url:
        Redis connection URL.  Defaults to ``$REDIS_URL`` or
        ``redis://redis:6379/0``.
    embedding_ttl:
        TTL in seconds for cached embedding vectors.
    query_result_ttl:
        TTL in seconds for cached query results.
    """

    def __init__(
        self,
        redis_url: str = "",
        embedding_ttl: int = EMBEDDING_TTL,
        query_result_ttl: int = QUERY_RESULT_TTL,
    ) -> None:
        self._url = redis_url or os.getenv("REDIS_URL", "redis://redis:6379/0")
        self._embedding_ttl = embedding_ttl
        self._query_result_ttl = query_result_ttl
        self._client: Any | None = None
        self._available: bool | None = None  # tri-state: None = untested

    # ------------------------------------------------------------------
    # Lazy connection
    # ------------------------------------------------------------------

    def _get_client(self) -> Any | None:
        """Return a connected Redis client, or ``None`` if unavailable."""
        if self._available is False:
            return None

        if self._client is not None:
            return self._client

        try:
            import redis as redis_lib

            client = redis_lib.Redis.from_url(
                self._url,
                decode_responses=False,
                socket_connect_timeout=2,
                socket_timeout=2,
            )
            client.ping()
            self._client = client
            self._available = True
            logger.info("cache=redis status=connected url=%s", self._url)
            return client
        except Exception as exc:
            self._available = False
            logger.warning("cache=redis status=unavailable reason=%s", exc)
            return None

    # ------------------------------------------------------------------
    # Embedding cache
    # ------------------------------------------------------------------

    def get_embedding(self, text: str) -> list[float] | None:
        """Look up a cached embedding vector for *text*.

        Returns ``None`` on cache miss or if Redis is unavailable.
        """
        client = self._get_client()
        if client is None:
            return None
        try:
            key = f"{_EMB_PREFIX}{_sha256(text)}"
            raw = client.get(key)
            if raw is None:
                return None
            return json.loads(raw)
        except Exception as exc:
            logger.warning("cache=redis op=get_embedding error=%s", exc)
            return None

    def set_embedding(self, text: str, vector: list[float]) -> None:
        """Cache an embedding vector for *text* with TTL."""
        client = self._get_client()
        if client is None:
            return
        try:
            key = f"{_EMB_PREFIX}{_sha256(text)}"
            client.setex(key, self._embedding_ttl, json.dumps(vector))
        except Exception as exc:
            logger.warning("cache=redis op=set_embedding error=%s", exc)

    async def get_or_embed(
        self,
        embedder: Any,
        texts: list[str],
        embed_fn: Any,
    ) -> list[list[float]]:
        """Return embeddings for *texts*, using cache where possible.

        For each text that has a cached vector, the cache value is used.
        Remaining texts are embedded via *embed_fn(embedder, uncached_texts)*
        and the results are stored in cache for future use.

        Parameters
        ----------
        embedder:
            The embedder object (passed to *embed_fn*).
        texts:
            List of strings to embed.
        embed_fn:
            Async callable ``(embedder, texts) -> list[list[float]]``.
        """
        results: list[list[float] | None] = []
        uncached_indices: list[int] = []
        uncached_texts: list[str] = []

        for i, text in enumerate(texts):
            cached = self.get_embedding(text)
            if cached is not None:
                results.append(cached)
            else:
                results.append(None)
                uncached_indices.append(i)
                uncached_texts.append(text)

        if uncached_texts:
            fresh_vectors = await embed_fn(embedder, uncached_texts)
            for idx, text, vector in zip(uncached_indices, uncached_texts, fresh_vectors):
                results[idx] = vector
                self.set_embedding(text, vector)

        return results  # type: ignore[return-value]

    # ------------------------------------------------------------------
    # Query result cache
    # ------------------------------------------------------------------

    @staticmethod
    def query_cache_key(
        query: str,
        repo_id: str = "",
        severity: str = "",
        finding_type: str = "",
        agent: str = "",
        top_k: int = 10,
    ) -> str:
        """Deterministic cache key for a query_findings call."""
        raw = f"{query}|{repo_id}|{severity}|{finding_type}|{agent}|{top_k}"
        return f"{_QR_PREFIX}{_sha256(raw)}"

    def get_query_result(self, cache_key: str) -> str | None:
        """Return cached query result JSON, or ``None`` on miss."""
        client = self._get_client()
        if client is None:
            return None
        try:
            raw = client.get(cache_key)
            if raw is None:
                return None
            return raw.decode("utf-8") if isinstance(raw, bytes) else raw
        except Exception as exc:
            logger.warning("cache=redis op=get_query_result error=%s", exc)
            return None

    def set_query_result(self, cache_key: str, result: str) -> None:
        """Cache a query result JSON string with TTL."""
        client = self._get_client()
        if client is None:
            return
        try:
            client.setex(
                cache_key,
                self._query_result_ttl,
                result.encode("utf-8") if isinstance(result, str) else result,
            )
        except Exception as exc:
            logger.warning("cache=redis op=set_query_result error=%s", exc)

    # ------------------------------------------------------------------
    # Invalidation
    # ------------------------------------------------------------------

    def invalidate_query_cache(self, repo_id: str = "") -> int:
        """Delete cached query results.

        If *repo_id* is empty, flushes ALL query result keys (prefix scan).
        Returns the number of keys deleted, or 0 on failure.
        """
        client = self._get_client()
        if client is None:
            return 0
        try:
            # SCAN for keys with the query-result prefix
            cursor, keys = 0, []
            pattern = f"{_QR_PREFIX}*"
            while True:
                cursor, batch = client.scan(cursor=cursor, match=pattern, count=200)
                keys.extend(batch)
                if cursor == 0:
                    break
            if keys:
                return client.delete(*keys)
            return 0
        except Exception as exc:
            logger.warning("cache=redis op=invalidate error=%s", exc)
            return 0
