"""Async HTTP client for the D03 mini REST API.

All ops tools use this module as the single HTTP layer so that auth,
base URL, and timeout configuration are centralised.

Environment variables (required):
    D03_API_URL   Base URL of the D03 REST API (e.g. http://192.168.1.x:8080)
    D03_API_TOKEN Static bearer token for authentication

Do NOT add ``from __future__ import annotations`` — NAT's FunctionInfo
introspection reads inspect.signature annotations at runtime and fails on
Python 3.11 when annotations are deferred strings.
"""

import os

import httpx

DEFAULT_TIMEOUT = 10.0
MAX_LOG_LINES = 500


class D03Client:
    """Thin async HTTP client wrapping the D03 mini REST API."""

    def __init__(self) -> None:
        api_url = os.environ.get("D03_API_URL", "").strip()
        if not api_url:
            raise RuntimeError(
                "D03_API_URL environment variable is not set. "
                "Set it to the base URL of the D03 REST API before invoking ops tools."
            )
        api_token = os.environ.get("D03_API_TOKEN", "").strip()
        if not api_token:
            raise RuntimeError(
                "D03_API_TOKEN environment variable is not set. "
                "Set it to the static bearer token for the D03 REST API."
            )
        self._client = httpx.AsyncClient(
            base_url=api_url,
            headers={"Authorization": f"Bearer {api_token}"},
            timeout=DEFAULT_TIMEOUT,
        )

    async def get_status(self) -> dict:
        """GET /status — returns VPS health metrics as a dict."""
        response = await self._client.get("/status")
        response.raise_for_status()
        return response.json()

    async def list_services(self) -> list:
        """GET /services — returns list of service dicts with name and state."""
        response = await self._client.get("/services")
        response.raise_for_status()
        return response.json()

    async def get_logs(self, service: str, lines: int = 50) -> dict:
        """GET /logs/{service} — returns journal tail for the named service.

        Args:
            service: Name of the systemd service to query.
            lines:   Number of log lines to retrieve (clamped to MAX_LOG_LINES).
        """
        safe_lines = min(lines, MAX_LOG_LINES)
        response = await self._client.get(f"/logs/{service}", params={"lines": safe_lines})
        response.raise_for_status()
        return response.json()
