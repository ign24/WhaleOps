from __future__ import annotations

import asyncio
import json
import shutil
import subprocess
from pathlib import Path

import pytest

import cognitive_code_agent.tools.qa_tools as qa_tools


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


@pytest.mark.skipif(shutil.which("pytest") is None, reason="pytest binary not installed")
@pytest.mark.skipif(shutil.which("coverage") is None, reason="coverage binary not installed")
def test_qa_tools_flow_on_real_fixture_repo(tmp_path: Path, monkeypatch) -> None:
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "calc.py").write_text("def add(a, b):\n    return a + b\n", encoding="utf-8")
    (repo / "test_calc.py").write_text(
        "from calc import add\n\n\ndef test_add():\n    assert add(1, 2) == 3\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(qa_tools, "ensure_repo_path", lambda *args, **kwargs: repo)

    subprocess.run(
        ["python3", "-m", "coverage", "run", "-m", "pytest", "-q"],
        cwd=repo,
        check=True,
        capture_output=True,
        text=True,
    )

    pytest_result = _invoke_tool(
        qa_tools.run_pytest_tool(qa_tools.RunPytestConfig(), builder=None),
        {"repo_path": str(repo)},
    )
    coverage_result = _invoke_tool(
        qa_tools.analyze_test_coverage_tool(qa_tools.AnalyzeCoverageConfig(), builder=None),
        {"repo_path": str(repo), "language": "python"},
    )

    assert pytest_result["passed"] >= 1
    assert pytest_result["returncode"] == 0
    assert coverage_result["language"] == "python"
    assert coverage_result["total_coverage"] > 0
