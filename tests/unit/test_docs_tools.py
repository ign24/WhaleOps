from __future__ import annotations

from pathlib import Path

import pytest

from cognitive_code_agent.tools.docs_tools import _python_docstring_stats


pytestmark = pytest.mark.unit


def test_python_docstring_stats_counts_documented_objects(sample_repo_with_python: Path) -> None:
    total, documented, missing = _python_docstring_stats(sample_repo_with_python)

    assert total >= 2
    assert documented >= 1
    assert any("undocumented" in item for item in missing)


def test_python_docstring_stats_skips_invalid_python_file(tmp_sandbox: Path) -> None:
    repo = tmp_sandbox / "repo"
    (repo / "bad.py").write_text("def broken(:\n", encoding="utf-8")

    total, documented, missing = _python_docstring_stats(repo)

    assert total == 0
    assert documented == 0
    assert missing == []
