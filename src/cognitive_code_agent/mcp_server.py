"""MCP server bridge for the cognitive code agent.

Thin wrapper that exposes the NAT agent as an MCP tool provider.
Calls the existing FastAPI endpoint via HTTP -- no NAT internals imported.
"""

from __future__ import annotations

import argparse
import json
import logging
import os

import httpx
from mcp.server.fastmcp import FastMCP

# ---------------------------------------------------------------------------
# Configuration (env vars, no config file)
# ---------------------------------------------------------------------------

AGENT_URL: str = os.environ.get("MCP_AGENT_URL", "http://localhost:8000")
AGENT_TIMEOUT: int = int(os.environ.get("MCP_AGENT_TIMEOUT", "600"))
MAX_OUTPUT_CHARS: int = int(os.environ.get("MCP_MAX_OUTPUT_CHARS", "100000"))
MCP_TRANSPORT: str = os.environ.get("MCP_TRANSPORT", "stdio")
MCP_HOST: str = os.environ.get("MCP_HOST", "0.0.0.0")
MCP_PORT: int = int(os.environ.get("MCP_PORT", "3100"))

logger = logging.getLogger("mcp-server-bridge")

mcp = FastMCP(
    "Cognitive Code Agent",
    instructions=(
        "MCP bridge to a cognitive code agent. Use analyze_code for read-only "
        "code analysis, execute_task for code generation/refactoring, and "
        "agent_chat for general conversation."
    ),
)

# ---------------------------------------------------------------------------
# Internals
# ---------------------------------------------------------------------------


def _build_prompt(mode_prefix: str | None, prompt: str, context: str | None) -> str:
    """Build the final prompt string with optional mode prefix and context."""
    parts: list[str] = []
    if mode_prefix:
        parts.append(mode_prefix)
    if context:
        parts.append(f"[Context: {context}]")
        parts.append(f"\n\n{prompt}")
    else:
        parts.append(prompt)
    return (
        " ".join(parts)
        if not context
        else "".join(
            [f"{mode_prefix} " if mode_prefix else "", f"[Context: {context}]\n\n{prompt}"]
        )
    )


async def _call_agent(prompt: str) -> str:
    """POST to the NAT agent and collect the full streamed response.

    Returns the agent's text response, or a structured error string on failure.
    """
    timeout = httpx.Timeout(AGENT_TIMEOUT, connect=10.0)
    payload = {
        "messages": [{"role": "user", "content": prompt}],
        "stream": True,
    }

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            request = client.build_request(
                "POST",
                f"{AGENT_URL}/chat/stream",
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "Accept": "text/event-stream",
                },
            )
            response = await client.send(request)

            if response.status_code != 200:
                body = response.text[:500]
                if response.status_code == 429:
                    return f"Agent returned HTTP 429: {body}. Rate limited. Retry after a delay."
                return f"Agent returned HTTP {response.status_code}: {body}"

            raw_lines: list[str] = []
            async for line in response.aiter_lines():
                raw_lines.append(line)
            return _parse_sse_response("\n".join(raw_lines))

    except httpx.ConnectError:
        return f"Agent unreachable at {AGENT_URL}. Ensure the agent server is running."
    except (httpx.ReadTimeout, httpx.WriteTimeout, httpx.PoolTimeout):
        return f"Agent did not respond within {AGENT_TIMEOUT}s"
    except httpx.HTTPError as exc:
        return f"HTTP error communicating with agent: {exc}"


def _parse_sse_response(raw: str) -> str:
    """Parse SSE text into concatenated content, with truncation."""
    collected: list[str] = []
    total_chars = 0

    for line in raw.split("\n"):
        line = line.strip()
        if not line.startswith("data: "):
            continue
        data_str = line[6:]
        if data_str == "[DONE]":
            break
        try:
            data = json.loads(data_str)
            choices = data.get("choices", [])
            if choices:
                content = choices[0].get("delta", {}).get("content", "")
                if content:
                    collected.append(content)
                    total_chars += len(content)
        except (json.JSONDecodeError, KeyError, IndexError) as exc:
            partial = "".join(collected)
            return f"{partial}\n[Stream interrupted: {exc}]"

    result = "".join(collected)

    if len(result) > MAX_OUTPUT_CHARS:
        return (
            result[:MAX_OUTPUT_CHARS] + f"\n[Response truncated at {MAX_OUTPUT_CHARS} characters]"
        )

    return result


# ---------------------------------------------------------------------------
# MCP Tools
# ---------------------------------------------------------------------------


@mcp.tool()
async def analyze_code(prompt: str, context: str | None = None) -> str:
    """Analyze code for quality, security, architecture, or other concerns.

    Read-only analysis -- does not modify any files.

    Args:
        prompt: What to analyze (e.g., "Review error handling in auth module")
        context: Optional background information about the codebase or task
    """
    full_prompt = _build_prompt("/analyze", prompt, context)
    return await _call_agent(full_prompt)


@mcp.tool()
async def execute_task(prompt: str, context: str | None = None) -> str:
    """Execute a code task: generate code, refactor, write tests, fix bugs.

    This tool can modify files in the workspace.

    Args:
        prompt: What to do (e.g., "Add type hints to all public functions in utils.py")
        context: Optional background information about the codebase or task
    """
    full_prompt = _build_prompt("/execute", prompt, context)
    return await _call_agent(full_prompt)


@mcp.tool()
async def agent_chat(prompt: str) -> str:
    """Chat with the agent for general questions, clarifications, or exploration.

    Does not modify files. Use for understanding the codebase or getting recommendations.

    Args:
        prompt: Your question or message
    """
    full_prompt = _build_prompt(None, prompt, None)
    return await _call_agent(full_prompt)


# ---------------------------------------------------------------------------
# Startup health check
# ---------------------------------------------------------------------------


async def _health_check() -> None:
    """Check if the NAT agent is reachable. Logs result, never raises."""
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as client:
            resp = await client.get(f"{AGENT_URL}/docs")
            if resp.status_code == 200:
                logger.info("Agent connected at %s", AGENT_URL)
            else:
                logger.warning(
                    "Agent at %s returned HTTP %d, will retry on first tool call",
                    AGENT_URL,
                    resp.status_code,
                )
    except httpx.HTTPError:
        logger.warning("Agent not reachable at %s, will retry on first tool call", AGENT_URL)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main() -> None:
    """CLI entry point for the MCP server."""
    parser = argparse.ArgumentParser(description="Cognitive Code Agent MCP Server")
    parser.add_argument(
        "--transport",
        choices=["stdio", "streamable-http"],
        default=None,
        help=f"Transport mode (default: {MCP_TRANSPORT})",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=None,
        help=f"Port for streamable-http transport (default: {MCP_PORT})",
    )
    parser.add_argument(
        "--host",
        default=None,
        help=f"Host for streamable-http transport (default: {MCP_HOST})",
    )
    args = parser.parse_args()

    transport = args.transport or MCP_TRANSPORT
    host = args.host or MCP_HOST
    port = args.port or MCP_PORT

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    )

    if transport == "streamable-http":
        mcp.settings.host = host
        mcp.settings.port = port
        logger.info("Starting MCP streamable-http server at %s:%s", host, port)
        mcp.run(transport="streamable-http")
    else:
        mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
