from __future__ import annotations

import asyncio
import json
import subprocess
from pathlib import Path

import pytest

import cognitive_code_agent.tools.shell_tools as shell_tools
from cognitive_code_agent.tools.common import CommandResult


pytestmark = pytest.mark.unit


def _run_shell_execute(command: str, repo_path: Path, timeout_seconds: int = 30) -> dict:
    async def _invoke() -> str:
        async with shell_tools.shell_execute_tool(
            shell_tools.ShellExecuteConfig(), builder=None
        ) as function_info:
            payload = function_info.input_schema(
                command=command,
                repo_path=str(repo_path),
                timeout_seconds=timeout_seconds,
            )
            return await function_info.single_fn(payload)

    raw_result = asyncio.run(_invoke())
    return json.loads(raw_result)


def test_shell_execute_returns_timeout_for_subprocess_timeout(monkeypatch, tmp_path: Path) -> None:
    sandbox_root = tmp_path / "analysis"
    repo_path = sandbox_root / "demo-repo"
    repo_path.mkdir(parents=True)

    monkeypatch.setattr(shell_tools, "SANDBOX_ROOT", str(sandbox_root))
    monkeypatch.setattr(shell_tools, "ALLOWED_REPO_ROOTS", [str(sandbox_root)])

    def _raise_timeout(*args, **kwargs):
        raise subprocess.TimeoutExpired(cmd=["bash", "-lc", "sleep 10"], timeout=1)

    monkeypatch.setattr(shell_tools, "run_command", _raise_timeout)

    result = _run_shell_execute("ls", repo_path, timeout_seconds=1)

    assert result["status"] == "timeout"
    assert "timed out" in result["message"]


def test_shell_execute_accepts_workspace_path_when_allowed(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    sandbox_root = tmp_path / "analysis"
    workspace_root = tmp_path / "workspace"
    repo_path = workspace_root / "demo-repo"
    repo_path.mkdir(parents=True)

    monkeypatch.setattr(shell_tools, "SANDBOX_ROOT", str(sandbox_root))
    monkeypatch.setattr(
        shell_tools,
        "ALLOWED_REPO_ROOTS",
        [str(sandbox_root), str(workspace_root)],
        raising=False,
    )

    def _fake_run(command, timeout: int = 60, cwd: Path | None = None):
        return CommandResult(
            command=list(command),
            returncode=0,
            stdout="ok\n",
            stderr="",
            duration_ms=12,
        )

    monkeypatch.setattr(shell_tools, "run_command", _fake_run)

    result = _run_shell_execute("pwd", repo_path, timeout_seconds=5)

    assert result["status"] == "ok"
    assert result["repo_path"] == str(repo_path.resolve())
