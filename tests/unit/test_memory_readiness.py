from __future__ import annotations

import pytest

from cognitive_code_agent.memory import readiness


pytestmark = pytest.mark.unit


class _FakeRedisClient:
    def __init__(self, error: Exception | None = None) -> None:
        self._error = error
        self.ft_info_calls = 0

    async def ping(self) -> bool:
        return True

    async def execute_command(self, *args: str):
        if args[:2] == ("FT.INFO", "memory_idx"):
            self.ft_info_calls += 1
        if self._error:
            raise self._error
        return ["index_name", "memory_idx"]

    async def close(self) -> None:
        return None


class _UnknownCommandError(Exception):
    pass


@pytest.mark.asyncio
async def test_probe_episodic_redis_marks_unavailable_without_search_modules(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _factory(*_args, **_kwargs):
        return _FakeRedisClient(
            _UnknownCommandError(
                "unknown command 'FT.INFO', with args beginning with: 'memory_idx'"
            )
        )

    monkeypatch.setattr(readiness, "_build_redis_client", _factory)
    readiness._READINESS_CACHE.clear()  # noqa: SLF001 - test-only cache reset

    result = await readiness.probe_episodic_redis("redis://redis:6379/0", ttl_seconds=60)

    assert result.available is False
    assert result.reason == "missing_redisearch_module"


@pytest.mark.asyncio
async def test_probe_episodic_redis_treats_unknown_index_as_available(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _factory(*_args, **_kwargs):
        return _FakeRedisClient(_UnknownCommandError("Unknown Index name"))

    monkeypatch.setattr(readiness, "_build_redis_client", _factory)
    readiness._READINESS_CACHE.clear()  # noqa: SLF001 - test-only cache reset

    result = await readiness.probe_episodic_redis("redis://redis:6379/0", ttl_seconds=60)

    assert result.available is True
    assert result.reason == ""


@pytest.mark.asyncio
async def test_probe_episodic_redis_uses_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _FakeRedisClient()

    async def _factory(*_args, **_kwargs):
        return client

    monkeypatch.setattr(readiness, "_build_redis_client", _factory)
    readiness._READINESS_CACHE.clear()  # noqa: SLF001 - test-only cache reset

    first = await readiness.probe_episodic_redis("redis://redis:6379/0", ttl_seconds=60)
    second = await readiness.probe_episodic_redis("redis://redis:6379/0", ttl_seconds=60)

    assert first.available is True
    assert second.available is True
    assert client.ft_info_calls == 1


def test_log_degraded_memory_once_throttles_repeated_logs(caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level("WARNING")
    readiness._DEGRADED_LOG_CACHE.clear()  # noqa: SLF001 - test-only cache reset

    first = readiness.log_degraded_memory_once("episodic", "missing_redisearch_module", cooldown=30)
    second = readiness.log_degraded_memory_once(
        "episodic", "missing_redisearch_module", cooldown=30
    )

    assert first is True
    assert second is False


@pytest.mark.asyncio
async def test_evaluate_memory_readiness_includes_semantic(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _episodic(**_kwargs):
        return readiness.SourceReadiness(available=True)

    async def _findings(**_kwargs):
        return readiness.SourceReadiness(available=False, reason="milvus_unreachable")

    monkeypatch.setattr(readiness, "probe_episodic_redis", _episodic)
    monkeypatch.setattr(readiness, "probe_findings_backend", _findings)

    result = await readiness.evaluate_memory_readiness(
        include_episodic=True,
        include_findings=True,
        include_semantic=True,
    )

    assert result.episodic.available is True
    assert result.findings.available is False
    assert result.semantic.available is False
