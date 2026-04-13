from __future__ import annotations

import asyncio
import json
from pathlib import Path

import pytest

import cognitive_code_agent.tools.code_review_tools as code_review_tools
import cognitive_code_agent.tools.docs_tools as docs_tools
import cognitive_code_agent.tools.qa_tools as qa_tools
import cognitive_code_agent.tools.security_tools as security_tools


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


def test_run_pytest_contract(mock_run_command, tmp_sandbox: Path, monkeypatch) -> None:
    repo = tmp_sandbox / "repo"
    monkeypatch.setattr(qa_tools, "ensure_repo_path", lambda *args, **kwargs: repo)
    calls = mock_run_command(
        qa_tools,
        stdout="1 passed in 0.10s",
        stderr="",
        returncode=0,
        duration_ms=123,
    )

    payload = _invoke_tool(
        qa_tools.run_pytest_tool(qa_tools.RunPytestConfig(), builder=None),
        {"repo_path": str(repo)},
    )

    assert payload["passed"] == 1
    assert payload["failed"] == 0
    assert payload["returncode"] == 0
    assert payload["duration_ms"] == 123
    assert calls[0]["command"] == ["pytest", "-q"]


def test_run_eslint_contract(mock_run_command, tmp_sandbox: Path, monkeypatch) -> None:
    repo = tmp_sandbox / "repo"
    monkeypatch.setattr(code_review_tools, "ensure_repo_path", lambda *args, **kwargs: repo)
    calls = mock_run_command(code_review_tools, stdout="[]", stderr="", returncode=0)

    payload = _invoke_tool(
        code_review_tools.run_eslint_tool(code_review_tools.RunEslintConfig(), builder=None),
        {"repo_path": str(repo)},
    )

    assert payload["issues"] == "[]"
    assert payload["returncode"] == 0
    assert calls[0]["command"][:3] == ["npx", "eslint", "."]


def test_run_semgrep_contract(mock_run_command, tmp_sandbox: Path, monkeypatch) -> None:
    repo = tmp_sandbox / "repo"
    monkeypatch.setattr(security_tools, "ensure_repo_path", lambda *args, **kwargs: repo)
    calls = mock_run_command(security_tools, stdout='{"results": []}', stderr="", returncode=0)

    payload = _invoke_tool(
        security_tools.run_semgrep_tool(security_tools.RunSemgrepConfig(), builder=None),
        {"repo_path": str(repo)},
    )

    assert payload["findings"] == '{"results": []}'
    assert payload["returncode"] == 0
    assert calls[0]["command"][0:3] == ["semgrep", "scan", "--json"]


def test_check_readme_contract(sample_repo_with_readme: Path, monkeypatch) -> None:
    monkeypatch.setattr(
        docs_tools, "ensure_repo_path", lambda *args, **kwargs: sample_repo_with_readme
    )

    payload = _invoke_tool(
        docs_tools.check_readme_tool(docs_tools.CheckReadmeConfig(), builder=None),
        {"repo_path": str(sample_repo_with_readme)},
    )

    assert payload["exists"] is True
    assert payload["has_install"] is True
    assert payload["has_usage"] is True
