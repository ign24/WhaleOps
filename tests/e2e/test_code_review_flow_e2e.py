from __future__ import annotations

import asyncio
import json
import shutil
from pathlib import Path

import pytest

import cognitive_code_agent.tools.code_review_tools as code_review_tools
import cognitive_code_agent.tools.security_tools as security_tools


pytestmark = [pytest.mark.e2e, pytest.mark.real_tools]

_FIXTURE_REPO = Path(__file__).parent.parent / "fixtures" / "sample_repo"


def _invoke_tool(tool_cm, payload: dict) -> dict:
    async def _run() -> str:
        async with tool_cm as function_info:
            try:
                return await function_info.single_fn(**payload)
            except TypeError:
                tool_input = function_info.input_schema(**payload)
                return await function_info.single_fn(tool_input)

    return json.loads(asyncio.run(_run()))


@pytest.mark.skipif(shutil.which("ruff") is None, reason="ruff binary not installed")
def test_ruff_smoke_on_fixture_repo(monkeypatch) -> None:
    repo = _FIXTURE_REPO
    monkeypatch.setattr(code_review_tools, "ensure_repo_path", lambda *args, **kwargs: repo)

    result = _invoke_tool(
        code_review_tools.run_ruff_tool(code_review_tools.RunRuffConfig(), builder=None),
        {"repo_path": str(repo)},
    )

    assert isinstance(result["issues"], str)
    assert len(result["issues"]) > 0, "ruff should report at least one issue in the fixture repo"
    assert isinstance(result["returncode"], int)
    assert result["duration_ms"] > 0


@pytest.mark.skipif(shutil.which("semgrep") is None, reason="semgrep binary not installed")
def test_semgrep_smoke_on_fixture_repo(monkeypatch) -> None:
    repo = _FIXTURE_REPO
    monkeypatch.setattr(security_tools, "ensure_repo_path", lambda *args, **kwargs: repo)

    result = _invoke_tool(
        security_tools.run_semgrep_tool(security_tools.RunSemgrepConfig(), builder=None),
        {"repo_path": str(repo)},
    )

    assert isinstance(result["findings"], str)
    # findings should be valid JSON (semgrep --json output)
    json.loads(result["findings"])
    assert isinstance(result["returncode"], int)
    assert result["duration_ms"] > 0
