from __future__ import annotations

import asyncio
import json
from pathlib import Path

import pytest

import cognitive_code_agent.tools.docs_tools as docs_tools


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


def test_docs_tools_flow_on_fixture_repo(tmp_path: Path, monkeypatch) -> None:
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "README.md").write_text(
        "# Service\n\n## Install\n\nInstall guide.\n\n## Usage\n\nUsage guide.\n",
        encoding="utf-8",
    )
    (repo / "app.py").write_text(
        """def undocumented():\n    return 1\n\n\ndef documented():\n    \"\"\"Docs.\"\"\"\n    return 2\n""",
        encoding="utf-8",
    )
    monkeypatch.setattr(docs_tools, "ensure_repo_path", lambda *args, **kwargs: repo)

    readme_result = _invoke_tool(
        docs_tools.check_readme_tool(docs_tools.CheckReadmeConfig(), builder=None),
        {"repo_path": str(repo)},
    )
    docstring_result = _invoke_tool(
        docs_tools.analyze_docstrings_tool(docs_tools.AnalyzeDocstringsConfig(), builder=None),
        {"repo_path": str(repo), "language": "python"},
    )

    assert readme_result["exists"] is True
    assert readme_result["has_install"] is True
    assert readme_result["has_usage"] is True
    assert docstring_result["total"] >= 2
    assert docstring_result["documented"] >= 1
