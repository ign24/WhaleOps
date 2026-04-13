from __future__ import annotations

import asyncio
import json
from pathlib import Path

import pytest

import cognitive_code_agent.tools.qa_tools as qa_tools
import cognitive_code_agent.tools.shell_tools as shell_tools


pytestmark = pytest.mark.integration


def _invoke_tool(tool_cm, payload: dict) -> dict:
    async def _run() -> str:
        async with tool_cm as function_info:
            try:
                return await function_info.single_fn(**payload)
            except TypeError:
                tool_input = function_info.input_schema(**payload)
                return await function_info.single_fn(tool_input)

    return json.loads(asyncio.run(_run()))


def test_analyze_test_coverage_handles_missing_coverage_binary(
    mock_run_command, tmp_sandbox: Path, monkeypatch
) -> None:
    repo = tmp_sandbox / "repo"
    monkeypatch.setattr(qa_tools, "ensure_repo_path", lambda *args, **kwargs: repo)
    mock_run_command(qa_tools, side_effect=FileNotFoundError("coverage not found"))

    payload = _invoke_tool(
        qa_tools.analyze_test_coverage_tool(qa_tools.AnalyzeCoverageConfig(), builder=None),
        {"repo_path": str(repo), "language": "python"},
    )

    assert payload["total_coverage"] == 0.0
    assert payload["warning"] == "coverage command not available"


def test_shell_execute_maps_file_not_found_to_error(
    mock_run_command, tmp_sandbox: Path, monkeypatch
) -> None:
    repo = tmp_sandbox / "repo"
    monkeypatch.setattr(shell_tools, "SANDBOX_ROOT", str(tmp_sandbox))
    monkeypatch.setattr(shell_tools, "ALLOWED_REPO_ROOTS", [str(tmp_sandbox)])
    monkeypatch.setenv("SAFETY_MODE", "permissive")
    mock_run_command(shell_tools, side_effect=FileNotFoundError("bash missing"))

    payload = _invoke_tool(
        shell_tools.shell_execute_tool(shell_tools.ShellExecuteConfig(), builder=None),
        {"command": "ls", "repo_path": str(repo), "timeout_seconds": 5},
    )

    assert payload["status"] == "error"
    assert "Executable not found" in payload["message"]


def test_shell_execute_maps_timeout_to_timeout_status(
    mock_run_command, tmp_sandbox: Path, monkeypatch
) -> None:
    repo = tmp_sandbox / "repo"
    monkeypatch.setattr(shell_tools, "SANDBOX_ROOT", str(tmp_sandbox))
    monkeypatch.setattr(shell_tools, "ALLOWED_REPO_ROOTS", [str(tmp_sandbox)])
    monkeypatch.setenv("SAFETY_MODE", "permissive")
    mock_run_command(shell_tools, side_effect=TimeoutError("timed out"))

    payload = _invoke_tool(
        shell_tools.shell_execute_tool(shell_tools.ShellExecuteConfig(), builder=None),
        {"command": "ls", "repo_path": str(repo), "timeout_seconds": 1},
    )

    assert payload["status"] == "timeout"
    assert "timed out" in payload["message"]


def test_shell_execute_invalid_repo_path_is_non_retryable(tmp_sandbox: Path, monkeypatch) -> None:
    repo = tmp_sandbox.parent / "outside-repo"
    repo.mkdir()
    monkeypatch.setattr(shell_tools, "SANDBOX_ROOT", str(tmp_sandbox))
    monkeypatch.setenv("SAFETY_MODE", "permissive")

    payload = _invoke_tool(
        shell_tools.shell_execute_tool(shell_tools.ShellExecuteConfig(), builder=None),
        {"command": "ls", "repo_path": str(repo), "timeout_seconds": 5},
    )

    assert payload["status"] == "error"
    assert payload["error_type"] == "invalid_repo_path"
    assert payload["retryable"] is False
