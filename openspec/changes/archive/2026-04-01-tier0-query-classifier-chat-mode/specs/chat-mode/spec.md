## ADDED Requirements

### Requirement: Chat mode is declared in config and compiled at startup
The system SHALL include a `chat` mode in `config.yml` under `workflow.modes`, compiled into a `_ModeRuntime` at startup alongside existing modes.

#### Scenario: Chat mode compiles successfully at startup
- **WHEN** the agent server starts
- **THEN** `chat` mode is present in `mode_runtimes`
- **AND** it uses `kimi_reader` as the LLM
- **AND** it includes at most 3 tools: `query_findings`, `fs_tools` (read-only), and optionally `tavily_search`

#### Scenario: Chat mode compilation failure does not block other modes
- **WHEN** chat mode fails to compile (e.g., kimi_reader endpoint unavailable)
- **THEN** the failure is logged at WARNING level
- **AND** existing modes (analyze, refactor, execute) start normally

### Requirement: Chat mode uses a minimal system prompt
The `chat` mode SHALL use a dedicated system prompt at `src/cognitive_code_agent/prompts/system/chat.md` that contains only identity, language policy, and conversational behavior. It SHALL NOT include tool documentation, analysis protocols, or skill injection.

#### Scenario: Chat response does not include analysis preamble
- **WHEN** the agent responds in chat mode
- **THEN** the response does not start with analysis protocol language or tool usage documentation

#### Scenario: Chat mode responds in user's language
- **WHEN** the user writes in Spanish
- **THEN** the chat mode response is in Spanish

### Requirement: Chat mode has a constrained execution budget
Chat mode SHALL use `max_iterations: 3` and `max_history: 4` to prevent runaway tool use on conversational queries.

#### Scenario: Chat mode does not enter deep tool-calling loops
- **WHEN** the user sends a greeting
- **THEN** the agent responds in at most 1 LLM call without invoking tools

#### Scenario: Chat history is bounded
- **WHEN** the conversation has more than 4 non-system messages
- **THEN** only the 4 most recent messages are retained in context for chat mode

### Requirement: Skill injection is suppressed in chat mode
The `build_active_skills_block()` function SHALL not inject any skill modules when the resolved mode is `chat`.

#### Scenario: No skills are activated for chat queries
- **WHEN** the resolved mode is `chat`
- **THEN** `active_skills_block` is empty regardless of trigger keywords in the message
