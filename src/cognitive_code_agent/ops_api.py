"""Ops REST API — Docker status and notes endpoints for the dashboard.

Routes are registered via register_ops_routes(app) called from register.py.
These endpoints query Docker SDK and SQLite directly, without going through
the agent LLM, so the dashboard works independently of chat sessions.

All URLs consumed by the frontend are relative (/api/ops/...) — no hardcoded
hostnames. Docker connection respects the DOCKER_HOST env var (or default socket).
"""

from __future__ import annotations

import logging
import os
import sqlite3
import time
from typing import Any

import docker
import docker.errors
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)
MAX_LOG_LINES = 500

_NOTES_SCHEMA = """
CREATE TABLE IF NOT EXISTS ops_notes (
    id            TEXT PRIMARY KEY,
    container_name TEXT NOT NULL DEFAULT '',
    note_type     TEXT NOT NULL,
    content       TEXT NOT NULL,
    created_at    INTEGER NOT NULL
);
"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _format_ports(ports: dict | None) -> list[str]:
    """Convert Docker ports dict to list of 'host:container/proto' strings."""
    if not ports:
        return []
    result = []
    for container_port, bindings in ports.items():
        if bindings:
            for b in bindings:
                host_port = b.get("HostPort", "")
                result.append(f"{host_port}:{container_port}" if host_port else container_port)
        else:
            result.append(container_port)
    return result


def _fetch_containers() -> tuple[list[dict], str | None]:
    """Call Docker SDK and return (containers_list, error_message)."""
    try:
        client = docker.from_env()
        containers = client.containers.list(all=True)
        items = []
        for c in containers:
            attrs = c.attrs or {}
            state = attrs.get("State", {})
            image = ", ".join(c.image.tags) if c.image.tags else "untagged"
            items.append(
                {
                    "name": c.name,
                    "id": c.short_id,
                    "image": image,
                    "status": c.status,
                    "state": state.get("Status", "unknown"),
                    "ports": _format_ports(c.ports),
                    "created_at": attrs.get("Created", ""),
                    "started_at": state.get("StartedAt", ""),
                }
            )
        return items, None
    except docker.errors.DockerException as exc:
        logger.warning("ops_api: Docker unavailable: %s", exc)
        return [], f"Docker daemon unavailable: {exc}"


def _fetch_notes(
    limit: int = 10,
    note_type: str = "",
    container_name: str = "",
) -> list[dict]:
    """Query SQLite notes. Returns [] if DB path missing or table empty."""
    db_path = os.environ.get("NOTES_DB_PATH", "")
    if not db_path:
        return []

    safe_limit = min(max(1, limit), 50)
    query = "SELECT id, container_name, note_type, content, created_at FROM ops_notes WHERE 1=1"
    params: list = []

    if container_name:
        query += " AND container_name = ?"
        params.append(container_name)
    if note_type:
        query += " AND note_type = ?"
        params.append(note_type)

    query += " ORDER BY created_at DESC LIMIT ?"
    params.append(safe_limit)

    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        conn.executescript(_NOTES_SCHEMA)
        rows = conn.execute(query, params).fetchall()
        conn.close()
    except Exception as exc:
        logger.warning("ops_api: notes query failed: %s", exc)
        return []

    return [
        {
            "id": row["id"],
            "container_name": row["container_name"],
            "note_type": row["note_type"],
            "content": row["content"],
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(row["created_at"])),
        }
        for row in rows
    ]


def _fetch_container_inspect(container: str) -> tuple[dict[str, Any] | None, str | None]:
    """Return container inspect summary for drill-down."""
    try:
        client = docker.from_env()
        c = client.containers.get(container)
        attrs = c.attrs or {}
        state = attrs.get("State", {})
        host_cfg = attrs.get("HostConfig", {})
        restart_count = attrs.get("RestartCount", 0)
        restart_policy = host_cfg.get("RestartPolicy", {}).get("Name", "none")
        image = ", ".join(c.image.tags) if c.image.tags else "untagged"
        return {
            "name": c.name,
            "id": c.short_id,
            "image": image,
            "status": state.get("Status", "unknown"),
            "running": state.get("Running", False),
            "exit_code": state.get("ExitCode", 0),
            "restart_count": restart_count,
            "restart_policy": restart_policy,
        }, None
    except docker.errors.NotFound:
        return None, f"Container {container!r} not found"
    except docker.errors.DockerException as exc:
        logger.warning("ops_api: inspect failed for %s: %s", container, exc)
        return None, "Docker daemon unavailable"


def _fetch_container_logs(container: str, lines: int = 100) -> tuple[str, str | None]:
    """Return recent logs for container drill-down."""
    safe_lines = min(max(1, lines), MAX_LOG_LINES)
    try:
        client = docker.from_env()
        c = client.containers.get(container)
        raw = c.logs(tail=safe_lines, timestamps=True)
        text = raw.decode("utf-8", errors="replace").strip()
        if not text:
            return "", None
        return text, None
    except docker.errors.NotFound:
        return "", f"Container {container!r} not found"
    except docker.errors.DockerException as exc:
        logger.warning("ops_api: logs failed for %s: %s", container, exc)
        return "", "Docker daemon unavailable"


# ---------------------------------------------------------------------------
# Route registration
# ---------------------------------------------------------------------------


def register_ops_routes(app: Any) -> None:
    if getattr(app.state, "cognitive_ops_routes_registered", False):
        return

    @app.get("/api/ops/status")
    async def get_ops_status() -> JSONResponse:
        containers, error = _fetch_containers()
        if error:
            return JSONResponse({"error": error}, status_code=503)
        return JSONResponse({"containers": containers})

    @app.get("/api/ops/notes")
    async def get_ops_notes(
        limit: int = 10,
        note_type: str = "",
        container_name: str = "",
    ) -> JSONResponse:
        notes = _fetch_notes(limit=limit, note_type=note_type, container_name=container_name)
        return JSONResponse({"notes": notes})

    @app.get("/api/ops/containers/{container}/inspect")
    async def get_ops_container_inspect(container: str) -> JSONResponse:
        data, error = _fetch_container_inspect(container)
        if error:
            status_code = 404 if "not found" in error.lower() else 503
            return JSONResponse({"error": error}, status_code=status_code)
        return JSONResponse({"container": data})

    @app.get("/api/ops/containers/{container}/logs")
    async def get_ops_container_logs(container: str, lines: int = 120) -> JSONResponse:
        logs, error = _fetch_container_logs(container=container, lines=lines)
        if error:
            status_code = 404 if "not found" in error.lower() else 503
            return JSONResponse({"error": error}, status_code=status_code)
        return JSONResponse({"container": container, "logs": logs})

    app.state.cognitive_ops_routes_registered = True
