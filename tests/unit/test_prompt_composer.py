from __future__ import annotations

from pathlib import Path

import pytest

from cognitive_code_agent.prompts.composer import _truncate_skill_content
from cognitive_code_agent.prompts.composer import build_active_skills_block
from cognitive_code_agent.prompts.composer import detect_analysis_mode
from cognitive_code_agent.prompts.composer import load_base_prompt
from cognitive_code_agent.prompts.composer import load_registry
from cognitive_code_agent.prompts.composer import render_template
from cognitive_code_agent.prompts.composer import select_skills


pytestmark = pytest.mark.unit


REGISTRY = "src/cognitive_code_agent/prompts/skills/registry.yml"
BASE_PROMPT = "src/cognitive_code_agent/prompts/system/base.md"


def test_registry_loads_enabled_skills() -> None:
    registry = load_registry(REGISTRY)

    skill_ids = [skill.id for skill in registry.skills if skill.enabled]
    assert "tdd" in skill_ids
    assert "code-reviewer" in skill_ids
    assert "security-review" in skill_ids
    assert "senior-qa" in skill_ids
    assert "technical-writer" in skill_ids
    assert "debugger" in skill_ids
    assert "email-marketing-bible" in skill_ids
    assert "api-design" in skill_ids


def test_base_prompt_file_can_be_loaded() -> None:
    prompt = load_base_prompt(BASE_PROMPT)
    assert "<identity>" in prompt
    assert "priority_policy" in prompt


def test_select_skills_prefers_security_for_security_intent() -> None:
    selected = select_skills(
        user_message="Please run a security audit and check CVEs and secrets",
        available_tools=["run_semgrep", "run_trivy", "run_gitleaks", "run_bandit"],
        registry_path=REGISTRY,
        max_active_skills=2,
    )

    assert selected
    assert selected[0].id == "security-review"


def test_select_skills_returns_empty_when_no_triggers_match() -> None:
    selected = select_skills(
        user_message="Hola, gracias",
        available_tools=["run_semgrep", "run_trivy", "run_gitleaks", "run_bandit"],
        registry_path=REGISTRY,
        max_active_skills=2,
    )

    assert selected == []


def test_build_active_skills_block_includes_skill_content() -> None:
    skill_ids, block = build_active_skills_block(
        user_message="Need PR review and code quality checks",
        available_tools=["get_diff", "run_ruff", "run_eslint", "analyze_complexity"],
        registry_path=REGISTRY,
        max_active_skills=1,
    )

    assert skill_ids == ["code-reviewer"]
    assert "<active_skills>" in block
    assert "# Code Reviewer" in block


def test_detect_analysis_mode_quick_and_full() -> None:
    assert detect_analysis_mode("Please do a quick review of this repo") == "QUICK"
    assert detect_analysis_mode("Necesito un analisis completo del repositorio") == "FULL"


def test_detect_analysis_mode_infers_full_from_multiple_dimensions() -> None:
    message = "Need code review, security checks, QA coverage, and docs audit"
    assert detect_analysis_mode(message) == "FULL"


def test_build_active_skills_block_includes_detected_mode() -> None:
    skill_ids, block = build_active_skills_block(
        user_message="security audit, code review, test coverage and docs",
        available_tools=[
            "get_diff",
            "run_ruff",
            "run_eslint",
            "analyze_complexity",
            "run_semgrep",
            "run_trivy",
            "run_gitleaks",
            "run_bandit",
            "run_pytest",
            "run_jest",
            "analyze_test_coverage",
            "check_readme",
            "analyze_docstrings",
            "analyze_api_docs",
        ],
        registry_path=REGISTRY,
        max_active_skills=4,
    )

    assert set(skill_ids) == {"code-reviewer", "security-review", "senior-qa", "technical-writer"}
    assert "Detected analysis mode: FULL" in block


