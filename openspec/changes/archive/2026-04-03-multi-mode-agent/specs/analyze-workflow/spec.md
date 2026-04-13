## analyze-workflow

### Purpose
Deep repository analysis workflow backed by DeepSeek V3.2.

### LLM
`deepseek_coder` (deepseek-ai/deepseek-v3.2, temperature 0.3, max_tokens 16384)

### System Prompt
`src/cognitive_code_agent/prompts/system/analyze.md`

Contains:
- Shared identity, priority policy, memory policy sections.
- Full `<full_analysis_protocol>` with phased execution (existing).
- Read-only policy: never write files, never modify repositories.
- Output contract oriented toward diagnostics and findings.

### Tool Set
All read/scan/audit tools. No write tools. No code generation tools.

See design.md tool isolation table for full list.

### Behavior
- Default mode when no prefix is given.
- Activates skills: security-review, code-reviewer, senior-qa, technical-writer, debugger.
- max_iterations: 40 (full multi-phase protocol needs ~25-35 iterations).
- Findings produced with `persist_findings` can be consumed by refactor and execute modes via `query_findings`.

### Constraints
- Must not include `fs_tools_write`, `code_gen`, `refactor_gen`, or `shell_execute` in tool set.
- If user attempts to write code in analyze mode, the prompt should guide them to use `/refactor`.
