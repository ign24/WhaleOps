from __future__ import annotations

# pyright: reportCallIssue=false

import asyncio
from pathlib import Path
from typing import Any
from typing import cast

import pytest

import cognitive_code_agent.tools.code_review_tools as code_review_tools
import cognitive_code_agent.tools.docs_tools as docs_tools
import cognitive_code_agent.tools.qa_tools as qa_tools
import cognitive_code_agent.tools.security_tools as security_tools


pytestmark = pytest.mark.integration


@pytest.mark.parametrize(
    ("tool_factory", "payload"),
    [
        (
            lambda: qa_tools.run_pytest_tool(qa_tools.RunPytestConfig(), builder=cast(Any, None)),  # type: ignore[call-arg]
            {"repo_path": "__REPO__"},
        ),
        (
            lambda: code_review_tools.run_ruff_tool(  # type: ignore[call-arg]
                code_review_tools.RunRuffConfig(), builder=cast(Any, None)
            ),
            {"repo_path": "__REPO__"},
        ),
        (
            lambda: security_tools.run_bandit_tool(  # type: ignore[call-arg]
                security_tools.RunBanditConfig(), builder=cast(Any, None)
            ),
            {"repo_path": "__REPO__"},
        ),
        (
            lambda: docs_tools.check_readme_tool(  # type: ignore[call-arg]
                docs_tools.CheckReadmeConfig(), builder=cast(Any, None)
            ),
            {"repo_path": "__REPO__"},
        ),
    ],
)
def test_tools_reject_repo_path_outside_sandbox(
    tool_factory, payload: dict, tmp_path: Path
) -> None:
    repo = tmp_path / "outside"
    repo.mkdir()

    payload = dict(payload)
    payload["repo_path"] = str(repo)

    async def _run():
        async with tool_factory() as function_info:
            try:
                return await function_info.single_fn(**payload)
            except TypeError:
                tool_input = function_info.input_schema(**payload)
                return await function_info.single_fn(tool_input)

    try:
        result = asyncio.run(_run())
    except ValueError:
        return

    assert "outside allowed" in str(result).lower()
