"""Dynamic ephemeral code-expert subagent spawning.

Provides `SpawnAgentRunner` (testable core logic) and the NAT-registered
`spawn_agent_function` that exposes it as a LangChain tool via `FunctionInfo`.

The orchestrator calls spawn_agent(task, tools, max_iterations) to create an
isolated code-expert agent with exactly the tools it needs for the job.
Spawned agents:
- Cannot spawn further agents (spawn_agent excluded from their tool set)
- Autonomously select relevant skills from the registry based on the task
- Have mid-loop compaction enabled at tighter thresholds than the orchestrator
"""

import json
import logging
from typing import Any
from typing import Callable
from typing import Awaitable

from pydantic import Field

from nat.builder.builder import Builder
from nat.builder.framework_enum import LLMFrameworkEnum
from nat.builder.function_info import FunctionInfo
from nat.cli.register_workflow import register_function
from nat.data_models.function import FunctionBaseConfig

from cognitive_code_agent.memory import WorkingMemoryConfig
from cognitive_code_agent.prompts import build_active_skills_block

logger = logging.getLogger(__name__)

_SPAWN_AGENT_BASE_PROMPT = """\
You are a code expert. Your job is to complete the task you are given using the tools available.

Before starting domain-specific work, review the task and load the appropriate skills if any are
available. Skills guide you to use tools correctly and produce high-quality results.

Be precise and evidence-based. Only report what you can confirm from tool output."""

_SPAWN_AGENT_DESCRIPTION = """\
Spawn an ephemeral code-expert agent to handle a focused task in isolation.

Use this tool when you need to:
- Run a domain-specific analysis (security, QA, docs, code review) in a dedicated context
- Execute multiple independent analyses in parallel (call spawn_agent multiple times in one batch)
- Offload intensive file exploration that would grow the main context excessively

Parameters:
  task: Full task description. Be specific — include the repo path and what you need.
  tools: List of tool names to give the agent. Pass only what the task needs:
    - Security: ["run_semgrep", "run_trivy", "run_gitleaks", "run_bandit"]
    - QA:       ["run_pytest", "run_jest", "analyze_test_coverage"]
    - Docs:     ["check_readme", "analyze_docstrings", "analyze_api_docs"]
    - Review:   ["run_ruff", "run_eslint", "analyze_complexity"]
    - Explore:  ["fs_tools__directory_tree", "fs_tools__read_text_file", ...]
  max_iterations: How many LLM turns the agent can take (default 20).

Returns: The agent's final text response."""


def _emit_trace_event(event_type: str, payload: dict) -> None:
    event = {"event_type": event_type, **payload}
    logger.info("trace_event=%s", json.dumps(event, ensure_ascii=True))


