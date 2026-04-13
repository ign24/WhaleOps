from __future__ import annotations

from pathlib import Path

import pytest
import yaml


pytestmark = pytest.mark.unit


def _load_config() -> dict:
    config_path = Path("src/cognitive_code_agent/configs/config.yml")
    return yaml.safe_load(config_path.read_text(encoding="utf-8"))


def test_code_agent_uses_modular_prompt_configuration() -> None:
    config = _load_config()
    code_agent = config["functions"]["code_agent"]

    assert code_agent["prompt_base_path"] == "src/cognitive_code_agent/prompts/system/base.md"
    assert (
        code_agent["skill_registry_path"] == "src/cognitive_code_agent/prompts/skills/registry.yml"
    )
    assert code_agent["max_active_skills"] == 2


def test_code_agent_uses_safe_tool_calling() -> None:
    config = _load_config()
    code_agent = config["functions"]["code_agent"]

    assert code_agent["_type"] == "safe_tool_calling_agent"
    assert code_agent["llm_name"] == "devstral"
    assert code_agent["max_iterations"] == 40
    assert code_agent["tool_call_timeout_seconds"] == 900
    assert code_agent["handle_tool_errors"] is True
    # reader_agent removed — replaced by spawn_agent + direct fs_tools in modes
    assert "reader_agent" not in code_agent["tool_names"]
    assert "spawn_agent" in code_agent["tool_names"]
    assert "run_semgrep" in code_agent["tool_names"]
    assert "run_pytest" in code_agent["tool_names"]
    assert "analyze_docstrings" in code_agent["tool_names"]
    assert "run_ruff" in code_agent["tool_names"]
    assert "run_trivy" in code_agent["tool_names"]
    assert "run_bandit" in code_agent["tool_names"]
    assert "run_gitleaks" in code_agent["tool_names"]


def test_prompt_assets_exist() -> None:
    base_prompt = Path("src/cognitive_code_agent/prompts/system/base.md")
    registry = Path("src/cognitive_code_agent/prompts/skills/registry.yml")
    prompt_config = Path("src/cognitive_code_agent/configs/prompt_config.yml")

    assert base_prompt.exists()
    assert registry.exists()
    assert prompt_config.exists()


def test_prompt_config_has_all_required_keys() -> None:
    prompt_config = yaml.safe_load(
        Path("src/cognitive_code_agent/configs/prompt_config.yml").read_text(encoding="utf-8")
    )
    required_keys = {
        "agent_name",
        "identity",
        "business_objective",
        "response_language",
        "output_style",
        "autonomy_level",
        "emoji_set",
        "workspace_path",
        "analysis_path",
    }
    assert required_keys.issubset(set(prompt_config.keys()))


def test_spawn_agent_registered_in_functions() -> None:
    config = _load_config()
    functions = config["functions"]

    assert "spawn_agent" in functions
    spawn = functions["spawn_agent"]
    assert spawn["_type"] == "spawn_agent"
    assert spawn["llm_name"] == "devstral"
    assert spawn["default_max_iterations"] == 20
    assert spawn["max_active_skills"] == 3
    # Fixed domain agents removed
    assert "security_agent" not in functions
    assert "qa_agent" not in functions
    assert "review_agent" not in functions
    assert "docs_agent" not in functions
    assert "reader_agent" not in functions


def test_spawn_agent_allowed_tools_are_minimal() -> None:
    config = _load_config()
    spawn = config["functions"]["spawn_agent"]
    allowed = spawn["allowed_tools"]

    # Security tools
    assert "run_semgrep" in allowed
    assert "run_trivy" in allowed
    # QA tools
    assert "run_pytest" in allowed
    # Docs tools
    assert "analyze_docstrings" in allowed
    # Review tools
    assert "run_ruff" in allowed
    # File access
    assert "fs_tools" in allowed
    # No redundant tools
    assert "check_readme" not in allowed
    assert "get_diff" not in allowed
    assert "spawn_agent" not in allowed  # anti-recursion


def test_safe_tool_calling_agent_is_registered() -> None:
    register_py = Path("src/cognitive_code_agent/register.py").read_text(encoding="utf-8")

    assert "safe_tool_calling_agent" in register_py
    assert "from cognitive_code_agent.agents import safe_tool_calling_agent" in register_py
    assert '"safe_tool_calling_agent"' in register_py


