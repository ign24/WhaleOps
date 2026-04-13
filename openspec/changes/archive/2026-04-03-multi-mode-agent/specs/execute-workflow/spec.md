## execute-workflow

### Purpose
Lightweight operations workflow backed by Kimi K2 for git ops, reporting, and synthesis.

### LLM
`kimi_reader` (moonshotai/kimi-k2-instruct-0905, temperature 0.3, max_tokens 4096)

### System Prompt
`src/cognitive_code_agent/prompts/system/execute.md`

Contains:
- Shared identity, priority policy sections.
- Git workflow conventions (conventional commits, branch naming).
- PR creation template.
- Report formatting guidelines.
- Instruction to be fast and concise — no deep analysis.

### Tool Set
Minimal: git/shell ops, file writing for reports, findings query for context.

- `shell_execute`: git add, commit, push, branch operations.
- `fs_tools_write`: write reports, manifests.
- `github_tools`: create PRs, comment on issues.
- `query_findings`: read analysis context for commit messages and PR descriptions.
- `tavily_search`: look up docs/references when creating PRs.

### Behavior
- Activated with `/execute` prefix.
- max_iterations: 15 (ops are quick, fail fast if something is wrong).
- tool_call_timeout: 120s (git operations should not take long).
- No skill activation needed — execute mode has its own focused prompt.
- Reads findings to write informed commit messages and PR descriptions.

### Output Examples
- Commit: conventional format, references findings.
- PR: title + summary with findings-based description.
- Report: markdown summary with P0/P1/P2 matrix.

### Constraints
- Must not include analysis or code generation tools.
- max_tokens 4096 is sufficient for ops — if a report is too long, split into sections.
- Should warn user if no findings exist (analysis not run yet).
