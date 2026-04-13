from __future__ import annotations

import pytest

from cognitive_code_agent import register


pytestmark = pytest.mark.integration


def test_register_exports_all_tool_modules() -> None:
    exported = set(register.__all__)

    assert {
        "qa_tools",
        "clone_tools",
        "code_review_tools",
        "security_tools",
        "docs_tools",
        "shell_tools",
        "spawn_agent",
    }.issubset(exported)


def test_register_modules_are_importable() -> None:
    assert register.qa_tools is not None
    assert register.clone_tools is not None
    assert register.code_review_tools is not None
    assert register.security_tools is not None
    assert register.docs_tools is not None
    assert register.spawn_agent is not None
