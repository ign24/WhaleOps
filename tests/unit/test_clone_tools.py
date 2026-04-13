from __future__ import annotations

import asyncio
import json
import subprocess
from pathlib import Path

import pytest

import cognitive_code_agent.tools.clone_tools as clone_tools


pytestmark = pytest.mark.unit


def _run_clone(
    repo_url: str,
    dest_name: str | None = None,
    destination_root: str | None = None,
    shallow: bool | None = None,
    timeout_seconds: int | None = None,
) -> dict:
    async def _invoke() -> str:
        async with clone_tools.clone_repository_tool(
            clone_tools.CloneRepositoryConfig(), builder=None
        ) as function_info:
            payload_kwargs: dict = {"repo_url": repo_url}
            if dest_name is not None:
                payload_kwargs["dest_name"] = dest_name
            payload_kwargs["destination_root"] = destination_root or "analysis"
            if shallow is not None:
                payload_kwargs["shallow"] = shallow
            if timeout_seconds is not None:
                payload_kwargs["timeout_seconds"] = timeout_seconds
            payload = function_info.input_schema(**payload_kwargs)
            return await function_info.single_fn(payload)

    raw_result = asyncio.run(_invoke())
    return json.loads(raw_result)


def test_clone_public_repo_success(monkeypatch, tmp_sandbox: Path, mock_run_command) -> None:
    monkeypatch.setattr(clone_tools, "SANDBOX_ROOT", str(tmp_sandbox))
    monkeypatch.delenv("GITHUB_PERSONAL_ACCESS_TOKEN", raising=False)
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)
    calls = mock_run_command(clone_tools, stdout="cloning...", returncode=0, duration_ms=321)

    result = _run_clone("https://github.com/octo/demo-repo")

    assert result["status"] == "ok"
    assert result["repo_path"] == str(tmp_sandbox / "demo-repo")
    assert result["auth_used"] == "none"
    assert result["returncode"] == 0
    assert result["duration_ms"] == 321
    assert calls[0]["command"][0:2] == ["git", "clone"]


def test_clone_supports_workspace_destination_root(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    mock_run_command,
) -> None:
    sandbox_root = tmp_path / "analysis"
    workspace_root = tmp_path / "workspace"
    monkeypatch.setattr(clone_tools, "SANDBOX_ROOT", str(sandbox_root))
    monkeypatch.setattr(clone_tools, "WORKSPACE_ROOT", str(workspace_root))
    calls = mock_run_command(clone_tools, stdout="ok", returncode=0)

    result = _run_clone(
        "https://github.com/octo/demo-repo",
        destination_root="workspace",
    )

    assert result["status"] == "ok"
    assert result["repo_path"] == str(workspace_root / "demo-repo")
    assert calls[0]["command"][0:2] == ["git", "clone"]


def test_clone_injects_token_for_private_repo(
    monkeypatch, tmp_sandbox: Path, mock_run_command
) -> None:
    monkeypatch.setattr(clone_tools, "SANDBOX_ROOT", str(tmp_sandbox))
    monkeypatch.setenv("GITHUB_PERSONAL_ACCESS_TOKEN", "ghp_secret_token_value")
    calls = mock_run_command(clone_tools, stdout="ok", returncode=0)

    result = _run_clone("https://github.com/octo/private-repo")

    assert result["status"] == "ok"
    assert result["auth_used"] == "token"
    assert "ghp_secret_token_value" in calls[0]["command"][2]


def test_clone_rejects_non_github_url(monkeypatch, tmp_sandbox: Path) -> None:
    monkeypatch.setattr(clone_tools, "SANDBOX_ROOT", str(tmp_sandbox))

    result = _run_clone("https://gitlab.com/group/repo")

    assert result["status"] == "error"
    assert result["error_type"] == "validation_error"


def test_clone_rejects_existing_destination(monkeypatch, tmp_sandbox: Path) -> None:
    monkeypatch.setattr(clone_tools, "SANDBOX_ROOT", str(tmp_sandbox))
    (tmp_sandbox / "demo-repo").mkdir()

    result = _run_clone("https://github.com/octo/demo-repo")

    assert result["status"] == "error"
    assert result["retryable"] is False


def test_clone_redacts_token_from_output(monkeypatch, tmp_sandbox: Path, mock_run_command) -> None:
    token = "ghp_sensitive_token"
    monkeypatch.setattr(clone_tools, "SANDBOX_ROOT", str(tmp_sandbox))
    monkeypatch.setenv("GITHUB_PERSONAL_ACCESS_TOKEN", token)
    stderr = (
        f"fatal: could not read from https://x-access-token:{token}@github.com/octo/private.git"
    )
    mock_run_command(clone_tools, stdout="", stderr=stderr, returncode=128)

    result = _run_clone("https://github.com/octo/private")

    assert result["status"] == "error"
    assert token not in result["stderr"]
    assert "***REDACTED***" in result["stderr"]