def test_skill_files_exist_in_repo() -> None:
    expected = [
        "src/cognitive_code_agent/prompts/skills/tdd.md",
        "src/cognitive_code_agent/prompts/skills/code-reviewer.md",
        "src/cognitive_code_agent/prompts/skills/security-review.md",
        "src/cognitive_code_agent/prompts/skills/senior-qa.md",
        "src/cognitive_code_agent/prompts/skills/technical-writer.md",
        "src/cognitive_code_agent/prompts/skills/debugger.md",
        "src/cognitive_code_agent/prompts/skills/email-marketing-bible.md",
        "src/cognitive_code_agent/prompts/skills/api-design.md",
    ]
    for path in expected:
        assert Path(path).exists()


def test_technical_analysis_skills_expose_operational_rules() -> None:
    skill_paths = [
        "src/cognitive_code_agent/prompts/skills/code-reviewer.md",
        "src/cognitive_code_agent/prompts/skills/security-review.md",
        "src/cognitive_code_agent/prompts/skills/senior-qa.md",
        "src/cognitive_code_agent/prompts/skills/technical-writer.md",
    ]

    for path in skill_paths:
        content = Path(path).read_text(encoding="utf-8")
        assert "## Operational Rules" in content


def test_select_api_design_skill_for_api_requests() -> None:
    selected = select_skills(
        user_message="Review the REST API endpoints and check pagination design",
        available_tools=[],
        registry_path=REGISTRY,
        max_active_skills=2,
    )

    assert selected
    assert selected[0].id == "api-design"


def test_select_email_skill_for_marketing_requests() -> None:
    selected = select_skills(
        user_message="Need a newsletter deliverability audit and DMARC fixes",
        available_tools=[],
        registry_path=REGISTRY,
        max_active_skills=2,
    )

    assert selected
    assert selected[0].id == "email-marketing-bible"


# ---------------------------------------------------------------------------
# Mode-based skill filtering
# ---------------------------------------------------------------------------

# Analyze mode tools (no code_gen, refactor_gen, write_file, edit_file)
ANALYZE_TOOLS = [
    "reader_agent",
    "run_pytest",
    "run_jest",
    "analyze_test_coverage",
    "run_ruff",
    "run_eslint",
    "analyze_complexity",
    "get_diff",
    "run_semgrep",
    "run_trivy",
    "run_gitleaks",
    "run_bandit",
    "analyze_docstrings",
    "check_readme",
    "analyze_api_docs",
    "clone_repository",
    "query_findings",
    "persist_findings",
    # MCP tools with group prefix
    "fs_tools__read_text_file",
    "fs_tools__directory_tree",
    "fs_tools__search_files",
    "fs_tools__list_directory",
    "fs_tools__read_multiple_files",
    "fs_tools__get_file_info",
]

# Refactor mode tools (has code_gen, refactor_gen, write tools, no scanners)
REFACTOR_TOOLS = [
    "reader_agent",
    "code_gen",
    "refactor_gen",
    "run_ruff",
    "run_eslint",
    "run_pytest",
    "run_jest",
    "analyze_complexity",
    "query_findings",
    "persist_findings",
    "shell_execute",
    # MCP write tools with group prefix
    "fs_tools_write__write_file",
    "fs_tools_write__edit_file",
    "fs_tools_write__create_directory",
    "fs_tools_write__read_text_file",
    "fs_tools_write__directory_tree",
]

# Execute mode tools (minimal)
EXECUTE_TOOLS = [
    "shell_execute",
    "query_findings",
    "tavily_search",
    "fs_tools_write__write_file",
    "github_tools__create_pull_request",
]


def test_security_skill_activates_in_analyze_mode() -> None:
    selected = select_skills(
        user_message="Run a security audit for vulnerabilities",
        available_tools=ANALYZE_TOOLS,
        registry_path=REGISTRY,
        max_active_skills=2,
    )

    skill_ids = [s.id for s in selected]
    assert "security-review" in skill_ids


