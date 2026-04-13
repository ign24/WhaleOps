## Context

The current refactor workflow uses `/tmp/analysis` as the default clone destination and temporary working area. This is useful for ephemeral analysis but does not satisfy workflows where a full refactored repository must persist across sessions and be available for handoff. The system already allows file writes in `/app/workspace`, but clone behavior is fixed to `/tmp/analysis`, creating friction and ad-hoc copy steps.

Constraints:
- Safety boundaries must remain deterministic and path-restricted.
- Existing `/tmp/analysis` flows must continue to work unchanged by default.
- Prompt and mode contracts should reflect workspace intent clearly.

## Goals / Non-Goals

**Goals:**
- Enable cloning repositories directly into persistent workspace storage (`/app/workspace`) without removing sandbox support.
- Preserve and centralize allowed-root validation semantics for clone and shell operations.
- Clarify operational guidance for when to use sandbox vs workspace in refactor/execute flows.
- Keep backward compatibility for existing automation that assumes `/tmp/analysis`.

**Non-Goals:**
- Introducing arbitrary host path access outside approved roots.
- Replacing safety tier logic for shell execution.
- Changing episodic findings storage architecture.

## Decisions

1. **Clone destination root becomes explicit and validated**
   - Add a clone parameter that selects destination root (`analysis` or `workspace`) and map it to `/tmp/analysis` or `/app/workspace`.
   - Keep default as `analysis` to avoid breaking existing behavior.
   - Rationale: supports persistent workflows while preserving current default.
   - Alternative considered: infer root from destination prefix in `dest_name`. Rejected due to ambiguous UX and higher traversal-risk surface.

2. **Single allowed-roots policy reused across tools**
   - Reuse the same root validation approach already used by `ensure_repo_path` so clone, shell, and filesystem edits align on boundary checks.
   - Rationale: avoid drift between tools and reduce inconsistent security behavior.
   - Alternative considered: per-tool hardcoded root logic. Rejected because duplication would increase maintenance and risk.

3. **Workspace semantics documented as working-memory persistence**
   - Define `/tmp/analysis` as ephemeral sandbox working area and `/app/workspace` as persistent working memory.
   - Clarify that findings persistence remains episodic memory and is complementary, not a replacement for file persistence.
   - Rationale: reduce operator confusion about memory layers and expected retention.

4. **Prompt updates for mode-specific behavior**
   - Update refactor and execute mode guidance to prefer `/app/workspace` when retention is required.
   - Rationale: align agent behavior with new capability and reduce accidental ephemeral outputs.

## Risks / Trade-offs

- **[Risk] Workspace may accumulate stale repositories and large artifacts** → **Mitigation:** document cleanup expectations and add optional housekeeping follow-up task.
- **[Risk] Users may select workspace for sensitive repos without lifecycle controls** → **Mitigation:** keep strict allowed roots, redact secrets in tool outputs, and document retention responsibility.
- **[Trade-off] Maintaining dual roots increases configuration complexity** → **Mitigation:** retain clear defaults (`analysis`) and explicit selection (`workspace`) only when needed.

## Migration Plan

1. Implement clone destination-root parameter with strict validation and backward-compatible defaults.
2. Update system prompts and operational documentation for root usage policy.
3. Validate existing tests and add coverage for clone destination selection and path constraints.
4. Rollback path: remove/disable destination-root parameter and revert clone behavior to fixed `/tmp/analysis` if regressions appear.

## Open Questions

- Should workspace clones include an optional TTL/cleanup metadata file for automated pruning?
- Should execute mode default to workspace for certain commands (report generation, packaging), or remain explicit-only?
