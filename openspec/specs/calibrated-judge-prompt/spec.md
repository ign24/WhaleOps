## ADDED Requirements

### Requirement: Rubrics with full 1-5 anchors per dimension
The judge system prompt SHALL define behavioral anchors for all five scale points (1, 2, 3, 4, 5) for each scoring dimension. Anchors MUST be specific and behavioral, not labels (e.g., "5 = every claim cites a specific tool result with file path and line; 2 = most claims grounded but 1-2 unsubstantiated assertions present").

#### Scenario: Judge assigns score 2 on tool_grounding
- **WHEN** an agent response has mostly grounded claims but 1-2 unsubstantiated assertions
- **THEN** the judge assigns score 2 on `tool_grounding`, not 1 or 3, because the anchor for 2 matches this pattern

#### Scenario: Judge assigns score 4 on goal_fulfillment
- **WHEN** an agent response answers the main ask fully but omits one minor sub-task
- **THEN** the judge assigns score 4 on `goal_fulfillment`, not 3 or 5

### Requirement: Chain-of-thought reasoning before score
The judge system prompt SHALL instruct the judge to emit a `dimension_reasoning` object with one reasoning string per dimension before emitting the `scores` object. The JSON output format SHALL be:

```json
{
  "dimension_reasoning": {
    "goal_fulfillment": "<analysis>",
    "tool_grounding": "<analysis>",
    "output_structure": "<analysis>",
    "mode_skill_appropriateness": "<analysis>",
    "safety_compliance": "<analysis>",
    "conciseness": "<analysis>"
  },
  "scores": { ... },
  "weighted_score": 0.0,
  "pass": false,
  "critical_failures": [],
  "rationale": "<summary>"
}
```

#### Scenario: Judge emits reasoning before scores
- **WHEN** the judge LLM is invoked
- **THEN** the parsed output contains a non-empty `dimension_reasoning` key with one entry per dimension before the `scores` key

#### Scenario: Missing dimension_reasoning is tolerated
- **WHEN** the judge LLM returns valid JSON without `dimension_reasoning` (fallback case)
- **THEN** `_parse_judge_output()` still extracts `scores`, `pass`, and `rationale` without raising an exception

### Requirement: Adaptive weights by agent mode
`AgentJudgeEvaluator` SHALL accept an optional `mode` parameter (`"analyze"`, `"refactor"`, `"execute"`) and select dimension weights from a static map. When `mode` is not provided, the `analyze` weights SHALL be used as default.

Weight maps:
- `analyze`: goal_fulfillment=0.30, tool_grounding=0.30, output_structure=0.15, mode_skill=0.10, safety=0.10, conciseness=0.05
- `refactor`: goal_fulfillment=0.25, tool_grounding=0.35, output_structure=0.15, mode_skill=0.10, safety=0.10, conciseness=0.05
- `execute`: goal_fulfillment=0.25, tool_grounding=0.20, output_structure=0.10, mode_skill=0.10, safety=0.30, conciseness=0.05

#### Scenario: Refactor mode increases tool_grounding weight
- **WHEN** the evaluator is called with `mode="refactor"`
- **THEN** `tool_grounding` weight is 0.35 and the weighted score reflects this

#### Scenario: Unknown mode falls back to analyze weights
- **WHEN** the evaluator is called with an unrecognized mode string
- **THEN** it uses `analyze` weights and does not raise an exception

#### Scenario: Weighted score recomputed locally
- **WHEN** the judge LLM returns a `weighted_score` that does not match the local recomputation
- **THEN** the local recomputed value is used in the output, discarding the LLM's arithmetic

### Requirement: Few-shot examples in system prompt for key dimensions
The judge system prompt SHALL include at least two calibration examples for `goal_fulfillment` and `tool_grounding`: one high-quality example (score 5) and one hard negative (score 2 — a response that appears good but fails a specific criterion). Examples SHALL be embedded in the system prompt, not the user message.

#### Scenario: Hard negative prevents over-scoring confident-sounding responses
- **WHEN** an agent response uses confident language ("I found 3 vulnerabilities") without tool output evidence
- **THEN** the judge scores `tool_grounding` <= 2, consistent with the hard negative example

#### Scenario: Examples do not leak into evaluated context
- **WHEN** the judge evaluates a user-provided response
- **THEN** the few-shot examples appear only in the system prompt and are not repeated in the user message
