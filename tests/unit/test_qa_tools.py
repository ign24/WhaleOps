from __future__ import annotations

from pathlib import Path

import pytest

from cognitive_code_agent.tools.qa_tools import _parse_pytest_summary
from cognitive_code_agent.tools.qa_tools import _score_line


pytestmark = pytest.mark.unit


FIXTURES_DIR = Path(__file__).resolve().parents[1] / "fixtures" / "tool_outputs"


def test_parse_pytest_summary_counts_passed_from_fixture() -> None:
    output = (FIXTURES_DIR / "pytest_summary_pass.txt").read_text(encoding="utf-8")
    parsed = _parse_pytest_summary(output)

    assert parsed == {"passed": 12, "failed": 0, "errors": 0, "skipped": 0}


def test_parse_pytest_summary_counts_multiple_statuses() -> None:
    output = (FIXTURES_DIR / "pytest_summary_fail.txt").read_text(encoding="utf-8")
    parsed = _parse_pytest_summary(output)

    assert parsed["passed"] == 6
    assert parsed["failed"] == 1
    assert parsed["errors"] == 1
    assert parsed["skipped"] == 1


def test_score_line_returns_token_overlap_size() -> None:
    query_terms = {"pytest", "flaky", "timeout"}
    score = _score_line("Mitigate flaky timeout in pytest runs", query_terms)

    assert score == 3


def test_score_line_is_case_insensitive() -> None:
    query_terms = {"security", "scan"}
    score = _score_line("Run Security SCAN daily", query_terms)

    assert score == 2
