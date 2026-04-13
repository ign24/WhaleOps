from __future__ import annotations

import asyncio
import json
from pathlib import Path

import pytest

import cognitive_code_agent.tools.security_tools as security_tools


pytestmark = pytest.mark.unit


def _invoke_tool(tool_cm, payload: dict) -> dict:
    async def _run() -> str:
        async with tool_cm as function_info:
            try:
                return await function_info.single_fn(**payload)
            except TypeError:
                tool_input = function_info.input_schema(**payload)
                return await function_info.single_fn(tool_input)

    return json.loads(asyncio.run(_run()))


def test_run_gitleaks_redacts_sensitive_output(
    mock_run_command, tmp_sandbox: Path, monkeypatch
) -> None:
    repo = tmp_sandbox / "repo"
    monkeypatch.setattr(security_tools, "ensure_repo_path", lambda _: repo)
    mock_run_command(
        security_tools,
        stdout='{"Secret":"AKIA1234567890ABCDEF"}',
        stderr='token="super-secret"',
        returncode=1,
    )

    result = _invoke_tool(
        security_tools.run_gitleaks_tool(security_tools.RunGitleaksConfig(), builder=None),
        {"repo_path": str(repo)},
    )

    assert result["returncode"] == 1
    assert "AKIA1234567890ABCDEF" not in result["leaks"]
    assert "super-secret" not in result["stderr"]
    assert "***REDACTED***" in result["leaks"]


@pytest.mark.parametrize(
    ("tool_factory", "config_cls", "result_key"),
    [
        (security_tools.run_gitleaks_tool, security_tools.RunGitleaksConfig, "leaks"),
        (security_tools.run_bandit_tool, security_tools.RunBanditConfig, "issues"),
        (security_tools.run_semgrep_tool, security_tools.RunSemgrepConfig, "findings"),
        (security_tools.run_trivy_tool, security_tools.RunTrivyConfig, "vulnerabilities"),
    ],
)
def test_security_scanners_return_non_retryable_invalid_repo_error(
    tool_factory, config_cls, result_key: str, tmp_sandbox: Path, monkeypatch
) -> None:
    monkeypatch.setattr(
        security_tools,
        "ensure_repo_path",
        lambda _: (_ for _ in ()).throw(ValueError("outside sandbox")),
    )

    result = _invoke_tool(
        tool_factory(config_cls(), builder=None),
        {"repo_path": str(tmp_sandbox / "repo")},
    )

    assert result["status"] == "error"
    assert result["error_type"] == "invalid_repo_path"
    assert result["retryable"] is False
    assert result[result_key] == ""
