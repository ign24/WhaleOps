from __future__ import annotations

from pathlib import Path

import pytest
import yaml

pytestmark = pytest.mark.unit


def _load_config() -> dict:
    config_path = Path("src/cognitive_code_agent/configs/config.yml")
    return yaml.safe_load(config_path.read_text(encoding="utf-8"))


def test_ops_functions_are_registered() -> None:
    config = _load_config()
    functions = config["functions"]

    assert set(
        [
            "list_containers",
            "get_container_logs",
            "inspect_container",
            "schedule_task",
            "save_note",
            "get_notes",
        ]
    ).issubset(set(functions.keys()))


def test_workflow_uses_ops_defaults() -> None:
    config = _load_config()
    workflow = config["workflow"]

    assert workflow["_type"] == "tool_calling_agent"
    assert workflow["llm_name"] == "devstral"
    assert workflow["default_mode"] == "ops"
    assert workflow["prompt_base_path"] == "src/cognitive_code_agent/prompts/system/base.md"
    assert workflow["skill_registry_path"] == "src/cognitive_code_agent/prompts/skills/registry.yml"
    assert workflow["max_active_skills"] == 2


def test_workflow_modes_are_ops_and_chat() -> None:
    config = _load_config()
    modes = config["workflow"]["modes"]

    assert set(modes.keys()) == {"ops", "chat"}
    assert modes["ops"]["prompt_path"] == "src/cognitive_code_agent/prompts/system/ops.md"
    assert modes["chat"]["prompt_path"] == "src/cognitive_code_agent/prompts/system/chat.md"


def test_ops_mode_tools_and_limits_are_present() -> None:
    config = _load_config()
    ops_mode = config["workflow"]["modes"]["ops"]

    assert "list_containers" in ops_mode["tool_names"]
    assert "get_container_logs" in ops_mode["tool_names"]
    assert "inspect_container" in ops_mode["tool_names"]
    assert "schedule_task" in ops_mode["tool_names"]
    assert "save_note" in ops_mode["tool_names"]
    assert "get_notes" in ops_mode["tool_names"]

    limits = ops_mode["max_tool_calls_per_request"]
    assert limits["list_containers"] >= 1
    assert limits["get_container_logs"] >= 1
    assert limits["inspect_container"] >= 1


def test_chat_mode_is_minimal() -> None:
    config = _load_config()
    chat_mode = config["workflow"]["modes"]["chat"]

    assert chat_mode["max_iterations"] == 3
    assert chat_mode["max_history"] == 4
    assert chat_mode["tool_names"] == ["get_notes"]


def test_devstral_llm_config_exists() -> None:
    config = _load_config()
    llm = config["llms"]["devstral"]

    assert llm["_type"] == "nim"
    assert llm["model_name"] == "mistralai/devstral-2-123b-instruct-2512"
    assert llm["temperature"] == 0.1
    assert llm["top_p"] == 0.9
    assert llm["max_tokens"] == 32768


def test_prompt_assets_exist() -> None:
    assert Path("src/cognitive_code_agent/prompts/system/base.md").exists()
    assert Path("src/cognitive_code_agent/prompts/system/ops.md").exists()
    assert Path("src/cognitive_code_agent/prompts/system/chat.md").exists()
    assert Path("src/cognitive_code_agent/prompts/skills/registry.yml").exists()


def test_base_prompt_keeps_tier0_guardrails() -> None:
    prompt = Path("src/cognitive_code_agent/prompts/system/base.md").read_text(encoding="utf-8")

    assert "Tier 0" in prompt
    assert "read-only" in prompt
    assert "query_findings" in prompt
    assert "priority_policy" in prompt


def test_ops_prompt_has_session_protocol_and_escalation() -> None:
    prompt = Path("src/cognitive_code_agent/prompts/system/ops.md").read_text(encoding="utf-8")

    assert "<session_start_protocol>" in prompt
    assert "get_notes" in prompt
    assert "<escalation_policy>" in prompt
    assert "Manual intervention required" in prompt


def test_container_runtime_has_ops_data_mounts() -> None:
    compose = Path("docker-compose.yml").read_text(encoding="utf-8")
    dockerfile = Path("Dockerfile").read_text(encoding="utf-8")

    assert "ops_data:/app/data" in compose
    assert "/var/run/docker.sock:/var/run/docker.sock" in compose
    assert "mkdir -p /app/logs /app/traces /app/data" in dockerfile


def test_register_includes_telegram_and_ops_routes_patch() -> None:
    register_py = Path("src/cognitive_code_agent/register.py").read_text(encoding="utf-8")

    assert "_apply_telegram_patch" in register_py
    assert "register_telegram_routes" in register_py
    assert "register_ops_routes" in register_py