def test_devstral_llm_config_exists() -> None:
    config = _load_config()
    llm = config["llms"]["devstral"]

    assert llm["_type"] == "nim"
    assert llm["model_name"] == "mistralai/devstral-2-123b-instruct-2512"
    assert llm["temperature"] == 0.3
    assert llm["top_p"] == 0.9
    assert llm["max_tokens"] == 32768
    assert llm["presence_penalty"] == 0.1
    assert llm["frequency_penalty"] == 0.1


def test_kimi_reader_llm_exists() -> None:
    config = _load_config()
    kimi = config["llms"]["kimi_reader"]

    assert kimi["_type"] == "nim"
    assert kimi["model_name"] == "moonshotai/kimi-k2-instruct-0905"


def test_glm_4_7_llm_exists() -> None:
    config = _load_config()
    glm = config["llms"]["glm_4_7"]

    assert glm["_type"] == "nim"
    assert glm["model_name"] == "z-ai/glm4.7"


def test_step_3_5_flash_llm_exists() -> None:
    config = _load_config()
    step = config["llms"]["step_3_5_flash"]

    assert step["_type"] == "nim"
    assert step["model_name"] == "stepfun-ai/step-3.5-flash"


def test_glm_4_7_is_switchable_in_analyze_and_execute() -> None:
    config = _load_config()
    modes = config["workflow"]["modes"]

    assert "glm_4_7" in modes["analyze"]["switchable_models"]
    assert "glm_4_7" in modes["execute"]["switchable_models"]


def test_step_3_5_flash_is_switchable_in_analyze_and_execute() -> None:
    config = _load_config()
    modes = config["workflow"]["modes"]

    assert "step_3_5_flash" in modes["analyze"]["switchable_models"]
    assert "step_3_5_flash" in modes["execute"]["switchable_models"]


def test_generate_report_available_only_in_execute_mode() -> None:
    config = _load_config()
    modes = config["workflow"]["modes"]

    assert "generate_report" in modes["execute"]["tool_names"]
    assert "generate_report" not in modes["analyze"]["tool_names"]
    assert "generate_report" not in modes["chat"]["tool_names"]


def test_single_agent_prompt_preserves_domain_expertise() -> None:
    prompt = Path("src/cognitive_code_agent/prompts/system/base.md").read_text(encoding="utf-8")

    assert "priority_policy" in prompt
    assert "query_findings" in prompt
    assert "persist_findings" in prompt
    assert "Do not emit" in prompt
    # workspace_path now lives in base.md environment section as a template variable
    assert "{{workspace_path}}" in prompt


def test_filesystem_mcp_servers_allow_persistent_workspace() -> None:
    config = _load_config()

    fs_read_args = config["function_groups"]["fs_tools"]["server"]["args"]
    fs_write_args = config["function_groups"]["fs_tools_write"]["server"]["args"]

    assert "/tmp/analysis" in fs_read_args
    assert "/app/workspace" in fs_read_args
    assert "/tmp/analysis" in fs_write_args
    assert "/app/workspace" in fs_write_args


def test_container_runtime_exposes_persistent_workspace_mount() -> None:
    compose = Path("docker-compose.yml").read_text(encoding="utf-8")
    dockerfile = Path("Dockerfile").read_text(encoding="utf-8")

    assert "/app/workspace" in compose
    assert "agent_workspace" in compose
    assert "/app/workspace" in dockerfile


def test_workflow_is_auto_memory_agent_wrapping_code_agent() -> None:
    config = _load_config()
    workflow = config["workflow"]

    assert workflow["_type"] == "safe_tool_calling_agent"
    assert workflow["llm_name"] == "devstral"
    assert workflow["tool_call_timeout_seconds"] == 900


def test_mode_tool_call_budgets_include_spawn_budget_for_analyze() -> None:
    config = _load_config()
    modes = config["workflow"]["modes"]

    analyze_limits = modes["analyze"]["max_tool_calls_per_request"]
    assert analyze_limits["spawn_agent"] == 4
    assert analyze_limits["clone_repository"] == 2


def test_analyze_prompt_is_orchestrator_with_tool_guidance() -> None:
    prompt = Path("src/cognitive_code_agent/prompts/system/analyze.md").read_text(encoding="utf-8")

    assert "orchestrator" in prompt
    assert "<tool_guidance>" in prompt
    assert "<output_guidelines>" in prompt
    assert "spawn_agent" in prompt
