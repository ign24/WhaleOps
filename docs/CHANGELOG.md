# Changelog

All notable changes to this project should be documented in this file.

## [2.0.0] - 2026-04-09

### Added

- MCP server bridge support in backend and UI integration routes/components.
- Cron-based daily markdown report generation tools.
- Additional unit/integration tests for MCP server and reporting workflows.
- Expanded OpenSpec archive/spec publication set tied to delivered changes.
- New prompt config surface (`prompt_config.yml`) and prompt composition updates.
- New memory/readiness modules and findings-store plumbing for v2 flows.
- New UI-cognitive surfaces for model selection, workspace panel, and MCP servers.
- Dynamic model-registry based LLM selection across available NIM runtime models.

### Changed

- Consolidated runtime operation around `analyze`, `execute`, and `chat`.
- `/refactor` handled as compatibility alias to execute mode.
- Prompt composition and system prompts updated across agent/specialist layers.
- Updated deployment/runtime docs and compose setup for optional MCP service.
- Significant UI-cognitive refactor (chat layout, activity feed, stream behavior,
  session metadata and workspace presentation).

### Fixed

- Improved resilience in execution and fallback behavior for agent loops.
- UI-cognitive activity stream/timeline and model selector consistency fixes.
- Startup/report generation compatibility issues around tool registration paths.

### Documentation

- Added `docs/WHATS_NEW_v2.md` and linked release notes in `README.md`.
- Updated architecture and operational guides to match shipped behavior.

### Commit coverage

Release content is primarily introduced by:

- PR #7 merge commit: `62755a1`
- Core implementation commit: `9ec1f25`
- Additional release docs commits: `596d2c3`, `78ab5bb`

### Evidence references

- Full release narrative: `docs/WHATS_NEW_v2.md`
- Specs evidence: `openspec/specs/`
- Archived implementation records: `openspec/changes/archive/`
