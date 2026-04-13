## refactor-workflow

### Purpose
Code modification workflow backed by Devstral 2 123B, specialized for writing and transforming code.

### LLM
`devstral` (mistralai/devstral-2-123b-instruct-2512, temperature 0.3, max_tokens 32768)

### System Prompt
`src/cognitive_code_agent/prompts/system/refactor.md`

Contains:
- Shared identity, priority policy, memory policy sections.
- Code writing policy (existing `<code_writing_policy>`).
- Refactoring skill guidance inlined by default (no need for skill activation trigger).
- Instruction to query_findings first to load the analysis context before making changes.
- Validation-after-write policy: after modifying files, run appropriate linter/test.

### Tool Set
Code generation + file writing + validation tools. No security scanners. No clone.

See design.md tool isolation table for full list.

### Behavior
- Activated with `/refactor` prefix.
- Activates skills: refactoring (always), code-reviewer (if triggered).
- max_iterations: 40 (large refactoring can require many file operations).
- Reads findings from analyze phase via `query_findings` to understand what to fix.
- Uses `refactor_gen` for full-file rewrites, `code_gen` for snippets.
- Writes files with `write_file` / `edit_file`, validates with linters and test runners.

### Constraints
- Must not include security scanners (semgrep, trivy, gitleaks, bandit).
- Must not include `clone_repository` (repos should already be cloned by analyze mode).
- Should always validate written code before finishing.
