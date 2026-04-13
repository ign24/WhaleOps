## Why

The agent can refactor repositories under `/tmp/analysis`, but that location is ephemeral and not suitable for retaining full outputs across sessions. We need a first-class persistent workspace so end-to-end refactors can be stored, resumed, and handed off without manual copying.

## What Changes

- Add configurable destination roots for repository clone operations so repositories can be cloned directly into persistent workspace storage.
- Define a workspace policy that distinguishes ephemeral sandbox (`/tmp/analysis`) from persistent workspace (`/app/workspace`) while preserving current safety constraints.
- Ensure refactor/execute flows can complete a full lifecycle in workspace (clone/fetch, edit, validate, artifact generation).
- Document memory semantics: filesystem workspace as working memory, findings store as episodic memory.

## Capabilities

### New Capabilities
- `persistent-refactor-workspace`: Support persistent repository workspaces for full refactor workflows, including clone destination selection and retention policy.

### Modified Capabilities
- None.

## Impact

- Affected code: `src/cognitive_code_agent/tools/clone_tools.py`, `src/cognitive_code_agent/configs/config.yml`, relevant prompts in `src/cognitive_code_agent/prompts/system/` and optional safety/path validation helpers.
- Behavior impact: refactor and execute modes gain a persistent workflow option without removing sandbox support.
- Documentation impact: architecture and operational docs should clarify workspace vs sandbox semantics and recommended usage.
