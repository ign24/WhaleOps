"""NAT plugin registration for the AgentJudgeEvaluator."""

from __future__ import annotations

from pydantic import Field

from nat.builder.builder import EvalBuilder
from nat.builder.evaluator import EvaluatorInfo
from nat.builder.framework_enum import LLMFrameworkEnum
from nat.cli.register_workflow import register_evaluator
from nat.data_models.evaluator import EvaluatorBaseConfig


class AgentJudgeEvaluatorConfig(EvaluatorBaseConfig, name="agent_judge"):
    """LLM-as-a-Judge evaluator for CGN-Agent responses.

    Scores 6 dimensions (goal fulfillment, tool grounding, output structure,
    mode/skill appropriateness, safety compliance, conciseness) and returns a
    weighted composite score. A sample passes when weighted_score >= 3.5.
    """

    llm_name: str = Field(description="LLM used as judge (must support structured JSON output).")


@register_evaluator(config_type=AgentJudgeEvaluatorConfig)
async def register_agent_judge_evaluator(config: AgentJudgeEvaluatorConfig, builder: EvalBuilder):
    from .evaluate import AgentJudgeEvaluator

    llm = await builder.get_llm(config.llm_name, wrapper_type=LLMFrameworkEnum.LANGCHAIN)
    evaluator = AgentJudgeEvaluator(llm=llm, max_concurrency=builder.get_max_concurrency())

    yield EvaluatorInfo(
        config=config,
        evaluate_fn=evaluator.evaluate,
        description="LLM-as-a-Judge: 6-dimension agent response scoring",
    )
