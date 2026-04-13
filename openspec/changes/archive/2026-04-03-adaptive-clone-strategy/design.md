## Context

`clone_repository` currently runs `git clone` with a hardcoded `MAX_TIMEOUT_SECONDS = 120` constant and no shallow clone option. All analysis sub-agents (security, qa, review, docs) require a local filesystem copy of the repo — there is no GitHub API path in analyze mode. The `reader_agent` system prompt tells it to "prefer targeted inspection" without defining what targeted means, so the LLM decides heuristically and may read 50-100 files on large repos.

Devstral 2-123B at temperature 0.3 follows prompt instructions deterministically. If the prompt gives it decision criteria, it applies them consistently. If it only gives it fixed rules, it follows them even when they produce poor outcomes. The goal is to move constraints from infrastructure (Python constants, hard limits) to the agent's reasoning layer (prompt criteria), while still exposing the necessary tool parameters to make those decisions actionable.

## Goals / Non-Goals

**Goals:**
- Let the agent choose `shallow=True` when git history is not required (security scan, docs, QA, architecture review)
- Let the agent set `timeout_seconds` proportional to repo size assessment
- Give the agent an actionable recovery path when a clone times out
- Give `reader_agent` explicit decision criteria for file selection so it stops reading when it has enough evidence
- Give the `analyze` orchestrator decision criteria for clone strategy before calling `clone_repository`

**Non-Goals:**
- Adding GitHub API / no-clone path to analyze mode (all sub-agent tools are filesystem-based — this is a separate future change)
- Dynamic parameter discovery (agent does not inspect repo size before cloning — it reasons from task type and repo name/description)
- Changing temperature or max_iterations

## Decisions

### D1: Expose `shallow` and `timeout_seconds` as tool parameters, not config.yml fields

**Decision:** Add optional `shallow: bool = False` and `timeout_seconds: int = 120` to `clone_repository`'s `_run` function signature. Keep `MAX_TIMEOUT_SECONDS = 120` as an upper bound cap (safety), but honor the agent's requested value if lower.

**Rationale:** Config.yml fields are static per mode — they can't vary per request. Tool parameters allow per-call decisions. The agent already provides other structured arguments (e.g. `dest_name`, `destination_root`); adding two more is consistent with the existing interface.

**Alternative considered:** Env var or config field `DEFAULT_SHALLOW=true`. Rejected — this is a global setting that doesn't adapt per task. The agent should decide, not the operator.

### D2: Shallow clone uses `--depth 1 --filter=blob:none --no-single-branch`

**Decision:** When `shallow=True`, run: `git clone --depth 1 --filter=blob:none <url> <dest>`

**Rationale:** `--depth 1` gives the latest commit only. `--filter=blob:none` defers blob download until files are actually accessed (blobless clone), which is the fastest option for analysis that only needs to read some files. Avoids downloading the full object store.

**Alternative considered:** `--depth 1` alone. Rejected — on large repos this still downloads all blobs at HEAD. Blobless is strictly faster for analysis use cases.

### D3: Timeout error response gains a `hint` field

**Decision:** Add `"hint": "consider shallow=true for large repos or increase timeout_seconds"` to the timeout error payload.

**Rationale:** At temperature 0.3, Devstral follows evidence from tool outputs. Explicit hints in structured responses are more reliable than relying on the model's prior knowledge about retry strategies. This closes the retry loop without prompt changes.

### D4: `analyze.md` gets a planning block, not routing rules

**Decision:** Add a `<planning_policy>` section before the delegation strategy with decision criteria for clone and sub-agent selection. Use principles, not exhaustive rules.

**Rationale:** Exhaustive rules become brittle as task types grow. Devstral 2-123B can generalize from 3-4 criteria. Hard routing rules (if/else on keywords) would require maintenance for every new task pattern and remove the model's ability to handle ambiguous cases.

**Content:**
- Assess task before acting: what tools will be needed? do they require git history?
- Use `shallow=True` unless git history is explicitly needed (blame, bisect, changelog)
- Set `timeout_seconds` based on repo size signal: unknown/large → 300, medium → 180, small → 120
- Only invoke sub-agents relevant to the request; a docs question does not need security scanning

### D5: `reader_agent` gets evidence-based stopping criteria

**Decision:** Replace "prefer targeted inspection" with criteria tied to task type and evidence state.

**Content:** Stop reading files when: (a) you can answer the question from what you've read, or (b) you've read the entry points + config + relevant domain files for the task type. Security → auth, config, entry points. Docs → README, public API surface. Architecture → main module, routes, models, top-level structure. Never read test fixtures, generated files, or vendored code unless specifically asked.

## Risks / Trade-offs

- **Blobless clone + tool that accesses many files** → git will lazily fetch blobs on demand, which could be slower than a full clone if the analysis reads hundreds of files. Mitigation: shallow+blobless is the default recommendation for analysis; full clone remains available via `shallow=False`.
- **Agent sets `timeout_seconds=300` on every call** → marginal risk, it's within `tool_call_timeout_seconds: 900`. Mitigation: document the upper bound in the tool description.
- **Prompt criteria too vague** → Devstral misapplies them. Mitigation: include concrete examples in the planning block (e.g., "security scan on django → shallow=True, timeout_seconds=300").

## Migration Plan

All parameter additions are backwards-compatible (optional with existing defaults). No migration needed. Existing callers that don't pass `shallow` or `timeout_seconds` get identical behavior to today.

Rollout: deploy tool change + prompt change together. No phased rollout needed.

## Open Questions

- Should `timeout_seconds` be capped at a hard maximum (e.g. 600s) to prevent runaway clones? Current leaning: yes, cap at `min(timeout_seconds, 600)`.
- Should we add `shallow` to the tool description string so it appears in the LLM's tool schema? Yes — the agent needs to know the parameter exists to use it.
