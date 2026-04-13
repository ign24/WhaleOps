## 1. SpawnAgentTool — Core Implementation

- [x] 1.1 Create `src/cognitive_code_agent/tools/spawn_agent.py` with `SpawnAgentTool` class: holds `tool_registry` (dict[str, LangChain tool]), `llm_factory`, `skill_registry_path`, `memory_config`, `allowed_tools` (mode allowlist), `default_max_iterations`
- [x] 1.2 Implement `SpawnAgentTool.__call__(task, tools, max_iterations)` — filters tools against allowlist, builds `SafeToolCallAgentGraph` with filtered tools + skill registry + compaction, runs it with task as HumanMessage, returns final string response
- [x] 1.3 Add spawned agent base system prompt (inline string in spawn_agent.py): "You are a code expert. Before starting domain work, load the skills you need from the registry. You have access to the full skill registry."
- [x] 1.4 Wire compaction into spawned agents: pass `summary_llm` and a `WorkingMemoryConfig` with tighter thresholds (char=20000, messages=15, retain_recent=5, cooldown=5)
- [x] 1.5 Emit `subagent_spawned` trace event after each successful run: task[:200], tools, max_iterations, response_len, compaction_fired

## 2. SpawnAgentTool — Config & Allowlist

- [x] 2.1 Add `spawn_agent_allowed_tools` list to each mode in `config.yml` (analyze: all read/scan/lint tools; refactor: read+write+code tools; never includes spawn_agent itself)
- [x] 2.2 Add `spawn_agent` entry to `function_groups` in config.yml with `_type: spawn_agent`, `default_max_iterations: 20`, `max_active_skills: 3`
- [x] 2.3 Implement `SpawnAgentToolConfig` dataclass and builder registration so NAT recognizes `_type: spawn_agent` and instantiates `SpawnAgentTool` at startup

## 3. Remove reader_agent

- [x] 3.1 Remove `reader_agent` from `function_groups` in `config.yml`
- [x] 3.2 Remove `reader_agent` from `tool_names` in analyze mode, refactor mode, and any subagent definitions (security_agent, qa_agent) that include it
- [x] 3.3 Remove `max_tool_calls_per_request.reader_agent` and `subagent_recovery_escalation_budget.reader_agent` from all mode configs
- [x] 3.4 Revert the partial prompt changes to `analyze.md` and `refactor.md` from the previous session (they were prompt-only patches; clean slate for architecture-based fix)

## 4. Remove Fixed Domain Subagents

- [x] 4.1 Remove `security_agent`, `qa_agent`, `review_agent`, `docs_agent` from `function_groups` in `config.yml`
- [x] 4.2 Remove those agents from `tool_names` in analyze mode
- [x] 4.3 Remove their `subagent_recovery_escalation_budget` entries from analyze mode
- [x] 4.4 Keep the 4 domain prompt files (`security_agent.md`, `qa_agent.md`, `review_agent.md`, `docs_agent.md`) — they can be reused as skills or reference material

## 5. Add Direct fs_tools to Analyze Mode

- [x] 5.1 Add `fs_tools` to `tool_names` in analyze mode in `config.yml`
- [x] 5.2 Add `github_tools` to `tool_names` in analyze mode (was only in reader_agent before)

## 6. Update Orchestrator Prompts

- [x] 6.1 Rewrite `<delegation_strategy>` in `analyze.md`: describe `spawn_agent` with tools and task parameters; include concrete examples (security scan, QA analysis, docs audit); show parallel spawn pattern
- [x] 6.2 Rewrite `<directory_tree_policy>` in `analyze.md`: orchestrator calls `fs_tools__directory_tree` directly with excludePatterns
- [x] 6.3 Update `refactor.md`: remove all reader_agent references; `fs_tools_write` covers all file reads directly
- [x] 6.4 Add `<spawn_agent_policy>` section to `analyze.md`: when to spawn (isolated heavy work, parallel domain tasks), what tools to pass for common domains (security: semgrep+trivy+gitleaks+bandit; qa: pytest+coverage; docs: check_readme+docstrings)

## 7. Tests

- [x] 7.1 Unit test `SpawnAgentTool` tool filtering: tool not in allowlist is excluded from spawned agent
- [x] 7.2 Unit test `SpawnAgentTool` anti-recursion: spawn_agent itself never appears in spawned agent tools
- [x] 7.3 Unit test `SpawnAgentTool` parallel: two concurrent calls each return independent responses
- [x] 7.4 Unit test trace event: `subagent_spawned` event emitted with correct fields
- [x] 7.5 Integration test: spawn a code-expert agent with `fs_tools` + task "list directory /tmp", verify it returns directory listing without recursion errors
- [x] 7.6 Integration test: spawn two agents in parallel with different tool sets, verify both complete and return independent results