def test_clone_handles_timeout(monkeypatch, tmp_sandbox: Path, mock_run_command) -> None:
    monkeypatch.setattr(clone_tools, "SANDBOX_ROOT", str(tmp_sandbox))
    timeout_exc = subprocess.TimeoutExpired(cmd=["git", "clone"], timeout=120)
    mock_run_command(clone_tools, side_effect=timeout_exc)

    result = _run_clone("https://github.com/octo/slow-repo")

    assert result["status"] == "timeout"
    assert result["retryable"] is True


def test_clone_rejects_invalid_dest_name(monkeypatch, tmp_sandbox: Path) -> None:
    monkeypatch.setattr(clone_tools, "SANDBOX_ROOT", str(tmp_sandbox))

    result = _run_clone("https://github.com/octo/demo-repo", dest_name="../escape")

    assert result["status"] == "error"
    assert result["error_type"] == "validation_error"


def test_clone_rejects_unsupported_destination_root(monkeypatch, tmp_sandbox: Path) -> None:
    monkeypatch.setattr(clone_tools, "SANDBOX_ROOT", str(tmp_sandbox))

    result = _run_clone(
        "https://github.com/octo/demo-repo",
        destination_root="invalid-root",
    )

    assert result["status"] == "error"
    assert result["error_type"] == "validation_error"
    assert "destination_root" in result["message"]


