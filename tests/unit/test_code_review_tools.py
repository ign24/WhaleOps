from __future__ import annotations

import asyncio
import json
from pathlib import Path

import pytest

import cognitive_code_agent.tools.code_review_tools as code_review_tools


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


def test_analyze_complexity_rejects_invalid_language(
    sample_repo_with_python: Path, monkeypatch
) -> None:
    monkeypatch.setattr(code_review_tools, "ensure_repo_path", lambda _: sample_repo_with_python)

    with pytest.raises(ValueError):
        _invoke_tool(
            code_review_tools.analyze_complexity_tool(
                code_review_tools.AnalyzeComplexityConfig(), builder=None
            ),
            {"repo_path": str(sample_repo_with_python), "language": "go"},
        )


def test_get_diff_counts_changed_files(mock_run_command, tmp_sandbox: Path, monkeypatch) -> None:
    repo = tmp_sandbox / "repo"
    monkeypatch.setattr(code_review_tools, "ensure_repo_path", lambda _: repo)
    mock_run_command(
        code_review_tools,
        stdout="3\t1\tsrc/a.py\n1\t0\tsrc/b.py\n",
        stderr="",
        returncode=0,
    )

    result = _invoke_tool(
        code_review_tools.get_diff_tool(code_review_tools.GetDiffConfig(), builder=None),
        {"repo_path": str(repo), "base_ref": "HEAD~1", "target_ref": "HEAD"},
    )

    assert result["files_changed"] == 2
    assert result["returncode"] == 0
