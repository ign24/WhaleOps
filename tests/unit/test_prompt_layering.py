"""Unit tests for prompt layering spec.

Verifies that no global section appears in mode prompts (no duplication),
and that mode-specific sections live only in their respective mode files.
"""

from __future__ import annotations

from pathlib import Path

import pytest


pytestmark = pytest.mark.unit

PROMPTS_DIR = Path("src/cognitive_code_agent/prompts/system")

BASE_MD = PROMPTS_DIR / "base.md"
ANALYZE_MD = PROMPTS_DIR / "analyze.md"
EXECUTE_MD = PROMPTS_DIR / "execute.md"
CHAT_MD = PROMPTS_DIR / "chat.md"

# Global sections that must NOT appear in mode prompts
GLOBAL_SECTIONS = [
    "<identity>",
    "<priority_policy>",
    "<workflow_policy>",
    "<operating_principles>",
    "<environment>",
    "<memory_policy>",
    "<skills_runtime>",
]

# Sections that must NOT appear in base.md
BASE_FORBIDDEN = [
    "<full_analysis_protocol>",
    "<code_writing_policy>",
    "<output_contract>",
    "<output_guidelines>",
    "<execution_expectations>",
    "<tool_guidance>",
    "<git_workflow>",
]


class TestBaseMd:
    def test_contains_identity(self) -> None:
        assert "<identity>" in BASE_MD.read_text(encoding="utf-8")

    def test_contains_priority_policy(self) -> None:
        assert "<priority_policy>" in BASE_MD.read_text(encoding="utf-8")

    def test_contains_workflow_policy(self) -> None:
        assert "<workflow_policy>" in BASE_MD.read_text(encoding="utf-8")

    def test_contains_operating_principles(self) -> None:
        assert "<operating_principles>" in BASE_MD.read_text(encoding="utf-8")

    def test_contains_environment(self) -> None:
        assert "<environment>" in BASE_MD.read_text(encoding="utf-8")

    def test_contains_memory_policy(self) -> None:
        assert "<memory_policy>" in BASE_MD.read_text(encoding="utf-8")

    def test_contains_skills_runtime(self) -> None:
        assert "<skills_runtime>" in BASE_MD.read_text(encoding="utf-8")

    def test_contains_instruction_priority(self) -> None:
        assert "<instruction_priority>" in BASE_MD.read_text(encoding="utf-8")

    def test_contains_communication_style(self) -> None:
        assert "<communication_style>" in BASE_MD.read_text(encoding="utf-8")

    def test_contains_business_objective(self) -> None:
        assert "<business_objective>" in BASE_MD.read_text(encoding="utf-8")

    def test_instruction_priority_has_four_levels(self) -> None:
        content = BASE_MD.read_text(encoding="utf-8")
        for level in range(1, 5):
            assert f"{level}." in content

    def test_does_not_contain_model_execution_guidelines(self) -> None:
        assert "<model_execution_guidelines>" not in BASE_MD.read_text(encoding="utf-8")

    @pytest.mark.parametrize("section", BASE_FORBIDDEN)
    def test_does_not_contain_mode_specific_section(self, section: str) -> None:
        assert section not in BASE_MD.read_text(encoding="utf-8"), (
            f"base.md must not contain mode-specific section {section!r}"
        )

    def test_contains_template_placeholders(self) -> None:
        content = BASE_MD.read_text(encoding="utf-8")
        assert "{{agent_name}}" in content
        assert "{{identity}}" in content
        assert "{{business_objective}}" in content
        assert "{{emoji_set}}" in content
        assert "{{workspace_path}}" in content
        assert "{{analysis_path}}" in content
        assert "{{response_language}}" in content


@pytest.mark.parametrize("section", GLOBAL_SECTIONS)
class TestAnalyzeMdNoGlobalSections:
    def test_analyze_does_not_contain_global_section(self, section: str) -> None:
        assert section not in ANALYZE_MD.read_text(encoding="utf-8"), (
            f"analyze.md must not contain global section {section!r}"
        )


@pytest.mark.parametrize("section", GLOBAL_SECTIONS)
class TestExecuteMdNoGlobalSections:
    def test_execute_does_not_contain_global_section(self, section: str) -> None:
        assert section not in EXECUTE_MD.read_text(encoding="utf-8"), (
            f"execute.md must not contain global section {section!r}"
        )


@pytest.mark.parametrize("section", GLOBAL_SECTIONS)
class TestChatMdNoGlobalSections:
    def test_chat_does_not_contain_global_section(self, section: str) -> None:
        assert section not in CHAT_MD.read_text(encoding="utf-8"), (
            f"chat.md must not contain global section {section!r}"
        )


class TestModeSpecificSections:
    def test_tool_guidance_only_in_analyze(self) -> None:
        assert "<tool_guidance>" in ANALYZE_MD.read_text(encoding="utf-8")
        assert "<tool_guidance>" not in EXECUTE_MD.read_text(encoding="utf-8")
        assert "<tool_guidance>" not in BASE_MD.read_text(encoding="utf-8")

    def test_execution_expectations_in_execute(self) -> None:
        assert "<execution_expectations>" in EXECUTE_MD.read_text(encoding="utf-8")
        assert "<execution_expectations>" not in ANALYZE_MD.read_text(encoding="utf-8")
        assert "<execution_expectations>" not in BASE_MD.read_text(encoding="utf-8")

    def test_analyze_has_operating_mode_override(self) -> None:
        assert "<operating_mode_override>" in ANALYZE_MD.read_text(encoding="utf-8")

    def test_execute_has_operating_mode_override(self) -> None:
        assert "<operating_mode_override>" in EXECUTE_MD.read_text(encoding="utf-8")

    def test_execute_has_available_tools(self) -> None:
        assert "<available_tools>" in EXECUTE_MD.read_text(encoding="utf-8")

    def test_analyze_has_output_guidelines(self) -> None:
        assert "<output_guidelines>" in ANALYZE_MD.read_text(encoding="utf-8")

    def test_execute_has_git_workflow(self) -> None:
        assert "<git_workflow>" in EXECUTE_MD.read_text(encoding="utf-8")

    def test_no_directory_tree_policy_duplication(self) -> None:
        """directory_tree_policy should not appear in execute — it's in analyze's tool_guidance."""
        assert "<directory_tree_policy>" not in EXECUTE_MD.read_text(encoding="utf-8")
