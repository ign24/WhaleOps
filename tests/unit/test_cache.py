"""Unit tests for the Redis-backed findings cache.

All tests run without a real Redis instance by mocking the redis client
or testing the graceful-degradation path.
"""

from __future__ import annotations

import asyncio
import json
from unittest.mock import MagicMock

import pytest

from cognitive_code_agent.tools.cache import FindingsCache


pytestmark = pytest.mark.unit


# ---------------------------------------------------------------------------
# Graceful fallback when Redis is unavailable
# ---------------------------------------------------------------------------


def test_cache_graceful_fallback_on_redis_down() -> None:
    """When Redis is unreachable, methods must return None instead of raising."""
    cache = FindingsCache(redis_url="redis://nonexistent:9999/0")

    assert cache.get_embedding("some text") is None
    cache.set_embedding("some text", [1.0, 2.0])  # must not raise
    assert cache.get_query_result("qr:abc") is None
    cache.set_query_result("qr:abc", '{"status": "ok"}')  # must not raise
    assert cache.invalidate_query_cache() == 0


def test_cache_marks_unavailable_after_first_failure() -> None:
    """After the first connection failure, the cache must skip further attempts."""
    cache = FindingsCache(redis_url="redis://nonexistent:9999/0")

    # First call triggers connection attempt → fails → marks unavailable
    cache.get_embedding("text1")
    assert cache._available is False

    # Subsequent calls skip connection entirely (no exception retries)
    assert cache.get_embedding("text2") is None


# ---------------------------------------------------------------------------
# Embedding cache with mock Redis
# ---------------------------------------------------------------------------


def _make_cache_with_mock() -> tuple[FindingsCache, MagicMock]:
    cache = FindingsCache(redis_url="redis://mock:6379/0")
    mock_client = MagicMock()
    mock_client.ping.return_value = True
    cache._client = mock_client
    cache._available = True
    return cache, mock_client


def test_embedding_cache_miss() -> None:
    cache, mock_client = _make_cache_with_mock()
    mock_client.get.return_value = None

    result = cache.get_embedding("new text")
    assert result is None
    mock_client.get.assert_called_once()


def test_embedding_cache_hit() -> None:
    cache, mock_client = _make_cache_with_mock()
    vector = [1.0, 2.0, 3.0]
    mock_client.get.return_value = json.dumps(vector).encode()

    result = cache.get_embedding("cached text")
    assert result == vector


def test_embedding_set_calls_setex() -> None:
    cache, mock_client = _make_cache_with_mock()
    cache.set_embedding("text", [1.0, 2.0])
    mock_client.setex.assert_called_once()
    call_args = mock_client.setex.call_args
    assert call_args[0][1] == cache._embedding_ttl  # TTL


# ---------------------------------------------------------------------------
# Query result cache with mock Redis
# ---------------------------------------------------------------------------


def test_query_cache_key_deterministic() -> None:
    key1 = FindingsCache.query_cache_key("sql injection", "repo-1", "high")
    key2 = FindingsCache.query_cache_key("sql injection", "repo-1", "high")
    assert key1 == key2
    assert key1.startswith("qr:")


def test_query_cache_key_varies_with_params() -> None:
    key1 = FindingsCache.query_cache_key("sql injection", "repo-1")
    key2 = FindingsCache.query_cache_key("sql injection", "repo-2")
    assert key1 != key2


def test_query_result_cache_hit() -> None:
    cache, mock_client = _make_cache_with_mock()
    expected = '{"status": "ok", "count": 3}'
    mock_client.get.return_value = expected.encode()

    result = cache.get_query_result("qr:test_key")
    assert result == expected


def test_query_result_cache_miss() -> None:
    cache, mock_client = _make_cache_with_mock()
    mock_client.get.return_value = None

    result = cache.get_query_result("qr:test_key")
    assert result is None


# ---------------------------------------------------------------------------
# get_or_embed integration
# ---------------------------------------------------------------------------


def test_get_or_embed_uses_cache_for_known_texts() -> None:
    cache, mock_client = _make_cache_with_mock()
    cached_vector = [1.0, 2.0]
    mock_client.get.return_value = json.dumps(cached_vector).encode()

    async def _fake_embed(embedder, texts):
        raise AssertionError("Should not be called when all texts are cached")

    result = asyncio.run(cache.get_or_embed(None, ["cached text"], _fake_embed))
    assert result == [cached_vector]


def test_get_or_embed_falls_through_on_cache_miss() -> None:
    cache, mock_client = _make_cache_with_mock()
    mock_client.get.return_value = None  # cache miss

    async def _fake_embed(embedder, texts):
        return [[float(len(t)), 0.0] for t in texts]

    result = asyncio.run(cache.get_or_embed(None, ["hello"], _fake_embed))
    assert result == [[5.0, 0.0]]
    # Verify it was cached
    mock_client.setex.assert_called_once()


def test_get_or_embed_mixed_hits_and_misses() -> None:
    cache, mock_client = _make_cache_with_mock()
    cached_vector = [99.0, 99.0]

    def _mock_get(key):
        # First call = hit, second call = miss
        if not hasattr(_mock_get, "call_count"):
            _mock_get.call_count = 0
        _mock_get.call_count += 1
        if _mock_get.call_count == 1:
            return json.dumps(cached_vector).encode()
        return None

    mock_client.get.side_effect = _mock_get

    embed_calls = []

    async def _fake_embed(embedder, texts):
        embed_calls.extend(texts)
        return [[float(len(t)), 0.0] for t in texts]

    result = asyncio.run(cache.get_or_embed(None, ["cached", "fresh"], _fake_embed))
    assert result[0] == cached_vector  # from cache
    assert result[1] == [5.0, 0.0]  # from embedder
    assert embed_calls == ["fresh"]  # only uncached text was embedded


# ---------------------------------------------------------------------------
# Invalidation
# ---------------------------------------------------------------------------


def test_invalidate_query_cache_deletes_matching_keys() -> None:
    cache, mock_client = _make_cache_with_mock()
    mock_client.scan.return_value = (0, [b"qr:key1", b"qr:key2"])
    mock_client.delete.return_value = 2

    deleted = cache.invalidate_query_cache()
    assert deleted == 2
    mock_client.delete.assert_called_once_with(b"qr:key1", b"qr:key2")


def test_invalidate_query_cache_noop_when_no_keys() -> None:
    cache, mock_client = _make_cache_with_mock()
    mock_client.scan.return_value = (0, [])

    deleted = cache.invalidate_query_cache()
    assert deleted == 0
    mock_client.delete.assert_not_called()
