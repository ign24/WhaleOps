from __future__ import annotations

import asyncio
import json
from pathlib import Path

import cognitive_code_agent.tools.shell_tools as shell_tools


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


def test_shell_execute_enforces_strict_mode_tiers(monkeypatch, tmp_path: Path) -> None:
    sandbox_root = tmp_path / "analysis"
    repo_path = sandbox_root / "demo-repo"
    repo_path.mkdir(parents=True)
    (repo_path / "README.md").write_text("demo\n", encoding="utf-8")

    monkeypatch.setattr(shell_tools, "SANDBOX_ROOT", str(sandbox_root))
    monkeypatch.setattr(shell_tools, "ALLOWED_REPO_ROOTS", [str(sandbox_root)])
    monkeypatch.setenv("SAFETY_MODE", "strict")

    tier_1_result = _run_shell_execute("ls", repo_path)
    assert tier_1_result["status"] == "ok"
    assert tier_1_result["tier"] == "TIER_1_AUTO"
    assert tier_1_result["returncode"] == 0

    tier_2_result = _run_shell_execute("touch created.tmp", repo_path)
    assert tier_2_result["status"] == "blocked"
    assert tier_2_result["tier"] == "TIER_2_CONFIRM"
    assert not (repo_path / "created.tmp").exists()

    tier_3_result = _run_shell_execute("sudo ls", repo_path)
    assert tier_3_result["status"] == "blocked"
    assert tier_3_result["tier"] == "TIER_3_BLOCKED"


def test_shell_execute_allows_tier_2_in_standard_mode(monkeypatch, tmp_path: Path) -> None:
    sandbox_root = tmp_path / "analysis"
    repo_path = sandbox_root / "demo-repo"
    repo_path.mkdir(parents=True)

    monkeypatch.setattr(shell_tools, "SANDBOX_ROOT", str(sandbox_root))
    monkeypatch.setattr(shell_tools, "ALLOWED_REPO_ROOTS", [str(sandbox_root)])
    monkeypatch.setenv("SAFETY_MODE", "standard")

    result = _run_shell_execute("touch created.tmp", repo_path)

    assert result["status"] == "ok"
    assert result["tier"] == "TIER_2_CONFIRM"
    assert result["returncode"] == 0
    assert (repo_path / "created.tmp").exists()
