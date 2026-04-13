from __future__ import annotations

from pathlib import Path
import subprocess

import pytest

import cognitive_code_agent.tools.common as common
from cognitive_code_agent.tools.common import CommandResult
from cognitive_code_agent.tools.common import ensure_repo_path
from cognitive_code_agent.tools.common import json_response
from cognitive_code_agent.tools.common import is_non_retryable_error
from cognitive_code_agent.tools.common import redact_secrets
from cognitive_code_agent.tools.common import run_command


pytestmark = pytest.mark.unit


def test_ensure_repo_path_accepts_sandbox_path(tmp_path: Path) -> None:
    sandbox_root = tmp_path / "analysis"
    repo = sandbox_root / "repo"
    repo.mkdir(parents=True)

    resolved = ensure_repo_path(str(repo), sandbox_root=str(sandbox_root))

    assert resolved == repo.resolve()


def test_ensure_repo_path_rejects_path_outside_sandbox(tmp_path: Path) -> None:
    sandbox_root = tmp_path / "analysis"
    sandbox_root.mkdir()
    outside = tmp_path / "outside-repo"
    outside.mkdir()

    with pytest.raises(ValueError):
        ensure_repo_path(str(outside), sandbox_root=str(sandbox_root))


def test_ensure_repo_path_accepts_path_inside_any_allowed_root(tmp_path: Path) -> None:
    sandbox_root = tmp_path / "analysis"
    workspace_root = tmp_path / "workspace"
    repo = workspace_root / "project"
    repo.mkdir(parents=True)

    resolved = ensure_repo_path(
        str(repo),
        allowed_roots=[str(sandbox_root), str(workspace_root)],
    )

    assert resolved == repo.resolve()


def test_redact_secrets_masks_aws_like_tokens() -> None:
    text = "credential=AKIA1234567890ABCDEF"
    redacted = redact_secrets(text)
    assert "AKIA1234567890ABCDEF" not in redacted
    assert "***REDACTED***" in redacted


def test_run_command_returns_metadata(tmp_path: Path) -> None:
    result = run_command(["python3", "-c", "print('ok')"], timeout=5, cwd=tmp_path)

    assert isinstance(result, CommandResult)
    assert result.returncode == 0
    assert result.stdout.strip() == "ok"
    assert result.duration_ms >= 0


def test_run_command_raises_timeout(tmp_path: Path) -> None:
    with pytest.raises(subprocess.TimeoutExpired):
        run_command(["python3", "-c", "import time; time.sleep(2)"], timeout=1, cwd=tmp_path)


def test_json_response_serializes_ascii_payload() -> None:
    raw = json_response({"status": "ok", "count": 2})
    assert raw == '{"status": "ok", "count": 2}'


def test_command_result_to_dict() -> None:
    result = common.CommandResult(
        command=["pytest", "-q"],
        returncode=0,
        stdout="done",
        stderr="",
        duration_ms=10,
    )

    payload = result.to_dict()
    assert payload["command"] == ["pytest", "-q"]
    assert payload["returncode"] == 0


def test_is_non_retryable_error_detects_sandbox_and_path_errors() -> None:
    assert is_non_retryable_error("Path /app is outside sandbox root /tmp/analysis") is True
    assert is_non_retryable_error(FileNotFoundError("Repository path does not exist")) is True
    assert is_non_retryable_error("timed out while running tool") is True
    assert is_non_retryable_error("Timeout reached without a successful response") is True
