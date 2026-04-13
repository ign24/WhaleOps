"""Integration tests for MCP server stdio bridge."""

from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest
from mcp.client.session import ClientSession
from mcp.client.stdio import StdioServerParameters, stdio_client

pytestmark = pytest.mark.integration


class _NatMockHandler(BaseHTTPRequestHandler):
    received_prompts: list[str] = []

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/chat/stream":
            self.send_response(404)
            self.end_headers()
            return

        content_length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(content_length)
        payload = json.loads(body.decode("utf-8"))
        prompt = payload["messages"][0]["content"]
        self.__class__.received_prompts.append(prompt)

        sse_chunk = {
            "choices": [{"delta": {"content": f"ok:{prompt}"}, "index": 0, "finish_reason": None}],
            "model": "mock",
        }

        response_text = f"data: {json.dumps(sse_chunk)}\n\ndata: [DONE]\n\n"
        raw = response_text.encode("utf-8")

        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def log_message(self, _format: str, *_args: object) -> None:
        return


@pytest.fixture
def nat_mock_server():
    _NatMockHandler.received_prompts = []
    server = ThreadingHTTPServer(("127.0.0.1", 0), _NatMockHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        host, port = server.server_address
        yield f"http://{host}:{port}", _NatMockHandler.received_prompts
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


@pytest.mark.asyncio
async def test_mcp_stdio_tools_end_to_end_with_mocked_nat(nat_mock_server):
    base_url, received_prompts = nat_mock_server

    params = StdioServerParameters(
        command="uv",
        args=["run", "mcp-server"],
        env={
            "MCP_AGENT_URL": base_url,
            "MCP_TRANSPORT": "stdio",
            "MCP_AGENT_TIMEOUT": "30",
            "MCP_MAX_OUTPUT_CHARS": "100000",
        },
    )

    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            listed = await session.list_tools()
            tool_names = {tool.name for tool in listed.tools}
            assert {"analyze_code", "execute_task", "agent_chat"}.issubset(tool_names)

            analyze = await session.call_tool(
                "analyze_code",
                arguments={"prompt": "Check error handling", "context": "FastAPI module"},
            )
            execute = await session.call_tool(
                "execute_task",
                arguments={"prompt": "Add type hints"},
            )
            chat = await session.call_tool("agent_chat", arguments={"prompt": "Hello"})

    assert analyze.content[0].text.startswith("ok:/analyze")
    assert execute.content[0].text.startswith("ok:/execute")
    assert chat.content[0].text.startswith("ok:Hello")

    assert any(
        p.startswith("/analyze [Context: FastAPI module]\n\nCheck error handling")
        for p in received_prompts
    )
    assert any(p.startswith("/execute Add type hints") for p in received_prompts)
    assert any(p == "Hello" for p in received_prompts)
