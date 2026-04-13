## Context

The agent runs on NVIDIA NAT 1.4.1 + LangGraph 1.0.10. Remote functions can become DEGRADED at the platform level mid-session. When this happens today:

1. `clone_repository` succeeds but the directory now exists, blocking retries
2. Streaming path detects DEGRADED via [400] and records the function ID
3. ainvoke fallback is **hard-skipped** because the function ID is in the blacklist
4. Agent returns zero useful output

The `spawn_agent.py` tool already has a working `_run_graph_direct()` fallback for DEGRADED, but the main entry point in `safe_tool_calling_agent.py` does not execute the declared `direct_execution_fallback` policy action — it just skips ainvoke entirely.

## Goals / Non-Goals

**Goals:**
- G1: Make `clone_repository` idempotent — reuse valid existing clones
- G2: Attempt ainvoke once after stream DEGRADED before giving up (guarded probe)
- G3: Ensure partial work (e.g., successful clone) survives across recovery attempts
- G4: All changes covered by tests (TDD)

**Non-Goals:**
- NG1: Implementing full in-process fallback at the main agent level (that requires running a local LLM, out of scope)
- NG2: Auto-retry DEGRADED functions with backoff (platform-level condition, not transient)
- NG3: Changing the FailureClass enum or adding new failure classes
- NG4: Modifying spawn_agent.py (its fallback already works correctly)

## Decisions

### D1: Idempotent clone via git remote validation

**Choice:** When destination exists, run `git remote get-url origin` to check if it matches the requested repo. If match → return `"status": "ok", "message": "Repository already cloned"` with `"clone_type": "existing"`. If mismatch → return error with `"retryable": False` and explain the conflict.

**Alternative rejected:** Delete and re-clone. Too destructive — the existing clone may contain agent work-in-progress.

**Alternative rejected:** Always append a numeric suffix. Creates orphan directories and confuses the agent about which path to use.

### D2: Guarded ainvoke probe on DEGRADED

**Choice:** Replace the hard skip at lines 2256-2278 with a single ainvoke attempt wrapped in a try/except. If ainvoke succeeds (function recovered), use the result. If ainvoke fails with DEGRADED again, fall through to the existing `_format_structured_partial_response()` path.

**Rationale:** The DEGRADED state is platform-level, but between stream failure and ainvoke attempt there's a time gap (could be seconds). A single probe is cheap (one HTTP round-trip) and preserves the "don't retry blindly" principle.

**Alternative rejected:** Multiple retries with backoff. DEGRADED is not transient — one probe is sufficient to check recovery.

### D3: Idempotent clone returns `retryable=False` on match

**Choice:** When clone detects an existing valid repo, it returns `"status": "ok"` (not error). The `retryable` field is irrelevant because it's a success. This means the LLM sees a successful clone and proceeds normally.

**Rationale:** From the agent's perspective, "the repo is available at this path" is what matters, not whether we just cloned it or it was already there.

### D4: Git remote check is synchronous subprocess

**Choice:** Use `subprocess.run(["git", "-C", dest, "remote", "get-url", "origin"])` to validate the existing clone. Timeout at 5 seconds (local operation, should be instant).

**Alternative rejected:** Check for `.git/` directory existence only. Not sufficient — the directory could be a broken or different repo.

## Risks / Trade-offs

- **[Risk]** Existing directory is a partial/corrupted clone → `git remote get-url` may fail.
  **Mitigation:** If the git command fails (non-zero exit), treat as conflict and return error with message suggesting a different `dest_name`.

- **[Risk]** ainvoke probe adds latency on the failure path (~2-5s for one HTTP round-trip).
  **Mitigation:** Acceptable trade-off. The alternative is zero output. One probe attempt is bounded.

- **[Risk]** ainvoke probe succeeds but produces low-quality output (DEGRADED function may be partially functional).
  **Mitigation:** The existing evidence gate and structured response contract still apply to ainvoke output. No special handling needed.

- **[Risk]** Race condition: clone dir created by another concurrent request between exists-check and git-clone.
  **Mitigation:** The git clone command itself will fail with a clear error if the directory appears between check and clone. This is already handled by the `returncode != 0` path.
