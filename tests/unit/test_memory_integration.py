"""Tests for ops memory wiring and resilient configuration."""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

pytestmark = pytest.mark.unit

CONFIG_PATH = Path("src/cognitive_code_agent/configs/config.yml")
MEMORY_CONFIG_PATH = Path("src/cognitive_code_agent/configs/memory.yml")


def _load_config() -> dict:
    return yaml.safe_load(CONFIG_PATH.read_text(encoding="utf-8"))


def _load_memory_config() -> dict:
    return yaml.safe_load(MEMORY_CONFIG_PATH.read_text(encoding="utf-8"))


def test_top_level_config_has_no_legacy_memory_block() -> None:
    config = _load_config()
    assert "memory" not in config


def test_workflow_uses_tool_calling_agent_with_memory_safe_defaults() -> None:
    config = _load_config()
    workflow = config["workflow"]

    assert workflow["_type"] == "tool_calling_agent"
    assert workflow["llm_name"] == "devstral"
    assert workflow["handle_tool_errors"] is True
    assert workflow["tool_call_timeout_seconds"] == 30


def test_workflow_default_mode_is_ops_and_chat_mode_exists() -> None:
    config = _load_config()
    workflow = config["workflow"]

    assert workflow["default_mode"] == "ops"
    assert set(workflow["modes"].keys()) == {"ops", "chat"}


def test_workflow_tools_include_notes_for_memory_usage() -> None:
    config = _load_config()
    workflow_tools = config["workflow"]["tool_names"]

    assert "save_note" in workflow_tools
    assert "get_notes" in workflow_tools


def test_memory_yaml_exists_and_enables_layers() -> None:
    assert MEMORY_CONFIG_PATH.exists()
    memory = _load_memory_config()

    assert memory["working"]["enabled"] is True
    assert memory["episodic"]["enabled"] is True
    assert memory["auto_retrieval"]["enabled"] is True
    assert memory["semantic"]["enabled"] is True


def test_memory_yaml_uses_ops_semantic_collection_name() -> None:
    memory = _load_memory_config()
    assert memory["semantic"]["collection_name"] == "ops_domain_knowledge"


def test_memory_dependencies_and_env_contract() -> None:
    pyproject = Path("pyproject.toml").read_text(encoding="utf-8")
    env_example = Path(".env.example").read_text(encoding="utf-8")
    compose = Path("docker-compose.yml").read_text(encoding="utf-8")

    assert "nvidia-nat-redis" in pyproject
    assert "MEM0_API_KEY" not in env_example
    assert "MEM0_API_KEY" not in compose


def test_base_prompt_mentions_degraded_or_empty_memory_behavior() -> None:
    prompt = Path("src/cognitive_code_agent/prompts/system/base.md").read_text(encoding="utf-8")

    assert "query_findings" in prompt
    assert "degraded" in prompt.lower() or "empty" in prompt.lower()