def test_security_skill_blocked_in_refactor_mode() -> None:
    """Refactor mode lacks security scanners, so security-review must not activate."""
    selected = select_skills(
        user_message="Run a security audit for vulnerabilities",
        available_tools=REFACTOR_TOOLS,
        registry_path=REGISTRY,
        max_active_skills=4,
    )

    skill_ids = [s.id for s in selected]
    assert "security-review" not in skill_ids


def test_refactoring_skill_activates_in_refactor_mode() -> None:
    """Refactor mode has refactor_gen and MCP write tools."""
    selected = select_skills(
        user_message="Refactor the authentication module and clean up the code",
        available_tools=REFACTOR_TOOLS,
        registry_path=REGISTRY,
        max_active_skills=2,
    )

    skill_ids = [s.id for s in selected]
    assert "refactoring" in skill_ids


def test_refactoring_skill_blocked_in_analyze_mode() -> None:
    """Analyze mode lacks refactor_gen and write tools."""
    selected = select_skills(
        user_message="Refactor the authentication module",
        available_tools=ANALYZE_TOOLS,
        registry_path=REGISTRY,
        max_active_skills=4,
    )

    skill_ids = [s.id for s in selected]
    assert "refactoring" not in skill_ids


def test_tdd_skill_activates_on_implement_message() -> None:
    """TDD skill activates when user asks to implement a new feature."""
    selected = select_skills(
        user_message="Implement a new feature for user authentication",
        available_tools=["run_pytest"],
        registry_path=REGISTRY,
        max_active_skills=2,
    )

    skill_ids = [s.id for s in selected]
    assert "tdd" in skill_ids


def test_tdd_skill_does_not_activate_on_qa_messages() -> None:
    """TDD must not compete with senior-qa on test/coverage triggers."""
    selected = select_skills(
        user_message="Run tests and check coverage",
        available_tools=["run_pytest", "run_jest", "analyze_test_coverage"],
        registry_path=REGISTRY,
        max_active_skills=2,
    )

    skill_ids = [s.id for s in selected]
    assert "tdd" not in skill_ids
    assert "senior-qa" in skill_ids


def test_tdd_and_security_coexist() -> None:
    """Both TDD and security-review can activate on a security implementation request."""
    selected = select_skills(
        user_message="Implement the security hardening for the auth module",
        available_tools=[
            "run_pytest",
            "run_semgrep",
            "run_trivy",
            "run_gitleaks",
            "run_bandit",
        ],
        registry_path=REGISTRY,
        max_active_skills=2,
    )

    skill_ids = [s.id for s in selected]
    assert "tdd" in skill_ids
    assert "security-review" in skill_ids


def test_tdd_skill_blocked_without_run_pytest() -> None:
    """TDD skill requires run_pytest to be available."""
    selected = select_skills(
        user_message="Implement a new feature",
        available_tools=["shell_execute", "tavily_search"],
        registry_path=REGISTRY,
        max_active_skills=2,
    )

    skill_ids = [s.id for s in selected]
    assert "tdd" not in skill_ids


def test_no_skills_activate_in_execute_mode() -> None:
    """Execute mode has minimal tools, no skill should match."""
    selected = select_skills(
        user_message="Commit and push the changes",
        available_tools=EXECUTE_TOOLS,
        registry_path=REGISTRY,
        max_active_skills=4,
    )

    assert selected == []


def test_mcp_tool_suffix_matching() -> None:
    """write_file in required_tools should match fs_tools_write__write_file."""
    from cognitive_code_agent.prompts.composer import _tool_available

    available = {"fs_tools_write__write_file", "run_ruff", "refactor_gen"}
    assert _tool_available("write_file", available)
    assert _tool_available("run_ruff", available)
    assert _tool_available("refactor_gen", available)
    assert not _tool_available("run_eslint", available)


# --- Skill truncation and budget cap tests ---


def test_truncate_skill_content_under_cap_returns_unchanged() -> None:
    content = "# Skill\n\nSome content here.\n\n## Section\n\nMore content."
    result = _truncate_skill_content(content, max_chars=8000, skill_file="skill.md")
    assert result == content


