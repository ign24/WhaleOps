"""Standalone runner for AgentJudgeEvaluator.

Loads the NVIDIA NIM LLM directly and runs the judge on pre-generated
samples, bypassing the NAT CLI workflow machinery.

Usage:
    python scripts/run_judge_eval.py
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path

# make sure the src package is importable
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))


async def main() -> None:
    from langchain_nvidia_ai_endpoints import ChatNVIDIA

    from cognitive_code_agent.eval.evaluate import AgentJudgeEvaluator
    from nat.eval.evaluator.evaluator_model import EvalInput
    from nat.eval.evaluator.evaluator_model import EvalInputItem

    api_key = os.environ.get("NVIDIA_API_KEY", "")
    base_url = os.environ.get("NIM_BASE_URL", "https://integrate.api.nvidia.com/v1")

    if not api_key:
        print("ERROR: NVIDIA_API_KEY not set")
        sys.exit(1)

    llm = ChatNVIDIA(
        model="nvidia/llama-3.3-nemotron-super-49b-v1.5",
        api_key=api_key,
        base_url=base_url,
        temperature=0.1,
        top_p=0.85,
        max_tokens=4096,
    )

    dataset_path = (
        Path(__file__).parent.parent / "src/cognitive_code_agent/data/eval_judge_test.json"
    )
    samples = json.loads(dataset_path.read_text())

    items = [
        EvalInputItem(
            id=s["id"],
            input_obj=s["question"],
            expected_output_obj=s["answer"],
            output_obj=s["generated_answer"],
            full_dataset_entry=s,
        )
        for s in samples
    ]
    eval_input = EvalInput(eval_input_items=items)

    evaluator = AgentJudgeEvaluator(llm=llm, max_concurrency=2)

    print(f"\nRunning AgentJudgeEvaluator on {len(items)} samples...\n")
    output = await evaluator.evaluate(eval_input)

    print(f"Average weighted score: {output.average_score:.3f}")
    print("Pass threshold: 3.5\n")
    print("=" * 60)

    for item in output.eval_output_items:
        r = item.reasoning
        if "error" in r:
            print(f"[{item.id}] ERROR: {r['error']}")
            continue

        scores = r.get("scores", {})
        passed = r.get("pass", False)
        failures = r.get("critical_failures", [])
        rationale = r.get("rationale", "")

        status = "PASS" if passed else "FAIL"
        print(f"[{item.id}] {status} — weighted: {item.score:.3f}")
        print(f"  Scores: {json.dumps(scores)}")
        if failures:
            print(f"  Critical failures: {failures}")
        print(f"  Rationale: {rationale}")
        print()


if __name__ == "__main__":
    asyncio.run(main())