class SpawnAgentRunner:
    """Core logic for spawning ephemeral code-expert agents.

    Decoupled from NAT registration to enable unit testing without builder.

    Args:
        tool_registry: Pre-built {tool_name: LangChain tool} from the allowlist.
        llm: LangChain-wrapped LLM for spawned agents.
        summary_llm: LLM for mid-loop compaction (None disables compaction).
        skill_registry_path: Path to the skill registry YAML.
        max_active_skills: Max skills loaded per spawned agent (default 3).
        _build_and_run: Optional override for testing — replaces actual graph build+run.
    """

    def __init__(
        self,
        *,
        tool_registry: dict[str, Any],
        llm: Any,
        summary_llm: Any | None,
        skill_registry_path: str,
        max_active_skills: int = 3,
        _build_and_run: Callable[..., Awaitable[str]] | None = None,
    ) -> None:
        self._tool_registry = tool_registry
        self._llm = llm
        self._summary_llm = summary_llm
        self._skill_registry_path = skill_registry_path
        self._max_active_skills = max_active_skills
        self._build_and_run = _build_and_run
        # Request-scoped set of NAT function IDs known to be in DEGRADED state.
        self._blacklisted_function_ids: set[str] = set()

    async def run(
        self,
        task: str,
        tools: list[str],
        max_iterations: int = 20,
    ) -> str:
        """Spawn an ephemeral agent and return its final text response."""
        import re

        # Filter: only tools in allowlist, never spawn_agent itself
        filtered = [
            self._tool_registry[t] for t in tools if t in self._tool_registry and t != "spawn_agent"
        ]

        if not filtered:
            return "No valid tools available for this task."

        response: str
        if self._build_and_run is not None:
            # Testable injection point
            response = await self._build_and_run(filtered, task, max_iterations)
        elif self._blacklisted_function_ids:
            # At least one function is known DEGRADED — skip remote, go direct
            _emit_trace_event(
                "spawn_agent_degraded_fallback",
                {
                    "task": task[:200],
                    "reason": "blacklisted",
                    "function_ids": list(self._blacklisted_function_ids),
                },
            )
            response = await self._run_graph_direct(filtered, task, max_iterations)
        else:
            try:
                response = await self._run_graph(filtered, task, max_iterations)
            except Exception as ex:  # noqa: BLE001
                error_msg = str(ex)
                if "degraded function cannot be invoked" in error_msg.lower():
                    # Extract and blacklist the degraded function ID
                    match = re.search(
                        r"function\s+id\s+['\"]?([0-9a-f-]{36})['\"]?",
                        error_msg,
                        re.IGNORECASE,
                    )
                    fn_id = match.group(1) if match else None
                    if fn_id:
                        self._blacklisted_function_ids.add(fn_id)
                    _emit_trace_event(
                        "spawn_agent_degraded_fallback",
                        {
                            "task": task[:200],
                            "reason": "detected",
                            "function_id": fn_id,
                        },
                    )
                    response = await self._run_graph_direct(filtered, task, max_iterations)
                else:
                    raise

        _emit_trace_event(
            "subagent_spawned",
            {
                "task": task[:200],
                "tools": tools,
                "max_iterations": max_iterations,
                "response_len": len(response),
            },
        )

        return response

    async def _run_graph_direct(
        self,
        filtered_tools: list[Any],
        task: str,
        max_iterations: int,
    ) -> str:
        """Execute the task in-process without remote NAT function invocation.

        Used as a fallback when the remote function is in a DEGRADED state.
        Delegates to ``_run_graph`` since ``_run_graph`` already builds and runs
        the graph in-process — no remote invocation is involved.
        """
        return await self._run_graph(filtered_tools, task, max_iterations)

    async def _run_graph(
        self,
        filtered_tools: list[Any],
        task: str,
        max_iterations: int,
    ) -> str:
        """Build and run a SafeToolCallAgentGraph for the given tools and task."""
        # Import here to avoid circular imports at module level
        from langchain_core.messages import HumanMessage
        from nat.agent.tool_calling_agent.agent import ToolCallAgentGraphState
        from nat.agent.tool_calling_agent.agent import create_tool_calling_agent_prompt
        from nat.agent.tool_calling_agent.register import ToolCallAgentWorkflowConfig

        from cognitive_code_agent.agents.safe_tool_calling_agent import SafeToolCallAgentGraph

        tool_names = [t.name for t in filtered_tools]

        # Select skills based on task text and available tools
        _, skills_block = build_active_skills_block(
            user_message=task,
            available_tools=tool_names,
            registry_path=self._skill_registry_path,
            max_active_skills=self._max_active_skills,
        )

        system_prompt = _SPAWN_AGENT_BASE_PROMPT
        if skills_block:
            system_prompt = f"{system_prompt}\n\n{skills_block}"

        agent_config = ToolCallAgentWorkflowConfig(
            llm_name="devstral",
            system_prompt=system_prompt,
            tool_names=[],
        )
        prompt = create_tool_calling_agent_prompt(agent_config)

        compaction_config = WorkingMemoryConfig(
            compaction_char_threshold=20000,
            compaction_message_threshold=15,
            compaction_retain_recent=5,
            compaction_cooldown_messages=5,
        )

        graph = await SafeToolCallAgentGraph(
            llm=self._llm,
            tools=filtered_tools,
            prompt=prompt,
            handle_tool_errors=True,
            summary_llm=self._summary_llm,
            compaction_config=compaction_config,
        ).build_graph()

        state = ToolCallAgentGraphState(messages=[HumanMessage(content=task)])
        recursion_limit = (max_iterations + 1) * 2

        result = await graph.ainvoke(state, config={"recursion_limit": recursion_limit})
        final_state = ToolCallAgentGraphState(**result)
        return str(final_state.messages[-1].content) if final_state.messages else ""


class SpawnAgentConfig(FunctionBaseConfig, name="spawn_agent"):
    description: str = Field(default=_SPAWN_AGENT_DESCRIPTION)
    llm_name: str = Field(default="devstral")
    allowed_tools: list[str] = Field(default_factory=list)
    default_max_iterations: int = Field(default=20)
    max_active_skills: int = Field(default=3)
    skill_registry_path: str = Field(default="src/cognitive_code_agent/prompts/skills/registry.yml")
    summary_llm_name: str | None = Field(default=None)


@register_function(config_type=SpawnAgentConfig)
async def spawn_agent_function(config: SpawnAgentConfig, builder: Builder):
    """NAT registration point — yields a lazy-resolving spawn tool.

    Tool resolution is intentionally deferred to call time to avoid startup
    dependency cycles in WorkflowBuilder (e.g., spawn_agent requested before
    domain tools are fully registered).
    """
    allowed_set = {name for name in config.allowed_tools if name != "spawn_agent"}
    tool_registry_cache: dict[str, Any] = {}

    llm = await builder.get_llm(config.llm_name, wrapper_type=LLMFrameworkEnum.LANGCHAIN)

    summary_llm: Any | None = None
    if config.summary_llm_name:
        try:
            summary_llm = await builder.get_llm(
                config.summary_llm_name, wrapper_type=LLMFrameworkEnum.LANGCHAIN
            )
        except Exception:
            logger.warning(
                "spawn_agent: failed to resolve summary_llm '%s', compaction disabled",
                config.summary_llm_name,
                exc_info=True,
            )

    async def _run(
        task: str,
        tools: list[str],
        max_iterations: int = 20,
    ) -> str:
        requested = [t for t in tools if t in allowed_set and t != "spawn_agent"]
        if not requested:
            return "No valid tools available for this task."

        missing = [t for t in requested if t not in tool_registry_cache]
        if missing:
            resolved = await builder.get_tools(
                tool_names=missing, wrapper_type=LLMFrameworkEnum.LANGCHAIN
            )
            for tool in resolved:
                tool_registry_cache[tool.name] = tool

        tool_registry = {
            name: tool_registry_cache[name] for name in requested if name in tool_registry_cache
        }
        if not tool_registry:
            return "No valid tools available for this task."

        runner = SpawnAgentRunner(
            tool_registry=tool_registry,
            llm=llm,
            summary_llm=summary_llm,
            skill_registry_path=config.skill_registry_path,
            max_active_skills=config.max_active_skills,
        )
        return await runner.run(task=task, tools=requested, max_iterations=max_iterations)

    yield FunctionInfo.from_fn(_run, description=config.description)