def test_clone_rejects_destination_that_resolves_outside_selected_root(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    sandbox_root = tmp_path / "analysis"
    workspace_root = tmp_path / "workspace"
    monkeypatch.setattr(clone_tools, "SANDBOX_ROOT", str(sandbox_root))
    monkeypatch.setattr(clone_tools, "WORKSPACE_ROOT", str(workspace_root))

    result = _run_clone(
        "https://github.com/octo/demo-repo",
        dest_name="..",
        destination_root="workspace",
    )

    assert result["status"] == "error"
    assert result["error_type"] == "validation_error"
    assert "outside" in result["message"]


def test_shallow_clone_passes_depth_and_filter_flags(
    monkeypatch, tmp_sandbox: Path, mock_run_command
) -> None:
    monkeypatch.setattr(clone_tools, "SANDBOX_ROOT", str(tmp_sandbox))
    calls = mock_run_command(clone_tools, stdout="ok", returncode=0)

    result = _run_clone("https://github.com/octo/big-repo", shallow=True)

    assert result["status"] == "ok"
    assert result["clone_type"] == "shallow"
    cmd = calls[0]["command"]
    assert "--depth" in cmd
    assert "1" in cmd
    assert "--filter=blob:none" in cmd


def test_full_clone_omits_shallow_flags(monkeypatch, tmp_sandbox: Path, mock_run_command) -> None:
    monkeypatch.setattr(clone_tools, "SANDBOX_ROOT", str(tmp_sandbox))
    calls = mock_run_command(clone_tools, stdout="ok", returncode=0)

    result = _run_clone("https://github.com/octo/demo-repo", shallow=False)

    assert result["status"] == "ok"
    assert result["clone_type"] == "full"
    cmd = calls[0]["command"]
    assert "--depth" not in cmd
    assert "--filter=blob:none" not in cmd


def test_timeout_seconds_is_forwarded(monkeypatch, tmp_sandbox: Path, mock_run_command) -> None:
    monkeypatch.setattr(clone_tools, "SANDBOX_ROOT", str(tmp_sandbox))
    calls = mock_run_command(clone_tools, stdout="ok", returncode=0)

    _run_clone("https://github.com/octo/demo-repo", timeout_seconds=300)

    assert calls[0]["timeout"] == 300


def test_timeout_seconds_is_capped_at_600(monkeypatch, tmp_sandbox: Path, mock_run_command) -> None:
    monkeypatch.setattr(clone_tools, "SANDBOX_ROOT", str(tmp_sandbox))
    calls = mock_run_command(clone_tools, stdout="ok", returncode=0)

    _run_clone("https://github.com/octo/demo-repo", timeout_seconds=700)

    assert calls[0]["timeout"] == 600


class TestNormalizeRepoUrl:
    def test_strips_git_suffix(self) -> None:
        assert clone_tools._normalize_repo_url("https://github.com/owner/repo.git") == (
            "https://github.com/owner/repo"
        )

    def test_strips_trailing_slash(self) -> None:
        assert clone_tools._normalize_repo_url("https://github.com/owner/repo/") == (
            "https://github.com/owner/repo"
        )

    def test_strips_auth_token(self) -> None:
        url = "https://x-access-token:ghp_secret@github.com/owner/repo.git"
        assert clone_tools._normalize_repo_url(url) == "https://github.com/owner/repo"

    def test_noop_on_clean_url(self) -> None:
        assert clone_tools._normalize_repo_url("https://github.com/owner/repo") == (
            "https://github.com/owner/repo"
        )


class TestCheckExistingClone:
    def test_returns_match_for_same_repo(self, tmp_path: Path) -> None:
        repo_dir = tmp_path / "myrepo"
        repo_dir.mkdir()
        subprocess.run(["git", "init", str(repo_dir)], check=True, capture_output=True)
        subprocess.run(
            [
                "git",
                "-C",
                str(repo_dir),
                "remote",
                "add",
                "origin",
                "https://github.com/owner/repo.git",
            ],
            check=True,
            capture_output=True,
        )
        result = clone_tools._check_existing_clone(repo_dir, "https://github.com/owner/repo")
        assert result is not None
        assert result["outcome"] == "match"

    def test_returns_conflict_for_different_repo(self, tmp_path: Path) -> None:
        repo_dir = tmp_path / "myrepo"
        repo_dir.mkdir()
        subprocess.run(["git", "init", str(repo_dir)], check=True, capture_output=True)
        subprocess.run(
            [
                "git",
                "-C",
                str(repo_dir),
                "remote",
                "add",
                "origin",
                "https://github.com/other/different.git",
            ],
            check=True,
            capture_output=True,
        )
        result = clone_tools._check_existing_clone(repo_dir, "https://github.com/owner/repo")
        assert result is not None
        assert result["outcome"] == "conflict"

    def test_returns_error_for_non_git_dir(self, tmp_path: Path) -> None:
        plain_dir = tmp_path / "plain"
        plain_dir.mkdir()
        result = clone_tools._check_existing_clone(plain_dir, "https://github.com/owner/repo")
        assert result is not None
        assert result["outcome"] == "error"

    def test_returns_none_for_nonexistent_dir(self, tmp_path: Path) -> None:
        result = clone_tools._check_existing_clone(
            tmp_path / "nope", "https://github.com/owner/repo"
        )
        assert result is None


class TestIdempotentClone:
    def test_clone_reuses_existing_matching_repo(self, monkeypatch, tmp_sandbox: Path) -> None:
        monkeypatch.setattr(clone_tools, "SANDBOX_ROOT", str(tmp_sandbox))
        repo_dir = tmp_sandbox / "demo-repo"
        repo_dir.mkdir(parents=True, exist_ok=True)
        subprocess.run(["git", "init", str(repo_dir)], check=True, capture_output=True)
        subprocess.run(
            [
                "git",
                "-C",
                str(repo_dir),
                "remote",
                "add",
                "origin",
                "https://github.com/octo/demo-repo.git",
            ],
            check=True,
            capture_output=True,
        )

        result = _run_clone("https://github.com/octo/demo-repo")

        assert result["status"] == "ok"
        assert result["clone_type"] == "existing"
        assert result["repo_path"] == str(repo_dir)

    def test_clone_rejects_existing_different_repo(self, monkeypatch, tmp_sandbox: Path) -> None:
        monkeypatch.setattr(clone_tools, "SANDBOX_ROOT", str(tmp_sandbox))
        repo_dir = tmp_sandbox / "demo-repo"
        repo_dir.mkdir(parents=True, exist_ok=True)
        subprocess.run(["git", "init", str(repo_dir)], check=True, capture_output=True)
        subprocess.run(
            [
                "git",
                "-C",
                str(repo_dir),
                "remote",
                "add",
                "origin",
                "https://github.com/other/different.git",
            ],
            check=True,
            capture_output=True,
        )

        result = _run_clone("https://github.com/octo/demo-repo")

        assert result["status"] == "error"
        assert result["retryable"] is False
        assert "conflict" in result["message"].lower() or "different" in result["message"].lower()

    def test_clone_rejects_existing_non_git_dir(self, monkeypatch, tmp_sandbox: Path) -> None:
        monkeypatch.setattr(clone_tools, "SANDBOX_ROOT", str(tmp_sandbox))
        (tmp_sandbox / "demo-repo").mkdir(parents=True, exist_ok=True)

        result = _run_clone("https://github.com/octo/demo-repo")

        assert result["status"] == "error"
        assert result["retryable"] is False

    def test_clone_rejects_corrupted_git_dir(self, monkeypatch, tmp_sandbox: Path) -> None:
        monkeypatch.setattr(clone_tools, "SANDBOX_ROOT", str(tmp_sandbox))
        repo_dir = tmp_sandbox / "demo-repo"
        repo_dir.mkdir(parents=True, exist_ok=True)
        (repo_dir / ".git").mkdir()  # broken git dir

        result = _run_clone("https://github.com/octo/demo-repo")

        assert result["status"] == "error"
        assert result["retryable"] is False


def test_timeout_error_includes_hint(monkeypatch, tmp_sandbox: Path, mock_run_command) -> None:
    monkeypatch.setattr(clone_tools, "SANDBOX_ROOT", str(tmp_sandbox))
    timeout_exc = subprocess.TimeoutExpired(cmd=["git", "clone"], timeout=120)
    mock_run_command(clone_tools, side_effect=timeout_exc)

    result = _run_clone("https://github.com/octo/slow-repo")

    assert result["status"] == "timeout"
    assert "hint" in result
    assert result["retryable"] is True
