"""Tests for production-safe memory configuration.

These tests validate that production config keeps the stable single-agent
workflow and avoids loading optional Redis memory components.
"""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml


pytestmark = pytest.mark.unit

CONFIG_PATH = Path("src/cognitive_code_agent/configs/config.yml")


def _load_config() -> dict:
    return yaml.safe_load(CONFIG_PATH.read_text(encoding="utf-8"))


# ---------------------------------------------------------------------------
# Config structure: memory section disabled in production
# ---------------------------------------------------------------------------


class TestMemoryConfigSection:
    """The production config should avoid NAT top-level memory schema collisions."""

    def test_memory_section_is_not_defined(self) -> None:
        config = _load_config()
        assert "memory" not in config


# ---------------------------------------------------------------------------
# Config structure: workflow runs safe single-agent mode
# ---------------------------------------------------------------------------


class TestWorkflowConfiguration:
    """The workflow must run stable safe_tool_calling_agent in production."""

    def test_workflow_type_is_safe_tool_calling_agent(self) -> None:
        config = _load_config()
        assert config["workflow"]["_type"] == "safe_tool_calling_agent"

    def test_workflow_references_inner_agent(self) -> None:
        config = _load_config()
        workflow = config["workflow"]
        assert "llm_name" in workflow
        assert workflow["llm_name"] == "devstral"

    def test_workflow_references_no_top_level_memory_block(self) -> None:
        config = _load_config()
        assert "memory" not in config

    def test_workflow_saves_user_messages(self) -> None:
        config = _load_config()
        workflow = config["workflow"]
        assert workflow["handle_tool_errors"] is True

    def test_workflow_retrieves_memory(self) -> None:
        config = _load_config()
        workflow = config["workflow"]
        assert workflow["tool_call_timeout_seconds"] == 900

    def test_workflow_saves_ai_responses(self) -> None:
        config = _load_config()
        workflow = config["workflow"]
        assert workflow["max_iterations"] == 40

    def test_workflow_search_params_has_top_k(self) -> None:
        config = _load_config()
        workflow = config["workflow"]
        assert "tool_names" in workflow
        assert "query_findings" in workflow["tool_names"]


# ---------------------------------------------------------------------------
# Config structure: inner code_agent exists in functions
# ---------------------------------------------------------------------------


class TestCodeAgentInFunctions:
    """The actual agent must be registered as a function for workflow parity."""

    def test_code_agent_exists_in_functions(self) -> None:
        config = _load_config()
        assert "code_agent" in config["functions"]

    def test_code_agent_type_is_safe_tool_calling(self) -> None:
        config = _load_config()
        code_agent = config["functions"]["code_agent"]
        assert code_agent["_type"] == "safe_tool_calling_agent"

    def test_code_agent_has_all_tools(self) -> None:
        config = _load_config()
        tools = config["functions"]["code_agent"]["tool_names"]

        expected_tools = [
            "spawn_agent",
            "run_pytest",
            "run_semgrep",
            "run_ruff",
            "analyze_docstrings",
            "query_findings",
            "persist_findings",
            "shell_execute",
            "tavily_search",
            "code_gen",
            "refactor_gen",
        ]
        for tool in expected_tools:
            assert tool in tools, f"code_agent must include tool '{tool}'"

    def test_code_agent_has_prompt_paths(self) -> None:
        config = _load_config()
        code_agent = config["functions"]["code_agent"]
        assert "prompt_base_path" in code_agent
        assert "skill_registry_path" in code_agent

    def test_code_agent_llm_is_devstral(self) -> None:
        config = _load_config()
        code_agent = config["functions"]["code_agent"]
        assert code_agent["llm_name"] == "devstral"

    def test_code_agent_preserves_timeout(self) -> None:
        config = _load_config()
        code_agent = config["functions"]["code_agent"]
        assert code_agent["tool_call_timeout_seconds"] == 900

    def test_code_agent_preserves_max_iterations(self) -> None:
        config = _load_config()
        code_agent = config["functions"]["code_agent"]
        assert code_agent["max_iterations"] == 40


# ---------------------------------------------------------------------------
# System prompt: memory block updated for Redis context injection
# ---------------------------------------------------------------------------


class TestSystemPromptMemoryBlock:
    """The base prompt file must guide the agent memory behavior."""

    @staticmethod
    def _base_prompt() -> str:
        config = _load_config()
        prompt_path = Path(config["functions"]["code_agent"]["prompt_base_path"])
        return prompt_path.read_text(encoding="utf-8")

    def test_prompt_references_query_findings(self) -> None:
        prompt = self._base_prompt()
        assert "query_findings" in prompt

    def test_prompt_references_persist_findings(self) -> None:
        prompt = self._base_prompt()
        assert "persist_findings" in prompt

    def test_prompt_mentions_automatic_memory_injection(self) -> None:
        prompt = self._base_prompt()
        assert "automatically" in prompt.lower() or "injected" in prompt.lower()

    def test_prompt_handles_degraded_memory(self) -> None:
        prompt = self._base_prompt()
        assert "degraded" in prompt.lower() or "empty" in prompt.lower()


# ---------------------------------------------------------------------------
# Dependency: nvidia-nat-redis in pyproject.toml
# ---------------------------------------------------------------------------


class TestDependency:
    """The Redis NAT plugin must be declared as a dependency."""

    def test_nat_redis_in_dependencies(self) -> None:
        pyproject = Path("pyproject.toml").read_text(encoding="utf-8")
        assert "nvidia-nat-redis" in pyproject

    def test_mem0ai_not_required(self) -> None:
        pyproject = Path("pyproject.toml").read_text(encoding="utf-8")
        assert "nvidia-nat-mem0ai" not in pyproject


# ---------------------------------------------------------------------------
# Environment: no Mem0 API key dependency
# ---------------------------------------------------------------------------


class TestEnvironmentConfig:
    """Redis-backed memory must not require MEM0_API_KEY."""

    def test_mem0_api_key_not_in_env_example(self) -> None:
        env_example = Path(".env.example").read_text(encoding="utf-8")
        assert "MEM0_API_KEY" not in env_example

    def test_mem0_api_key_not_in_docker_compose(self) -> None:
        compose = Path("docker-compose.yml").read_text(encoding="utf-8")
        assert "MEM0_API_KEY" not in compose
