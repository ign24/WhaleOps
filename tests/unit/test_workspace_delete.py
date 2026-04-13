"""Unit tests for workspace_delete tool — TDD RED phase."""
from __future__ import annotations

import asyncio
import json
import shutil
from pathlib import Path

import pytest

import cognitive_code_agent.tools.clone_tools as clone_tools


pytestmark = pytest.mark.unit


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _run_delete(
    location: str,
    target: str,
    *,
    sandbox_root: str | None = None,
    workspace_root: str | None = None,
    monkeypatch: pytest.MonkeyPatch | None = None,
) -> dict:
    async def _invoke() -> str:
        async with clone_tools.workspace_delete_tool(
            clone_tools.WorkspaceDeleteConfig(), builder=None
        ) as function_info:
            payload = function_info.input_schema(location=location, target=target)
            return await function_info.single_fn(payload)

    return json.loads(asyncio.run(_invoke()))


# ---------------------------------------------------------------------------
# Task 1.1 — Sandbox delete paths
# ---------------------------------------------------------------------------


class TestSandboxDelete:
    def test_sandbox_delete_success(self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
        sandbox_root = tmp_path / "analysis"
        repo_dir = sandbox_root / "django"
        repo_dir.mkdir(parents=True)
        (repo_dir / "file.txt").write_text("hello")
        monkeypatch.setattr(clone_tools, "SANDBOX_ROOT", str(sandbox_root))

        result = _run_delete("sandbox", "django")

        assert result["status"] == "deleted"
        assert result["location"] == "sandbox"
        assert "size_freed_mb" in result
        assert isinstance(result["size_freed_mb"], (int, float))
        assert not repo_dir.exists()

    def test_sandbox_delete_not_found(
        self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
    ) -> None:
        sandbox_root = tmp_path / "analysis"
        sandbox_root.mkdir(parents=True)
        monkeypatch.setattr(clone_tools, "SANDBOX_ROOT", str(sandbox_root))

        result = _run_delete("sandbox", "nonexistent")

        assert result["status"] == "not_found"
        assert result["retryable"] is False

    def test_sandbox_delete_execution_error(
        self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
    ) -> None:
        sandbox_root = tmp_path / "analysis"
        repo_dir = sandbox_root / "locked-repo"
        repo_dir.mkdir(parents=True)
        monkeypatch.setattr(clone_tools, "SANDBOX_ROOT", str(sandbox_root))

        def _raise_oserror(path: str | Path, **kwargs: object) -> None:
            raise OSError("Permission denied")

        monkeypatch.setattr(shutil, "rmtree", _raise_oserror)

        result = _run_delete("sandbox", "locked-repo")

        assert result["status"] == "execution_error"
        assert result["retryable"] is True
        assert result["error_type"] == "execution_error"

    def test_sandbox_delete_path_traversal_blocked(
        self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
    ) -> None:
        sandbox_root = tmp_path / "analysis"
        sandbox_root.mkdir(parents=True)
        monkeypatch.setattr(clone_tools, "SANDBOX_ROOT", str(sandbox_root))

        result = _run_delete("sandbox", "../etc")

        assert result["status"] == "blocked"
        assert result["retryable"] is False

    def test_sandbox_delete_absolute_path_blocked(
        self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
    ) -> None:
        sandbox_root = tmp_path / "analysis"
        sandbox_root.mkdir(parents=True)
        monkeypatch.setattr(clone_tools, "SANDBOX_ROOT", str(sandbox_root))

        result = _run_delete("sandbox", "/etc/hosts")

        assert result["status"] == "blocked"
        assert result["retryable"] is False


# ---------------------------------------------------------------------------
# Task 1.2 — Workspace delete paths (PIN-gated)
# ---------------------------------------------------------------------------


class TestWorkspaceDelete:
    def test_workspace_delete_returns_awaiting_confirmation(
        self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
    ) -> None:
        workspace_root = tmp_path / "workspace"
        repo_dir = workspace_root / "fastapi"
        repo_dir.mkdir(parents=True)
        (repo_dir / "main.py").write_text("# hello")
        monkeypatch.setattr(clone_tools, "WORKSPACE_ROOT", str(workspace_root))

        result = _run_delete("workspace", "fastapi")

        assert result["status"] == "awaiting_ui_confirmation"
        assert "confirmation_token" in result
        # token must be a UUID v4 (36-char with dashes)
        token = result["confirmation_token"]
        assert len(token) == 36
        assert token.count("-") == 4
        assert "target_path" in result
        assert "size_mb" in result
        # no filesystem changes
        assert repo_dir.exists()

    def test_workspace_delete_not_found_no_token(
        self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
    ) -> None:
        workspace_root = tmp_path / "workspace"
        workspace_root.mkdir(parents=True)
        monkeypatch.setattr(clone_tools, "WORKSPACE_ROOT", str(workspace_root))

        result = _run_delete("workspace", "nonexistent")

        assert result["status"] == "not_found"
        assert result["retryable"] is False
        assert "confirmation_token" not in result

    def test_workspace_delete_path_traversal_blocked(
        self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
    ) -> None:
        workspace_root = tmp_path / "workspace"
        workspace_root.mkdir(parents=True)
        monkeypatch.setattr(clone_tools, "WORKSPACE_ROOT", str(workspace_root))

        result = _run_delete("workspace", "../etc")

        assert result["status"] == "blocked"
        assert result["retryable"] is False
        assert "confirmation_token" not in result

    def test_workspace_delete_does_not_delete_immediately(
        self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
    ) -> None:
        workspace_root = tmp_path / "workspace"
        repo_dir = workspace_root / "myrepo"
        repo_dir.mkdir(parents=True)
        monkeypatch.setattr(clone_tools, "WORKSPACE_ROOT", str(workspace_root))

        _run_delete("workspace", "myrepo")

        assert repo_dir.exists(), "workspace delete must NOT remove dir immediately"


# ---------------------------------------------------------------------------
# Task 1.3 — Structured JSON contract on every response path
# ---------------------------------------------------------------------------


class TestStructuredResponseContract:
    """Every response must have status, message, retryable — no exceptions."""

    REQUIRED_FIELDS = {"status", "message", "retryable"}

    def _assert_contract(self, result: dict) -> None:
        for field in self.REQUIRED_FIELDS:
            assert field in result, f"missing field '{field}' in response: {result}"

    def test_sandbox_success_has_required_fields(
        self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
    ) -> None:
        sandbox_root = tmp_path / "analysis"
        (sandbox_root / "repo").mkdir(parents=True)
        monkeypatch.setattr(clone_tools, "SANDBOX_ROOT", str(sandbox_root))

        result = _run_delete("sandbox", "repo")
        self._assert_contract(result)

    def test_sandbox_not_found_has_required_fields(
        self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
    ) -> None:
        sandbox_root = tmp_path / "analysis"
        sandbox_root.mkdir(parents=True)
        monkeypatch.setattr(clone_tools, "SANDBOX_ROOT", str(sandbox_root))

        result = _run_delete("sandbox", "nope")
        self._assert_contract(result)

    def test_sandbox_execution_error_has_required_fields(
        self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
    ) -> None:
        sandbox_root = tmp_path / "analysis"
        (sandbox_root / "repo").mkdir(parents=True)
        monkeypatch.setattr(clone_tools, "SANDBOX_ROOT", str(sandbox_root))
        monkeypatch.setattr(shutil, "rmtree", lambda *a, **kw: (_ for _ in ()).throw(OSError("err")))

        result = _run_delete("sandbox", "repo")
        self._assert_contract(result)
        assert "error_type" in result

    def test_blocked_has_required_fields(
        self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
    ) -> None:
        sandbox_root = tmp_path / "analysis"
        sandbox_root.mkdir(parents=True)
        monkeypatch.setattr(clone_tools, "SANDBOX_ROOT", str(sandbox_root))

        result = _run_delete("sandbox", "../etc")
        self._assert_contract(result)

    def test_workspace_awaiting_has_required_fields(
        self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
    ) -> None:
        workspace_root = tmp_path / "workspace"
        (workspace_root / "repo").mkdir(parents=True)
        monkeypatch.setattr(clone_tools, "WORKSPACE_ROOT", str(workspace_root))

        result = _run_delete("workspace", "repo")
        self._assert_contract(result)

    def test_workspace_not_found_has_required_fields(
        self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
    ) -> None:
        workspace_root = tmp_path / "workspace"
        workspace_root.mkdir(parents=True)
        monkeypatch.setattr(clone_tools, "WORKSPACE_ROOT", str(workspace_root))

        result = _run_delete("workspace", "nope")
        self._assert_contract(result)

    def test_invalid_location_has_required_fields(
        self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
    ) -> None:
        sandbox_root = tmp_path / "analysis"
        sandbox_root.mkdir(parents=True)
        monkeypatch.setattr(clone_tools, "SANDBOX_ROOT", str(sandbox_root))

        result = _run_delete("invalid_location", "repo")
        self._assert_contract(result)


# ---------------------------------------------------------------------------
# File deletion support
# ---------------------------------------------------------------------------


class TestFileDeletion:
    """workspace_delete must handle individual files, not just directories."""

    def test_sandbox_file_delete_success(
        self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
    ) -> None:
        sandbox_root = tmp_path / "analysis"
        sandbox_root.mkdir(parents=True)
        target_file = sandbox_root / "report.txt"
        target_file.write_text("some content")
        monkeypatch.setattr(clone_tools, "SANDBOX_ROOT", str(sandbox_root))

        result = _run_delete("sandbox", "report.txt")

        assert result["status"] == "deleted"
        assert result["location"] == "sandbox"
        assert "size_freed_mb" in result
        assert not target_file.exists()

    def test_workspace_file_returns_awaiting_confirmation(
        self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
    ) -> None:
        workspace_root = tmp_path / "workspace"
        workspace_root.mkdir(parents=True)
        target_file = workspace_root / "notes.md"
        target_file.write_text("# Notes\nImportant stuff")
        monkeypatch.setattr(clone_tools, "WORKSPACE_ROOT", str(workspace_root))

        result = _run_delete("workspace", "notes.md")

        assert result["status"] == "awaiting_ui_confirmation"
        assert "confirmation_token" in result
        assert target_file.exists(), "workspace file must NOT be deleted immediately"

    def test_file_size_reported_correctly(
        self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
    ) -> None:
        sandbox_root = tmp_path / "analysis"
        sandbox_root.mkdir(parents=True)
        target_file = sandbox_root / "data.bin"
        target_file.write_bytes(b"x" * 2048)
        monkeypatch.setattr(clone_tools, "SANDBOX_ROOT", str(sandbox_root))

        result = _run_delete("sandbox", "data.bin")

        assert result["status"] == "deleted"
        assert isinstance(result["size_freed_mb"], (int, float))
