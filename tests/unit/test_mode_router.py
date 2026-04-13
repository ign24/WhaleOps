"""Tests for the mode router prefix detection."""

from __future__ import annotations

import pytest

from cognitive_code_agent.agents.safe_tool_calling_agent import resolve_mode

pytestmark = pytest.mark.unit


@pytest.mark.parametrize(
    ("message", "expected_mode", "expected_cleaned"),
    [
        ("/analyze https://github.com/org/repo", "analyze", "https://github.com/org/repo"),
        ("/refactor apply the plan", "execute", "apply the plan"),
        ("/execute commit and push", "execute", "commit and push"),
        ("/ANALYZE loud prefix", "analyze", "loud prefix"),
        ("/Refactor Mixed case", "execute", "Mixed case"),
        ("/analyze", "analyze", ""),
        ("plain message", "analyze", "plain message"),
        ("/unknown prefix", "analyze", "/unknown prefix"),
        ("", "analyze", ""),
        ("/analyze   extra spaces", "analyze", "extra spaces"),
    ],
)
def test_resolve_mode(message: str, expected_mode: str, expected_cleaned: str) -> None:
    mode, cleaned = resolve_mode(message)
    assert mode == expected_mode
    assert cleaned == expected_cleaned


def test_resolve_mode_custom_default() -> None:
    mode, cleaned = resolve_mode("no prefix here", default="refactor")
    assert mode == "refactor"
    assert cleaned == "no prefix here"


def test_resolve_mode_prefix_not_in_middle() -> None:
    """Prefix must be at the start of the message."""
    mode, cleaned = resolve_mode("please /analyze this repo")
    assert mode == "analyze"
    assert cleaned == "please /analyze this repo"
