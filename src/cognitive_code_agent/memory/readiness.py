"""Memory backend readiness probes with lightweight caching.

This module centralizes health/capability checks for optional memory sources,
and provides throttled degraded-state logging to avoid repetitive error spam.
"""

from __future__ import annotations

import inspect
import logging
import os
import time
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class SourceReadiness:
    available: bool
    reason: str = ""


@dataclass(frozen=True, slots=True)
class MemoryReadiness:
    episodic: SourceReadiness
    findings: SourceReadiness
    semantic: SourceReadiness


_READINESS_CACHE: dict[str, tuple[float, SourceReadiness]] = {}
_DEGRADED_LOG_CACHE: dict[str, float] = {}


def _cache_get(key: str, ttl_seconds: int) -> SourceReadiness | None:
    if ttl_seconds <= 0:
        return None
    cached = _READINESS_CACHE.get(key)
    if not cached:
        return None
    ts, value = cached
    if time.time() - ts <= ttl_seconds:
        return value
    return None


def _cache_set(key: str, value: SourceReadiness) -> None:
    _READINESS_CACHE[key] = (time.time(), value)


async def _build_redis_client(redis_url: str):
    import redis.asyncio as aioredis

    return aioredis.from_url(redis_url, decode_responses=True)


async def probe_episodic_redis(
    redis_url: str | None = None, *, ttl_seconds: int = 60
) -> SourceReadiness:
    url = redis_url or os.getenv("REDIS_URL", "redis://localhost:6379/0")
    cache_key = f"episodic:{url}"

    cached = _cache_get(cache_key, ttl_seconds)
    if cached is not None:
        return cached

    client = None
    try:
        client = await _build_redis_client(url)
        await client.ping()
        try:
            await client.execute_command("FT.INFO", "memory_idx")
            result = SourceReadiness(available=True)
        except Exception as exc:
            message = str(exc)
            if "Unknown Index name" in message:
                result = SourceReadiness(available=True)
            elif "unknown command" in message and "FT.INFO" in message:
                result = SourceReadiness(available=False, reason="missing_redisearch_module")
            else:
                result = SourceReadiness(available=False, reason="redis_search_probe_failed")
    except Exception:
        result = SourceReadiness(available=False, reason="redis_unreachable")
    finally:
        if client is not None:
            try:
                await client.close()
            except Exception:
                logger.debug("memory_readiness: failed closing redis client", exc_info=True)

    _cache_set(cache_key, result)
    return result


async def probe_findings_backend(
    milvus_uri: str | None = None, *, ttl_seconds: int = 60
) -> SourceReadiness:
    uri = milvus_uri or os.getenv("MILVUS_URI", "/app/data/milvus_lite.db")
    cache_key = f"findings:{uri}"

    cached = _cache_get(cache_key, ttl_seconds)
    if cached is not None:
        return cached

    try:
        from pymilvus import MilvusClient

        client_or_coro = MilvusClient(uri=uri, timeout=3)
        client = await client_or_coro if inspect.isawaitable(client_or_coro) else client_or_coro
        listed = client.list_collections()
        if inspect.isawaitable(listed):
            await listed
        result = SourceReadiness(available=True)
    except Exception:
        result = SourceReadiness(available=False, reason="milvus_unreachable")

    _cache_set(cache_key, result)
    return result


async def evaluate_memory_readiness(
    *,
    include_episodic: bool,
    include_findings: bool,
    include_semantic: bool,
    ttl_seconds: int = 60,
) -> MemoryReadiness:
    episodic = SourceReadiness(available=False, reason="disabled")
    if include_episodic:
        episodic = await probe_episodic_redis(ttl_seconds=ttl_seconds)

    findings = SourceReadiness(available=False, reason="disabled")
    if include_findings:
        findings = await probe_findings_backend(ttl_seconds=ttl_seconds)

    semantic = SourceReadiness(available=False, reason="disabled")
    if include_semantic:
        semantic = await probe_findings_backend(ttl_seconds=ttl_seconds)

    return MemoryReadiness(episodic=episodic, findings=findings, semantic=semantic)


def log_degraded_memory_once(source: str, reason: str, *, cooldown: int = 300) -> bool:
    key = f"{source}:{reason}"
    now = time.time()
    previous = _DEGRADED_LOG_CACHE.get(key, 0.0)
    if now - previous < cooldown:
        return False

    _DEGRADED_LOG_CACHE[key] = now
    logger.warning(
        "memory_degraded source=%s reason=%s detail='memory source skipped; agent continues'",
        source,
        reason,
    )
    return True
