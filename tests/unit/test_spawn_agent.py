"""Unit tests for SpawnAgentTool.

Tests cover:
- Tool filtering: tools not in allowlist are excluded from spawned agent
- Anti-recursion: spawn_agent itself never appears in spawned agent tools
- Parallel execution: two concurrent calls return independent responses
- Trace event: subagent_spawned event is emitted with correct fields
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock
from unittest.mock import MagicMock

import pytest
from langchain_core.messages import AIMessage
from langchain_core.messages import HumanMessage


# ---------------------------------------------------------------------------
# Helpers / fakes
# ---------------------------------------------------------------------------


def _make_fake_tool(name: str) -> MagicMock:
    t = MagicMock()
    t.name = name
    return t


def _make_fake_graph(response: str = "done") -> AsyncMock:
    """Return a fake compiled LangGraph that resolves with a canned response."""
    final_message = AIMessage(content=response)
    graph = AsyncMock()
    graph.ainvoke = AsyncMock(
        return_value={"messages": [HumanMessage(content="task"), final_message]}
    )
    return graph


# ---------------------------------------------------------------------------
# Import under test — deferred until after we write the tests (RED phase)
# ---------------------------------------------------------------------------

from cognitive_code_agent.tools.spawn_agent import SpawnAgentConfig  # noqa: E402
from cognitive_code_agent.tools.spawn_agent import SpawnAgentRunner  # noqa: E402
from cognitive_code_agent.tools.spawn_agent import spawn_agent_function  # noqa: E402


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestSpawnAgentToolFiltering:
    """7.1 — tools not in allowlist are silently excluded."""

    @pytest.mark.asyncio
    async def test_non_allowlist_tool_excluded(self, monkeypatch):
        allowed_registry = {
            "run_semgrep": _make_fake_tool("run_semgrep"),
            "run_trivy": _make_fake_tool("run_trivy"),
        }

        captured_tools: list = []

        async def fake_build_and_run(tools, task, max_iterations):
            captured_tools.extend(tools)
            return "result"

        runner = SpawnAgentRunner(
            tool_registry=allowed_registry,
            llm=AsyncMock(),
            summary_llm=None,
            skill_registry_path="src/cognitive_code_agent/prompts/skills/registry.yml",
            max_active_skills=2,
            _build_and_run=fake_build_and_run,
        )

        await runner.run(
            task="security audit",
            tools=["run_semgrep", "run_trivy", "run_bandit"],  # bandit not in registry
            max_iterations=5,
        )

        assert len(captured_tools) == 2
        tool_names = {t.name for t in captured_tools}
        assert tool_names == {"run_semgrep", "run_trivy"}
        assert "run_bandit" not in tool_names

    @pytest.mark.asyncio
    async def test_empty_allowed_registry_returns_no_tools_message(self):
        runner = SpawnAgentRunner(
            tool_registry={},
            llm=AsyncMock(),
            summary_llm=None,
            skill_registry_path="src/cognitive_code_agent/prompts/skills/registry.yml",
            max_active_skills=2,
        )

        result = await runner.run(task="do something", tools=["run_semgrep"], max_iterations=5)
        assert "no valid tools" in result.lower()


class TestSpawnAgentAntiRecursion:
    """7.2 — spawn_agent itself never appears in spawned agent tools."""

    @pytest.mark.asyncio
    async def test_spawn_agent_excluded_even_if_in_tools_arg(self, monkeypatch):
        allowed_registry = {
            "run_semgrep": _make_fake_tool("run_semgrep"),
            "spawn_agent": _make_fake_tool("spawn_agent"),  # present in registry
        }

        captured_tools: list = []

        async def fake_build_and_run(tools, task, max_iterations):
            captured_tools.extend(tools)
            return "result"

        runner = SpawnAgentRunner(
            tool_registry=allowed_registry,
            llm=AsyncMock(),
            summary_llm=None,
            skill_registry_path="src/cognitive_code_agent/prompts/skills/registry.yml",
            max_active_skills=2,
            _build_and_run=fake_build_and_run,
        )

        await runner.run(
            task="security audit",
            tools=["run_semgrep", "spawn_agent"],
            max_iterations=5,
        )

        tool_names = {t.name for t in captured_tools}
        assert "spawn_agent" not in tool_names
        assert "run_semgrep" in tool_names


class TestSpawnAgentParallel:
    """7.3 — two concurrent calls return independent responses."""

    @pytest.mark.asyncio
    async def test_parallel_calls_return_independent_results(self):
        call_count = 0

        async def fake_build_and_run(tools, task, max_iterations):
            nonlocal call_count
            call_count += 1
            await asyncio.sleep(0)  # yield to allow interleaving
            return f"result-for-{task}"

        allowed_registry = {"run_semgrep": _make_fake_tool("run_semgrep")}
        runner = SpawnAgentRunner(
            tool_registry=allowed_registry,
            llm=AsyncMock(),
            summary_llm=None,
            skill_registry_path="src/cognitive_code_agent/prompts/skills/registry.yml",
            max_active_skills=2,
            _build_and_run=fake_build_and_run,
        )

        r1, r2 = await asyncio.gather(
            runner.run(task="task-A", tools=["run_semgrep"], max_iterations=5),
            runner.run(task="task-B", tools=["run_semgrep"], max_iterations=5),
        )

        assert r1 == "result-for-task-A"
        assert r2 == "result-for-task-B"
        assert call_count == 2


class TestSpawnAgentTraceEvent:
    """7.4 — subagent_spawned trace event is emitted with required fields."""

    @pytest.mark.asyncio
    async def test_trace_event_emitted_on_success(self, monkeypatch):
        emitted: list[dict] = []

        async def fake_build_and_run(tools, task, max_iterations):
            return "analysis complete"

        import cognitive_code_agent.tools.spawn_agent as spawn_module

        monkeypatch.setattr(
            spawn_module,
            "_emit_trace_event",
            lambda event_type, payload: emitted.append({"event_type": event_type, **payload}),
        )

        allowed_registry = {"run_trivy": _make_fake_tool("run_trivy")}
        runner = SpawnAgentRunner(
            tool_registry=allowed_registry,
            llm=AsyncMock(),
            summary_llm=None,
            skill_registry_path="src/cognitive_code_agent/prompts/skills/registry.yml",
            max_active_skills=2,
            _build_and_run=fake_build_and_run,
        )

        await runner.run(task="scan for cves", tools=["run_trivy"], max_iterations=10)

        assert len(emitted) == 1
        event = emitted[0]
        assert event["event_type"] == "subagent_spawned"
        assert "task" in event
        assert "tools" in event
        assert "max_iterations" in event
        assert "response_len" in event
        assert event["response_len"] == len("analysis complete")

    @pytest.mark.asyncio
    async def test_task_truncated_to_200_chars_in_event(self, monkeypatch):
        emitted: list[dict] = []
        long_task = "x" * 500

        async def fake_build_and_run(tools, task, max_iterations):
            return "done"

        import cognitive_code_agent.tools.spawn_agent as spawn_module

        monkeypatch.setattr(
            spawn_module,
            "_emit_trace_event",
            lambda event_type, payload: emitted.append({"event_type": event_type, **payload}),
        )

        allowed_registry = {"run_trivy": _make_fake_tool("run_trivy")}
        runner = SpawnAgentRunner(
            tool_registry=allowed_registry,
            llm=AsyncMock(),
            summary_llm=None,
            skill_registry_path="src/cognitive_code_agent/prompts/skills/registry.yml",
            max_active_skills=2,
            _build_and_run=fake_build_and_run,
        )

        await runner.run(task=long_task, tools=["run_trivy"], max_iterations=5)

        assert len(emitted[0]["task"]) <= 200


class TestSpawnAgentRegistration:
    @pytest.mark.asyncio
    async def test_registration_builds_function_info_without_type_error(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        class FakeBuilder:
            def __init__(self) -> None:
                self.get_llm = AsyncMock(return_value=AsyncMock())
                self.get_tools = AsyncMock(
                    side_effect=lambda tool_names, wrapper_type=None: [
                        _make_fake_tool(name) for name in tool_names
                    ]
                )

        builder = FakeBuilder()
        cfg = SpawnAgentConfig(
            allowed_tools=["run_semgrep", "run_trivy"],
            llm_name="devstral",
        )

        async def fake_run(self, task, tools, max_iterations):  # type: ignore[no-untyped-def]
            return "ok"

        monkeypatch.setattr(SpawnAgentRunner, "run", fake_run)

        async with spawn_agent_function(cfg, builder) as function_info:
            assert function_info is not None
            payload = function_info.input_schema(
                task="security scan",
                tools=["run_semgrep"],
                max_iterations=3,
            )
            result = await function_info.single_fn(payload)
            assert result == "ok"


# ---------------------------------------------------------------------------
# DEGRADED function fallback (Group 5)
# ---------------------------------------------------------------------------

pytestmark = pytest.mark.unit


class TestSpawnAgentDegradedFallback:
    async def test_degraded_error_caught_local_execution_runs(self, monkeypatch) -> None:
        """When _run_graph raises DEGRADED, run falls back to local direct execution."""
        from unittest.mock import patch

        degraded_error = RuntimeError(
            "[400] Bad Request Function id '7fe236cd-dab4-40d4-a139-b28d6673ffd3': "
            "DEGRADED function cannot be invoked"
        )
        local_response = "local fallback result"

        call_log: list[str] = []

        async def fake_run_graph(self, filtered_tools, task, max_iterations):  # type: ignore
            call_log.append("remote")
            raise degraded_error

        async def fake_run_graph_direct(self, filtered_tools, task, max_iterations):  # type: ignore
            call_log.append("local")
            return local_response

        allowed_registry = {"run_trivy": _make_fake_tool("run_trivy")}

        with patch.object(SpawnAgentRunner, "_run_graph", fake_run_graph):
            with patch.object(SpawnAgentRunner, "_run_graph_direct", fake_run_graph_direct):
                runner = SpawnAgentRunner(
                    tool_registry=allowed_registry,
                    llm=AsyncMock(),
                    summary_llm=None,
                    skill_registry_path="src/cognitive_code_agent/prompts/skills/registry.yml",
                )
                result = await runner.run(task="scan for vulns", tools=["run_trivy"])

        assert result == local_response
        assert "remote" in call_log
        assert "local" in call_log

    async def test_blacklisted_function_skips_remote_call(self, monkeypatch) -> None:
        """When function ID is already blacklisted, remote call is skipped entirely."""
        from unittest.mock import patch

        local_response = "direct result"
        call_log: list[str] = []

        async def fake_run_graph(self, filtered_tools, task, max_iterations):  # type: ignore
            call_log.append("remote")
            return "should not reach here"

        async def fake_run_graph_direct(self, filtered_tools, task, max_iterations):  # type: ignore
            call_log.append("local")
            return local_response

        allowed_registry = {"run_trivy": _make_fake_tool("run_trivy")}

        with patch.object(SpawnAgentRunner, "_run_graph", fake_run_graph):
            with patch.object(SpawnAgentRunner, "_run_graph_direct", fake_run_graph_direct):
                runner = SpawnAgentRunner(
                    tool_registry=allowed_registry,
                    llm=AsyncMock(),
                    summary_llm=None,
                    skill_registry_path="src/cognitive_code_agent/prompts/skills/registry.yml",
                )
                # Pre-blacklist the function
                runner._blacklisted_function_ids.add("7fe236cd-dab4-40d4-a139-b28d6673ffd3")

                result = await runner.run(task="scan", tools=["run_trivy"])

        assert result == local_response
        assert "remote" not in call_log
        assert "local" in call_log

    async def test_degraded_fallback_result_shape_matches_normal(self, monkeypatch) -> None:
        """Result from degraded fallback is a string, same as normal execution."""
        from unittest.mock import patch

        async def fake_run_graph_raises(self, filtered_tools, task, max_iterations):  # type: ignore
            raise RuntimeError("DEGRADED function cannot be invoked")

        async def fake_run_graph_direct(self, filtered_tools, task, max_iterations):  # type: ignore
            return "security findings: none found"

        allowed_registry = {"run_bandit": _make_fake_tool("run_bandit")}

        with patch.object(SpawnAgentRunner, "_run_graph", fake_run_graph_raises):
            with patch.object(SpawnAgentRunner, "_run_graph_direct", fake_run_graph_direct):
                runner = SpawnAgentRunner(
                    tool_registry=allowed_registry,
                    llm=AsyncMock(),
                    summary_llm=None,
                    skill_registry_path="src/cognitive_code_agent/prompts/skills/registry.yml",
                )
                result = await runner.run(task="run bandit", tools=["run_bandit"])

        assert isinstance(result, str)
        assert len(result) > 0
