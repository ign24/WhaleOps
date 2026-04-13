from __future__ import annotations

import asyncio
import json
import shutil
from pathlib import Path

import pytest

import cognitive_code_agent.tools.security_tools as security_tools


pytestmark = [pytest.mark.e2e, pytest.mark.real_tools]


def _invoke_tool(tool_cm, payload: dict) -> dict:
    async def _run() -> str:
        async with tool_cm as function_info:
            try:
                return await function_info.single_fn(**payload)
            except TypeError:
                tool_input = function_info.input_schema(**payload)
                return await function_info.single_fn(tool_input)

    return json.loads(asyncio.run(_run()))


@pytest.mark.skipif(shutil.which("gitleaks") is None, reason="gitleaks binary not installed")
@pytest.mark.skipif(shutil.which("bandit") is None, reason="bandit binary not installed")
def test_security_tools_flow_redacts_and_reports(tmp_path: Path, monkeypatch) -> None:
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "secret.txt").write_text("api_key=AKIA1234567890ABCDEF\n", encoding="utf-8")
    (repo / "unsafe.py").write_text("assert True\n", encoding="utf-8")
    monkeypatch.setattr(security_tools, "ensure_repo_path", lambda *args, **kwargs: repo)

    gitleaks_result = _invoke_tool(
        security_tools.run_gitleaks_tool(security_tools.RunGitleaksConfig(), builder=None),
        {"repo_path": str(repo)},
    )
    bandit_result = _invoke_tool(
        security_tools.run_bandit_tool(security_tools.RunBanditConfig(), builder=None),
        {"repo_path": str(repo)},
    )

    assert "AKIA1234567890ABCDEF" not in gitleaks_result["leaks"]
    assert "***REDACTED***" in gitleaks_result["leaks"] or gitleaks_result["leaks"] == ""
    assert "issues" in bandit_result
