"""Workspace filesystem API for agent runtime."""

from __future__ import annotations

import asyncio
import os
import re
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from fastapi import HTTPException, Query
from fastapi.requests import Request
from fastapi.responses import JSONResponse


ANALYSIS_ROOT = "ANALYSIS_ROOT"
WORKSPACE_ROOT = "WORKSPACE_ROOT"

DEFAULT_ANALYSIS_ROOT = "/tmp/analysis"
DEFAULT_WORKSPACE_ROOT = "/app/workspace"

SKIP_NAMES = {
    ".git",
    "node_modules",
    "__pycache__",
    ".venv",
    "venv",
    "dist",
    "build",
    ".next",
    ".mypy_cache",
    ".pytest_cache",
}

MAX_DEPTH = 3
MAX_NODES = 300
GIT_STATUS_RE = re.compile(r"^(.{1,2})\s+(.+)$")


@dataclass
class TreeBuildCtx:
    file_count: int = 0
    dir_count: int = 0
    node_count: int = 0
    truncated: bool = False


def _root_env(name: str, default: str) -> Path:
    raw = os.environ.get(name, default)
    return Path(raw).resolve()


def get_allowed_roots() -> list[Path]:
    roots = [
        _root_env(ANALYSIS_ROOT, DEFAULT_ANALYSIS_ROOT),
        _root_env(WORKSPACE_ROOT, DEFAULT_WORKSPACE_ROOT),
    ]

    unique: list[Path] = []
    seen: set[Path] = set()
    for root in roots:
        if root in seen:
            continue
        seen.add(root)
        unique.append(root)
    return unique


def get_configured_roots() -> list[dict[str, str]]:
    roots = get_allowed_roots()
    labels = ["sandbox", "workspace"]
    configured: list[dict[str, str]] = []
    for idx, root in enumerate(roots):
        label = labels[idx] if idx < len(labels) else f"root-{idx + 1}"
        configured.append({"path": str(root), "label": label})
    return configured


def is_allowed_path(input_path: str) -> bool:
    if not input_path:
        return False

    resolved = Path(input_path).resolve()
    for root in get_allowed_roots():
        if resolved == root:
            return True
        if resolved.is_relative_to(root):
            return True
    return False


def _build_tree(current_path: Path, depth: int, ctx: TreeBuildCtx) -> list[dict[str, Any]]:
    if depth > MAX_DEPTH or ctx.node_count >= MAX_NODES:
        ctx.truncated = True
        return []

    try:
        entries = list(os.scandir(current_path))
    except OSError:
        return []

    entries.sort(key=lambda entry: (not entry.is_dir(follow_symlinks=False), entry.name.lower()))
    nodes: list[dict[str, Any]] = []

    for entry in entries:
        if ctx.node_count >= MAX_NODES:
            ctx.truncated = True
            break

        if entry.name in SKIP_NAMES:
            continue

        ctx.node_count += 1
        entry_path = current_path / entry.name

        if entry.is_dir(follow_symlinks=False):
            ctx.dir_count += 1
            children = _build_tree(entry_path, depth + 1, ctx)
            nodes.append({"name": entry.name, "type": "dir", "children": children})
            continue

        if entry.is_file(follow_symlinks=False):
            ctx.file_count += 1
            size: int | None = None
            try:
                size = entry.stat(follow_symlinks=False).st_size
            except OSError:
                size = None
            node = {"name": entry.name, "type": "file"}
            if size is not None:
                node["size"] = size
            nodes.append(node)

    return nodes


def _parse_git_status(stdout: str) -> list[dict[str, str]]:
    items: list[dict[str, str]] = []
    for raw_line in stdout.splitlines():
        line = raw_line.strip("\n")
        if not line:
            continue
        match = GIT_STATUS_RE.match(line)
        if not match:
            continue
        items.append({"status": match.group(1).strip(), "path": match.group(2).strip()})
        if len(items) >= 100:
            break
    return items


def _changed_files(repo_path: Path) -> list[dict[str, str]]:
    try:
        result = subprocess.run(
            ["git", "-C", str(repo_path), "status", "--short", "--porcelain"],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
    except Exception:
        return []

    if result.returncode != 0:
        return []
    return _parse_git_status(result.stdout)


async def build_workspace_tree(path_value: str) -> dict[str, Any]:
    if not path_value:
        raise HTTPException(status_code=400, detail="path parameter required")

    if not is_allowed_path(path_value):
        raise HTTPException(status_code=403, detail="path not allowed")

    resolved = Path(path_value).resolve()
    if not resolved.exists():
        raise HTTPException(status_code=404, detail="path not found")
    if not resolved.is_dir():
        raise HTTPException(status_code=400, detail="path must be a directory")

    ctx = TreeBuildCtx()
    tree = await asyncio.to_thread(_build_tree, resolved, 0, ctx)
    changed_files = await asyncio.to_thread(_changed_files, resolved)

    return {
        "path": str(resolved),
        "tree": tree,
        "changedFiles": changed_files,
        "totalFiles": ctx.file_count,
        "totalDirs": ctx.dir_count,
        "truncated": ctx.truncated,
    }


def register_workspace_routes(app: Any) -> None:
    if getattr(app.state, "cognitive_workspace_routes_registered", False):
        return

    @app.get("/workspace/roots")
    async def workspace_roots() -> JSONResponse:
        return JSONResponse({"roots": get_configured_roots()})

    @app.get("/workspace/tree")
    async def workspace_tree(path: str = Query(..., min_length=1)) -> JSONResponse:
        payload = await build_workspace_tree(path)
        return JSONResponse(payload)

    @app.post("/workspace/execute-delete")
    async def workspace_execute_delete(request: Request) -> JSONResponse:
        """Execute a confirmed workspace deletion.

        Called only by the Next.js backend after PIN validation. Path must be
        within an allowed root — defense-in-depth check independent of UI layer.
        """
        try:
            body = await request.json()
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid JSON body")

        path_value = body.get("path", "")
        if not path_value:
            raise HTTPException(status_code=400, detail="path is required")

        if not is_allowed_path(path_value):
            raise HTTPException(status_code=403, detail="path not allowed")

        resolved = Path(path_value).resolve()
        if not resolved.exists():
            return JSONResponse({"error": "target_not_found"}, status_code=404)

        # Compute size before deletion
        def _size_mb(p: Path) -> float:
            if p.is_file():
                try:
                    return round(p.stat().st_size / (1024 * 1024), 2)
                except OSError:
                    return 0.0
            total = 0
            for entry in p.rglob("*"):
                if entry.is_file():
                    try:
                        total += entry.stat().st_size
                    except OSError:
                        pass
            return round(total / (1024 * 1024), 2)

        size_mb = await asyncio.to_thread(_size_mb, resolved)

        try:
            if resolved.is_file():
                import os
                await asyncio.to_thread(os.remove, str(resolved))
            else:
                await asyncio.to_thread(shutil.rmtree, str(resolved))
        except OSError as exc:
            return JSONResponse(
                {"error": "execution_error", "detail": str(exc)}, status_code=500
            )

        return JSONResponse({"status": "deleted", "size_freed_mb": size_mb})

    app.state.cognitive_workspace_routes_registered = True
