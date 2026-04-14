"""Unit tests for D03Client — all HTTP calls mocked, no real network."""
from __future__ import annotations

import pytest
import httpx
from unittest.mock import AsyncMock, MagicMock, patch


pytestmark = pytest.mark.unit


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_response(status_code: int = 200, json_body: object = None) -> MagicMock:
    """Build a fake httpx.Response for mocking."""
    resp = MagicMock(spec=httpx.Response)
    resp.status_code = status_code
    resp.json = MagicMock(return_value=json_body or {})
    if status_code >= 400:
        resp.raise_for_status = MagicMock(
            side_effect=httpx.HTTPStatusError(
                f"HTTP {status_code}",
                request=MagicMock(),
                response=resp,
            )
        )
    else:
        resp.raise_for_status = MagicMock()
    return resp


# ---------------------------------------------------------------------------
# __init__ — env var validation
# ---------------------------------------------------------------------------

class TestD03ClientInit:
    def test_raises_if_url_missing(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("D03_API_URL", raising=False)
        monkeypatch.setenv("D03_API_TOKEN", "tok")

        from cognitive_code_agent.tools.d03_client import D03Client

        with pytest.raises(RuntimeError, match="D03_API_URL"):
            D03Client()

    def test_raises_if_token_missing(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("D03_API_URL", "http://d03:8080")
        monkeypatch.delenv("D03_API_TOKEN", raising=False)

        from cognitive_code_agent.tools.d03_client import D03Client

        with pytest.raises(RuntimeError, match="D03_API_TOKEN"):
            D03Client()

    def test_initialises_successfully_with_both_vars(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("D03_API_URL", "http://d03:8080")
        monkeypatch.setenv("D03_API_TOKEN", "tok")

        from cognitive_code_agent.tools.d03_client import D03Client

        client = D03Client()
        assert client is not None


# ---------------------------------------------------------------------------
# get_status
# ---------------------------------------------------------------------------

class TestGetStatus:
    @pytest.fixture(autouse=True)
    def _env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("D03_API_URL", "http://d03:8080")
        monkeypatch.setenv("D03_API_TOKEN", "secret")

    async def test_returns_parsed_json(self) -> None:
        from cognitive_code_agent.tools.d03_client import D03Client

        payload = {"cpu_percent": 12.5, "memory_percent": 45.0, "disk_percent": 60.0, "uptime_seconds": 3600}
        mock_resp = _make_response(200, payload)

        client = D03Client()
        with patch.object(client._client, "get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_resp
            result = await client.get_status()

        mock_get.assert_called_once_with("/status")
        assert result == payload

    async def test_raises_on_http_error(self) -> None:
        from cognitive_code_agent.tools.d03_client import D03Client

        mock_resp = _make_response(500)

        client = D03Client()
        with patch.object(client._client, "get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_resp
            with pytest.raises(httpx.HTTPStatusError):
                await client.get_status()

    async def test_auth_header_injected(self) -> None:
        """Verify client was created with the Authorization header."""
        from cognitive_code_agent.tools.d03_client import D03Client

        client = D03Client()
        assert client._client.headers["authorization"] == "Bearer secret"


# ---------------------------------------------------------------------------
# list_services
# ---------------------------------------------------------------------------

class TestListServices:
    @pytest.fixture(autouse=True)
    def _env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("D03_API_URL", "http://d03:8080")
        monkeypatch.setenv("D03_API_TOKEN", "tok")

    async def test_returns_parsed_list(self) -> None:
        from cognitive_code_agent.tools.d03_client import D03Client

        payload = [{"name": "nginx", "state": "active"}, {"name": "redis", "state": "failed"}]
        mock_resp = _make_response(200, payload)

        client = D03Client()
        with patch.object(client._client, "get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_resp
            result = await client.list_services()

        mock_get.assert_called_once_with("/services")
        assert result == payload

    async def test_raises_on_http_error(self) -> None:
        from cognitive_code_agent.tools.d03_client import D03Client

        mock_resp = _make_response(503)

        client = D03Client()
        with patch.object(client._client, "get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_resp
            with pytest.raises(httpx.HTTPStatusError):
                await client.list_services()


# ---------------------------------------------------------------------------
# get_logs
# ---------------------------------------------------------------------------

class TestGetLogs:
    @pytest.fixture(autouse=True)
    def _env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("D03_API_URL", "http://d03:8080")
        monkeypatch.setenv("D03_API_TOKEN", "tok")

    async def test_returns_parsed_dict(self) -> None:
        from cognitive_code_agent.tools.d03_client import D03Client

        payload = {"service": "nginx", "lines": 10, "entries": ["line 1", "line 2"]}
        mock_resp = _make_response(200, payload)

        client = D03Client()
        with patch.object(client._client, "get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_resp
            result = await client.get_logs("nginx", lines=10)

        mock_get.assert_called_once_with("/logs/nginx", params={"lines": 10})
        assert result == payload

    async def test_clamps_lines_to_500(self) -> None:
        from cognitive_code_agent.tools.d03_client import D03Client

        mock_resp = _make_response(200, {"service": "nginx", "lines": 500, "entries": []})

        client = D03Client()
        with patch.object(client._client, "get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_resp
            await client.get_logs("nginx", lines=9999)

        # lines must be clamped to 500
        mock_get.assert_called_once_with("/logs/nginx", params={"lines": 500})

    async def test_default_lines_is_50(self) -> None:
        from cognitive_code_agent.tools.d03_client import D03Client

        mock_resp = _make_response(200, {"service": "sshd", "lines": 50, "entries": []})

        client = D03Client()
        with patch.object(client._client, "get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_resp
            await client.get_logs("sshd")

        mock_get.assert_called_once_with("/logs/sshd", params={"lines": 50})

    async def test_raises_on_timeout(self) -> None:
        from cognitive_code_agent.tools.d03_client import D03Client

        client = D03Client()
        with patch.object(client._client, "get", new_callable=AsyncMock) as mock_get:
            mock_get.side_effect = httpx.TimeoutException("timed out")
            with pytest.raises(httpx.TimeoutException):
                await client.get_logs("nginx")

    async def test_raises_on_404(self) -> None:
        from cognitive_code_agent.tools.d03_client import D03Client

        mock_resp = _make_response(404)

        client = D03Client()
        with patch.object(client._client, "get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_resp
            with pytest.raises(httpx.HTTPStatusError):
                await client.get_logs("nonexistent")
