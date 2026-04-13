"""Unit tests for clone ownership metadata — TDD RED phase."""
from __future__ import annotations

import asyncio
import json
from pathlib import Path

import pytest

import cognitive_code_agent.tools.clone_tools as clone_tools


pytestmark = pytest.mark.unit


def _run_clone(
    repo_url: str,
    destination_root: str = "analysis",
    monkeypatch: pytest.MonkeyPatch | None = None,
) -> dict:
    async def _invoke() -> str:
        async with clone_tools.clone_repository_tool(
            clone_tools.CloneRepositoryConfig(), builder=None
        ) as function_info:
            payload = function_info.input_schema(
                repo_url=repo_url,
                destination_root=destination_root,
            )
            return await function_info.single_fn(payload)

    return json.loads(asyncio.run(_invoke()))


def _run_delete(location: str, target: str) -> dict:
    async def _invoke() -> str:
        async with clone_tools.workspace_delete_tool(
            clone_tools.WorkspaceDeleteConfig(), builder=None
        ) as function_info:
            payload = function_info.input_schema(location=location, target=target)
            return await function_info.single_fn(payload)

    return json.loads(asyncio.run(_invoke()))


# ---------------------------------------------------------------------------
# Task 2.1 — clone writes .clone_meta.json after success
# ---------------------------------------------------------------------------


def test_clone_writes_clone_meta_json(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, mock_run_command
) -> None:
    sandbox_root = tmp_path / "analysis"
    sandbox_root.mkdir(parents=True)
    monkeypatch.setattr(clone_tools, "SANDBOX_ROOT", str(sandbox_root))
    monkeypatch.delenv("GITHUB_PERSONAL_ACCESS_TOKEN", raising=False)
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)
    mock_run_command(clone_tools, stdout="cloning...", returncode=0)

    result = _run_clone("https://github.com/octo/demo-repo")

    assert result["status"] == "ok"
    meta_file = sandbox_root / "demo-repo" / ".clone_meta.json"
    assert meta_file.exists(), ".clone_meta.json must be written after a successful clone"
    meta = json.loads(meta_file.read_text())
    assert "cloned_by" in meta
    assert "cloned_at" in meta
    assert "repo_url" in meta
    assert "location" in meta
    assert meta["location"] == "analysis"
    assert meta["repo_url"] == "https://github.com/octo/demo-repo.git"


def test_clone_meta_contains_valid_iso_timestamp(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, mock_run_command
) -> None:
    sandbox_root = tmp_path / "analysis"
    sandbox_root.mkdir(parents=True)
    monkeypatch.setattr(clone_tools, "SANDBOX_ROOT", str(sandbox_root))
    mock_run_command(clone_tools, stdout="ok", returncode=0)

    _run_clone("https://github.com/octo/demo-repo")

    meta_file = sandbox_root / "demo-repo" / ".clone_meta.json"
    meta = json.loads(meta_file.read_text())
    # cloned_at must be parseable ISO 8601
    from datetime import datetime
    parsed = datetime.fromisoformat(meta["cloned_at"])
    assert parsed is not None


# ---------------------------------------------------------------------------
# Task 2.2 — .clone_meta.json write failure does not fail the clone
# ---------------------------------------------------------------------------


def test_clone_meta_write_failure_does_not_fail_clone(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, mock_run_command
) -> None:
    sandbox_root = tmp_path / "analysis"
    sandbox_root.mkdir(parents=True)
    monkeypatch.setattr(clone_tools, "SANDBOX_ROOT", str(sandbox_root))
    mock_run_command(clone_tools, stdout="ok", returncode=0)

    # Make the directory read-only after mock clone creates it, so meta write fails
    def _patched_write_meta(path: Path, meta: dict) -> None:
        raise OSError("Read-only filesystem")

    monkeypatch.setattr(clone_tools, "_write_clone_meta", _patched_write_meta)

    result = _run_clone("https://github.com/octo/demo-repo")

    assert result["status"] == "ok", "clone must succeed even if .clone_meta.json write fails"


# ---------------------------------------------------------------------------
# Task 2.3 — workspace_delete includes cloned_by/cloned_at when meta present
# ---------------------------------------------------------------------------


def test_workspace_delete_includes_ownership_from_meta(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    workspace_root = tmp_path / "workspace"
    repo_dir = workspace_root / "django"
    repo_dir.mkdir(parents=True)
    meta = {
        "cloned_by": "user-abc-123",
        "cloned_at": "2026-04-11T00:00:00",
        "repo_url": "https://github.com/django/django.git",
        "location": "workspace",
    }
    (repo_dir / ".clone_meta.json").write_text(json.dumps(meta))
    monkeypatch.setattr(clone_tools, "WORKSPACE_ROOT", str(workspace_root))

    result = _run_delete("workspace", "django")

    assert result["status"] == "awaiting_ui_confirmation"
    assert result["cloned_by"] == "user-abc-123"
    assert result["cloned_at"] == "2026-04-11T00:00:00"


def test_sandbox_delete_includes_ownership_from_meta(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    sandbox_root = tmp_path / "analysis"
    repo_dir = sandbox_root / "flask"
    repo_dir.mkdir(parents=True)
    meta = {"cloned_by": "user-xyz", "cloned_at": "2026-04-11T01:00:00"}
    (repo_dir / ".clone_meta.json").write_text(json.dumps(meta))
    monkeypatch.setattr(clone_tools, "SANDBOX_ROOT", str(sandbox_root))

    result = _run_delete("sandbox", "flask")

    assert result["status"] == "deleted"
    assert result["cloned_by"] == "user-xyz"
    assert result["cloned_at"] == "2026-04-11T01:00:00"


# ---------------------------------------------------------------------------
# Task 2.4 — workspace_delete proceeds normally when .clone_meta.json missing
# ---------------------------------------------------------------------------


def test_workspace_delete_no_meta_still_works(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    workspace_root = tmp_path / "workspace"
    repo_dir = workspace_root / "myrepo"
    repo_dir.mkdir(parents=True)
    monkeypatch.setattr(clone_tools, "WORKSPACE_ROOT", str(workspace_root))
    # No .clone_meta.json written

    result = _run_delete("workspace", "myrepo")

    assert result["status"] == "awaiting_ui_confirmation"
    assert "cloned_by" not in result
    assert "cloned_at" not in result


def test_sandbox_delete_no_meta_still_works(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    sandbox_root = tmp_path / "analysis"
    repo_dir = sandbox_root / "myrepo"
    repo_dir.mkdir(parents=True)
    monkeypatch.setattr(clone_tools, "SANDBOX_ROOT", str(sandbox_root))

    result = _run_delete("sandbox", "myrepo")

    assert result["status"] == "deleted"
    assert "cloned_by" not in result
