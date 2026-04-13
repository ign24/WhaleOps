"""Unit tests for the MCP server bridge module."""

import json
from unittest.mock import AsyncMock, Mock, patch

import httpx
import pytest

from cognitive_code_agent.mcp_server import (
    AGENT_URL,
    AGENT_TIMEOUT,
    _call_agent,
    _build_prompt,
    _health_check,
    _parse_sse_response,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _sse_payload(chunks: list[str], finish: bool = True) -> str:
    """Build a raw SSE response body from a list of content strings."""
    lines = []
    for chunk in chunks:
        data = {
            "choices": [{"delta": {"content": chunk}, "index": 0, "finish_reason": None}],
            "model": "test",
        }
        lines.append(f"data: {json.dumps(data)}\n\n")
    if finish:
        lines.append("data: [DONE]\n\n")
    return "".join(lines)


def _mock_response(status: int = 200, text: str = "") -> httpx.Response:
    return httpx.Response(status, text=text, request=httpx.Request("POST", "http://test"))


# ---------------------------------------------------------------------------
# _parse_sse_response tests
# ---------------------------------------------------------------------------


class TestParseSSE:
    """Tests for SSE parsing logic (no HTTP involved)."""

    def test_concatenates_chunks_in_order(self):
        raw = _sse_payload(["Hello", " ", "world"])
        assert _parse_sse_response(raw) == "Hello world"

    def test_truncation_at_limit(self, monkeypatch):
        monkeypatch.setattr("cognitive_code_agent.mcp_server.MAX_OUTPUT_CHARS", 20)
        raw = _sse_payload(["A" * 50])
        result = _parse_sse_response(raw)
        assert result.startswith("A" * 20)
        assert "[Response truncated at 20 characters]" in result

    def test_within_limit_not_truncated(self):
        raw = _sse_payload(["short"])
        assert _parse_sse_response(raw) == "short"

    def test_malformed_json_returns_partial(self):
        raw = 'data: {"choices":[{"delta":{"content":"partial"}}]}\n\ndata: {bad json\n\n'
        result = _parse_sse_response(raw)
        assert "partial" in result
        assert "[Stream interrupted:" in result

    def test_empty_stream(self):
        raw = "data: [DONE]\n\n"
        assert _parse_sse_response(raw) == ""


# ---------------------------------------------------------------------------
# _call_agent tests
# ---------------------------------------------------------------------------


class TestCallAgent:
    """Tests for _call_agent: the core HTTP bridge function."""

    @pytest.mark.asyncio
    async def test_success(self):
        body = _sse_payload(["Hello", " ", "world"])
        mock_resp = _mock_response(200, body)

        with patch("cognitive_code_agent.mcp_server.httpx.AsyncClient") as MockClient:
            instance = AsyncMock()
            instance.send = AsyncMock(return_value=mock_resp)
            instance.build_request = lambda *a, **kw: httpx.Request("POST", "http://test")
            instance.__aenter__ = AsyncMock(return_value=instance)
            instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = instance

            result = await _call_agent("test prompt")
            assert result == "Hello world"

    @pytest.mark.asyncio
    async def test_timeout_returns_error(self):
        with patch("cognitive_code_agent.mcp_server.httpx.AsyncClient") as MockClient:
            instance = AsyncMock()
            instance.send = AsyncMock(side_effect=httpx.ReadTimeout("timed out"))
            instance.build_request = lambda *a, **kw: httpx.Request("POST", "http://test")
            instance.__aenter__ = AsyncMock(return_value=instance)
            instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = instance

            result = await _call_agent("test")
            assert f"Agent did not respond within {AGENT_TIMEOUT}s" in result

    @pytest.mark.asyncio
    async def test_connection_error(self):
        with patch("cognitive_code_agent.mcp_server.httpx.AsyncClient") as MockClient:
            instance = AsyncMock()
            instance.send = AsyncMock(side_effect=httpx.ConnectError("refused"))
            instance.build_request = lambda *a, **kw: httpx.Request("POST", "http://test")
            instance.__aenter__ = AsyncMock(return_value=instance)
            instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = instance

            result = await _call_agent("test")
            assert f"Agent unreachable at {AGENT_URL}" in result

    @pytest.mark.asyncio
    async def test_http_500(self):
        mock_resp = _mock_response(500, "Internal Server Error")

        with patch("cognitive_code_agent.mcp_server.httpx.AsyncClient") as MockClient:
            instance = AsyncMock()
            instance.send = AsyncMock(return_value=mock_resp)
            instance.build_request = lambda *a, **kw: httpx.Request("POST", "http://test")
            instance.__aenter__ = AsyncMock(return_value=instance)
            instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = instance

            result = await _call_agent("test")
            assert "Agent returned HTTP 500" in result

    @pytest.mark.asyncio
    async def test_http_429(self):
        mock_resp = _mock_response(429, "Too Many Requests")

        with patch("cognitive_code_agent.mcp_server.httpx.AsyncClient") as MockClient:
            instance = AsyncMock()
            instance.send = AsyncMock(return_value=mock_resp)
            instance.build_request = lambda *a, **kw: httpx.Request("POST", "http://test")
            instance.__aenter__ = AsyncMock(return_value=instance)
            instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = instance

            result = await _call_agent("test")
            assert "Agent returned HTTP 429" in result
            assert "Retry" in result


# ---------------------------------------------------------------------------
# _build_prompt tests
# ---------------------------------------------------------------------------


class TestBuildPrompt:
    """Tests for prompt construction with mode prefixing and context injection."""

    def test_analyze_prefix(self):
        result = _build_prompt("/analyze", "Check security", None)
        assert result == "/analyze Check security"

    def test_execute_prefix(self):
        result = _build_prompt("/execute", "Add tests", None)
        assert result == "/execute Add tests"

    def test_no_prefix_for_chat(self):
        result = _build_prompt(None, "What framework is this?", None)
        assert result == "What framework is this?"

    def test_context_prepended(self):
        result = _build_prompt("/analyze", "Check errors", "Python FastAPI service")
        assert result == "/analyze [Context: Python FastAPI service]\n\nCheck errors"

    def test_context_none_omitted(self):
        result = _build_prompt("/analyze", "Check errors", None)
        assert "Context" not in result


# ---------------------------------------------------------------------------
# _health_check tests
# ---------------------------------------------------------------------------


class TestHealthCheck:
    """Tests for startup health check behavior."""

    @pytest.mark.asyncio
    async def test_reachable_logs_connected(self, caplog):
        mock_resp = httpx.Response(
            200,
            request=httpx.Request("GET", f"{AGENT_URL}/docs"),
        )

        with patch("cognitive_code_agent.mcp_server.httpx.AsyncClient") as MockClient:
            instance = AsyncMock()
            instance.get = AsyncMock(return_value=mock_resp)
            instance.__aenter__ = AsyncMock(return_value=instance)
            instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = instance

            with caplog.at_level("INFO"):
                await _health_check()

        assert any("Agent connected" in rec.message for rec in caplog.records)

    @pytest.mark.asyncio
    async def test_unreachable_logs_warning_without_raising(self, caplog):
        with patch("cognitive_code_agent.mcp_server.httpx.AsyncClient") as MockClient:
            instance = AsyncMock()
            instance.get = AsyncMock(side_effect=httpx.ConnectError("refused"))
            instance.__aenter__ = AsyncMock(return_value=instance)
            instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = instance

            with caplog.at_level("WARNING"):
                await _health_check()

        assert any("not reachable" in rec.message for rec in caplog.records)


class TestMain:
    """Tests for CLI entrypoint behavior."""

    def test_streamable_http_sets_host_port_and_runs_without_port_kwarg(self, monkeypatch):
        from cognitive_code_agent import mcp_server

        run_mock = Mock()
        monkeypatch.setattr(mcp_server.mcp, "run", run_mock)
        monkeypatch.setattr(
            "sys.argv",
            [
                "mcp-server",
                "--transport",
                "streamable-http",
                "--host",
                "0.0.0.0",
                "--port",
                "3201",
            ],
        )

        mcp_server.main()

        assert mcp_server.mcp.settings.host == "0.0.0.0"
        assert mcp_server.mcp.settings.port == 3201
        run_mock.assert_called_once_with(transport="streamable-http")

    def test_stdio_transport_runs_stdio_mode(self, monkeypatch):
        from cognitive_code_agent import mcp_server

        run_mock = Mock()
        monkeypatch.setattr(mcp_server.mcp, "run", run_mock)
        monkeypatch.setattr("sys.argv", ["mcp-server", "--transport", "stdio"])

        mcp_server.main()

        run_mock.assert_called_once_with(transport="stdio")
