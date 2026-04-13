"""Integration tests for NAT Redis conversational memory backend.

These tests validate cross-session persistence semantics using NAT's RedisEditor.
They require a running Redis instance with RedisJSON + RediSearch modules.
"""

from __future__ import annotations

import os
import uuid

import pytest
import redis.asyncio as redis

from nat.memory.models import MemoryItem
from nat.plugins.redis.redis_editor import RedisEditor
from nat.plugins.redis.schema import ensure_index_exists


pytestmark = pytest.mark.integration


class _FakeEmbedder:
    """Deterministic embedder for integration testing."""

    async def aembed_query(self, text: str) -> list[float]:
        base = float(len(text) or 1)
        checksum = float(sum(ord(ch) for ch in text) % 997)
        return [base, checksum]


async def _redis_client_or_skip() -> redis.Redis:
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    client = redis.from_url(redis_url, decode_responses=True)

    try:
        await client.ping()
    except Exception as exc:  # noqa: BLE001
        await client.close()
        pytest.skip(f"Redis not reachable for integration test: {exc}")

    try:
        modules = await client.execute_command("MODULE", "LIST")
    except Exception as exc:  # noqa: BLE001
        await client.close()
        pytest.skip(f"Could not inspect Redis modules: {exc}")

    module_names: set[str] = set()
    for entry in modules:
        if isinstance(entry, list):
            for idx in range(0, len(entry), 2):
                key = entry[idx]
                value = entry[idx + 1] if idx + 1 < len(entry) else None
                if key == b"name":
                    if isinstance(value, bytes):
                        module_names.add(value.decode("utf-8", errors="ignore").lower())
                    elif isinstance(value, str):
                        module_names.add(value.lower())

    has_search = bool(module_names.intersection({"search", "ft", "redisearch"}))
    has_json = bool(module_names.intersection({"rejson", "json"}))
    if not (has_search and has_json):
        await client.close()
        pytest.skip(
            "Redis Stack modules required (RediSearch + RedisJSON); "
            f"detected modules={sorted(module_names)}"
        )

    return client


@pytest.mark.asyncio
async def test_redis_memory_persists_across_editor_instances() -> None:
    client = await _redis_client_or_skip()

    key_prefix = f"cgn_test_{uuid.uuid4().hex[:8]}"
    embedder = _FakeEmbedder()

    try:
        await ensure_index_exists(client=client, key_prefix=key_prefix, embedding_dim=2)

        editor_session_1 = RedisEditor(
            redis_client=client, key_prefix=key_prefix, embedder=embedder
        )
        editor_session_2 = RedisEditor(
            redis_client=client, key_prefix=key_prefix, embedder=embedder
        )

        await editor_session_1.add_items(
            [
                MemoryItem(
                    conversation=[
                        {"role": "user", "content": "Trabajo con Python y pytest"},
                        {"role": "assistant", "content": "Perfecto, anoto tu stack"},
                    ],
                    user_id="integration_user",
                    tags=["language", "testing"],
                    metadata={"source": "integration_test"},
                    memory="El usuario trabaja con Python y pytest",
                )
            ]
        )

        results = await editor_session_2.search(
            query="Python y pytest",
            top_k=5,
            user_id="integration_user",
        )

        assert len(results) >= 1
        assert any((item.memory or "").lower().find("python") >= 0 for item in results)
        assert all(item.user_id == "integration_user" for item in results)
    finally:
        try:
            cleanup_editor = RedisEditor(
                redis_client=client, key_prefix=key_prefix, embedder=embedder
            )
            await cleanup_editor.remove_items()
        finally:
            await client.close()