def test_truncate_skill_content_over_cap_truncates_at_heading() -> None:
    # Build content with two ## headings, one before and one after the cap
    section_a = "## Section A\n\n" + "x" * 100
    section_b = "## Section B\n\n" + "x" * 100
    content = section_a + "\n\n" + section_b
    # Cap right between the two sections so Section B gets cut
    cap = len(section_a) + 5
    result = _truncate_skill_content(content, max_chars=cap, skill_file="skills/test.md")
    assert "## Section A" in result
    assert "## Section B" not in result
    assert "[SKILL TRUNCATED: full content at skills/test.md]" in result


def test_truncate_skill_content_appends_notice_with_file_path() -> None:
    content = "## Section\n\n" + "y" * 200
    result = _truncate_skill_content(content, max_chars=50, skill_file="src/skills/my-skill.md")
    assert "[SKILL TRUNCATED: full content at src/skills/my-skill.md]" in result


def test_registry_loads_budget_fields() -> None:
    registry = load_registry(REGISTRY)
    assert registry.default_max_skill_chars == 8000
    assert registry.total_skill_budget_chars == 16000


def test_skill_config_has_max_chars_field() -> None:
    registry = load_registry(REGISTRY)
    # Skills without explicit max_chars should have None
    for skill in registry.skills:
        assert hasattr(skill, "max_chars")


def test_build_active_skills_block_respects_total_budget() -> None:
    """Two skills whose combined raw content could exceed budget get capped."""
    # Use real registry — security-review (~13KB) + code-reviewer (~4.7KB) = ~17KB > 16K budget
    skill_ids, block = build_active_skills_block(
        user_message="security review and code review",
        available_tools=[
            "run_semgrep",
            "run_trivy",
            "run_gitleaks",
            "run_bandit",
            "get_diff",
            "run_ruff",
            "run_eslint",
            "analyze_complexity",
        ],
        registry_path=REGISTRY,
        max_active_skills=2,
    )
    assert skill_ids  # at least one skill
    # Total combined skill content must fit within budget (16000) plus wrapper overhead
    inner_content = block.replace("<active_skills>", "").replace("</active_skills>", "")
    assert len(inner_content) <= 16000 + 500  # small overhead for headers/labels


# --- render_template tests ---


def test_render_template_basic_substitution() -> None:
    template = "Hello, {{agent_name}}. You are {{identity}}."
    config = {"agent_name": "TestBot", "identity": "a test agent"}
    result = render_template(template, config)
    assert result == "Hello, TestBot. You are a test agent."


def test_render_template_missing_key_renders_empty(caplog: pytest.LogRecaptureFixture) -> None:
    template = "Name: {{agent_name}}, Missing: {{unknown_var}}"
    config = {"agent_name": "TestBot"}
    result = render_template(template, config)
    assert result == "Name: TestBot, Missing: "
    assert "unknown_var" in caplog.text


def test_render_template_nested_braces_ignored() -> None:
    template = "Code: {{'key': 'value'}} and {{agent_name}}"
    config = {"agent_name": "Bot"}
    result = render_template(template, config)
    # {{'key': 'value'}} is not a valid placeholder (has quotes), should pass through or resolve empty
    assert "Bot" in result


def test_render_template_empty_config() -> None:
    template = "No placeholders here."
    result = render_template(template, {})
    assert result == "No placeholders here."


def test_render_template_empty_string_value() -> None:
    template = "Emojis: {{emoji_set}} end."
    config = {"emoji_set": ""}
    result = render_template(template, config)
    assert result == "Emojis:  end."


def test_render_template_preserves_non_placeholder_braces() -> None:
    template = "JSON: {key: value} and {{agent_name}}"
    config = {"agent_name": "Bot"}
    result = render_template(template, config)
    assert result == "JSON: {key: value} and Bot"
