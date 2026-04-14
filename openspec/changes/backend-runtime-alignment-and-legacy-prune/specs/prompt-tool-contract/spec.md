## ADDED Requirements

### Requirement: Mode prompts MUST only reference available tools
For each mode, the system SHALL ensure prompt guidance references only tools listed in that mode's effective `tool_names` set.

#### Scenario: Prompt-tool mismatch is rejected in validation
- **WHEN** a mode prompt references a tool not present in that mode's effective tool set
- **THEN** validation reports a contract violation with mode and tool identifier

### Requirement: Prompt-tool contract MUST be tested in CI
The system SHALL include contract tests that parse mode prompts and compare referenced tool names against effective runtime tool sets for each mode.

#### Scenario: CI catches stale prompt reference
- **WHEN** a prompt keeps a stale tool name after config/runtime changes
- **THEN** contract tests fail with a message indicating the stale reference and affected mode

### Requirement: Mode capability descriptions MUST remain backward compatible
The system SHALL preserve user-facing capability semantics while aligning prompt text, so existing chat and ops flows continue to return valid operational guidance.

#### Scenario: Capability request still returns valid guidance
- **WHEN** a user asks what the agent can do in a mode after alignment
- **THEN** the response describes only currently available tools and does not claim unavailable actions
