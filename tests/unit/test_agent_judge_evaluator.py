"""Unit tests for AgentJudgeEvaluator."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock

import pytest

from cognitive_code_agent.eval.evaluate import (
    AgentJudgeEvaluator,
    _WEIGHTS_BY_MODE,
    _compute_weighted_score,
    _get_weights,
    _parse_judge_output,
)

pytestmark = pytest.mark.unit


# ---------------------------------------------------------------------------
# _get_weights
# ---------------------------------------------------------------------------


def test_get_weights_analyze() -> None:
    w = _get_weights("analyze")
    assert w["goal_fulfillment"] == pytest.approx(0.30)
    assert w["tool_grounding"] == pytest.approx(0.30)
    assert sum(w.values()) == pytest.approx(1.0)


def test_get_weights_refactor_has_higher_tool_grounding() -> None:
    w = _get_weights("refactor")
    assert w["tool_grounding"] == pytest.approx(0.35)
    assert sum(w.values()) == pytest.approx(1.0)


def test_get_weights_execute_has_higher_safety() -> None:
    w = _get_weights("execute")
    assert w["safety_compliance"] == pytest.approx(0.30)
    assert sum(w.values()) == pytest.approx(1.0)


def test_get_weights_unknown_mode_falls_back_to_analyze() -> None:
    w = _get_weights("unknown_mode")
    assert w == _WEIGHTS_BY_MODE["analyze"]


# ---------------------------------------------------------------------------
# _compute_weighted_score
# ---------------------------------------------------------------------------


def test_compute_weighted_score_uses_provided_weights() -> None:
    scores = {dim: 5 for dim in _WEIGHTS_BY_MODE["analyze"]}
    result = _compute_weighted_score(scores, _WEIGHTS_BY_MODE["analyze"])
    assert result == pytest.approx(5.0)


def test_compute_weighted_score_refactor_weights_tool_grounding_more() -> None:
    scores_a = {dim: 3 for dim in _WEIGHTS_BY_MODE["analyze"]}
    scores_a["tool_grounding"] = 1

    scores_r = {dim: 3 for dim in _WEIGHTS_BY_MODE["refactor"]}
    scores_r["tool_grounding"] = 1

    score_analyze = _compute_weighted_score(scores_a, _WEIGHTS_BY_MODE["analyze"])
    score_refactor = _compute_weighted_score(scores_r, _WEIGHTS_BY_MODE["refactor"])

    # refactor weights tool_grounding at 0.35 vs analyze at 0.30
    # so penalty for score 1 on tool_grounding is larger in refactor
    assert score_refactor < score_analyze


# ---------------------------------------------------------------------------
# _parse_judge_output
# ---------------------------------------------------------------------------


def test_parse_judge_output_plain_json() -> None:
    payload = {
        "dimension_reasoning": {"goal_fulfillment": "good"},
        "scores": {"goal_fulfillment": 4},
        "weighted_score": 4.0,
        "pass": True,
        "critical_failures": [],
        "rationale": "ok",
    }
    result = _parse_judge_output(json.dumps(payload))
    assert result["scores"]["goal_fulfillment"] == 4
    assert result["dimension_reasoning"]["goal_fulfillment"] == "good"


def test_parse_judge_output_tolerates_markdown_fence() -> None:
    payload = {"scores": {"goal_fulfillment": 3}, "pass": False, "rationale": "meh"}
    raw = "```json\n" + json.dumps(payload) + "\n```"
    result = _parse_judge_output(raw)
    assert result["scores"]["goal_fulfillment"] == 3


def test_parse_judge_output_tolerates_missing_dimension_reasoning() -> None:
    payload = {
        "scores": {"goal_fulfillment": 4},
        "weighted_score": 4.0,
        "pass": True,
        "critical_failures": [],
        "rationale": "ok",
    }
    result = _parse_judge_output(json.dumps(payload))
    # No dimension_reasoning key — should not raise
    assert "dimension_reasoning" not in result or result.get("dimension_reasoning") is None


# ---------------------------------------------------------------------------
# AgentJudgeEvaluator.__init__
# ---------------------------------------------------------------------------


def test_evaluator_defaults_to_analyze_mode() -> None:
    llm = MagicMock()
    ev = AgentJudgeEvaluator(llm=llm)
    assert ev.mode == "analyze"
    assert ev.weights == _WEIGHTS_BY_MODE["analyze"]


def test_evaluator_accepts_refactor_mode() -> None:
    llm = MagicMock()
    ev = AgentJudgeEvaluator(llm=llm, mode="refactor")
    assert ev.mode == "refactor"
    assert ev.weights["tool_grounding"] == pytest.approx(0.35)


def test_evaluator_unknown_mode_falls_back_to_analyze() -> None:
    llm = MagicMock()
    ev = AgentJudgeEvaluator(llm=llm, mode="bogus")
    assert ev.mode == "analyze"


# ---------------------------------------------------------------------------
# evaluate_item — mocked LLM
# ---------------------------------------------------------------------------


def _make_judge_response(scores: dict[str, int], rationale: str = "ok") -> dict:
    return {
        "dimension_reasoning": {dim: "reasoning" for dim in scores},
        "scores": scores,
        "weighted_score": 4.0,
        "pass": True,
        "critical_failures": [],
        "rationale": rationale,
    }


def _make_item(
    id: str = "test-1",
    question: str = "analyze repo",
    answer: str = "found issues",
    mode: str | None = None,
) -> object:
    from nat.eval.evaluator.evaluator_model import EvalInputItem

    entry: dict = {}
    if mode:
        entry["mode"] = mode
    return EvalInputItem(
        id=id,
        input_obj=question,
        output_obj=answer,
        expected_output_obj="",
        full_dataset_entry=entry or None,
    )


@pytest.mark.asyncio
async def test_evaluate_item_returns_correct_mode_in_reasoning() -> None:
    from nat.eval.evaluator.evaluator_model import EvalInputItem

    scores = {dim: 4 for dim in _WEIGHTS_BY_MODE["analyze"]}
    llm = MagicMock()
    llm.ainvoke = AsyncMock(
        return_value=MagicMock(content=json.dumps(_make_judge_response(scores)))
    )

    ev = AgentJudgeEvaluator(llm=llm, mode="analyze")
    item = EvalInputItem(
        id="x", input_obj="q", output_obj="a", expected_output_obj="", full_dataset_entry={}
    )
    result = await ev.evaluate_item(item)

    assert result.reasoning["mode"] == "analyze"
    assert result.score > 0


@pytest.mark.asyncio
async def test_evaluate_item_per_item_mode_override() -> None:
    from nat.eval.evaluator.evaluator_model import EvalInputItem

    scores = {dim: 4 for dim in _WEIGHTS_BY_MODE["refactor"]}
    llm = MagicMock()
    llm.ainvoke = AsyncMock(
        return_value=MagicMock(content=json.dumps(_make_judge_response(scores)))
    )

    ev = AgentJudgeEvaluator(llm=llm, mode="analyze")
    item = EvalInputItem(
        id="x",
        input_obj="q",
        output_obj="a",
        expected_output_obj="",
        full_dataset_entry={"mode": "refactor"},
    )
    result = await ev.evaluate_item(item)
    assert result.reasoning["mode"] == "refactor"


@pytest.mark.asyncio
async def test_evaluate_item_handles_json_parse_error() -> None:
    from nat.eval.evaluator.evaluator_model import EvalInputItem

    llm = MagicMock()
    llm.ainvoke = AsyncMock(return_value=MagicMock(content="not json at all"))

    ev = AgentJudgeEvaluator(llm=llm)
    item = EvalInputItem(
        id="x", input_obj="q", output_obj="a", expected_output_obj="", full_dataset_entry={}
    )
    result = await ev.evaluate_item(item)

    assert result.score == 0.0
    assert "error" in result.reasoning


@pytest.mark.asyncio
async def test_evaluate_item_includes_dimension_reasoning() -> None:
    from nat.eval.evaluator.evaluator_model import EvalInputItem

    scores = {dim: 5 for dim in _WEIGHTS_BY_MODE["analyze"]}
    payload = _make_judge_response(scores)
    llm = MagicMock()
    llm.ainvoke = AsyncMock(return_value=MagicMock(content=json.dumps(payload)))

    ev = AgentJudgeEvaluator(llm=llm)
    item = EvalInputItem(
        id="x", input_obj="q", output_obj="a", expected_output_obj="", full_dataset_entry={}
    )
    result = await ev.evaluate_item(item)

    assert "dimension_reasoning" in result.reasoning
    assert isinstance(result.reasoning["dimension_reasoning"], dict)
