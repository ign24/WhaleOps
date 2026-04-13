## ADDED Requirements

### Requirement: Agent decides execution strategy based on task complexity
The system prompts SHALL NOT prescribe a fixed execution order (e.g., "always do step 1 then step 2"). Instead, prompts SHALL describe what the agent can do and let it choose the approach based on the task.

#### Scenario: Simple question gets direct answer
- **WHEN** a user asks "what language is this repo?"
- **THEN** the agent reads one or two files and answers directly, without running a multi-phase protocol

#### Scenario: Complex analysis gets parallel execution
- **WHEN** a user requests a full security + QA + docs audit
- **THEN** the agent MAY spawn multiple sub-agents in parallel because the prompt does not force sequential execution

#### Scenario: Agent adapts depth to query complexity
- **WHEN** a user asks for a "quick review" vs a "deep analysis"
- **THEN** the agent adjusts how many tools it uses and how deep it goes, based on its own judgment

### Requirement: Prompts use anti-patterns instead of prescriptive steps
Mode prompts SHALL include a brief list of anti-patterns (things to avoid) rather than step-by-step workflows. Anti-patterns guide without constraining.

#### Scenario: Analyze mode lists what NOT to do
- **WHEN** the analyze mode prompt is loaded
- **THEN** it includes anti-patterns like "do not report assumptions as findings" and "do not spawn agents for simple file reads" rather than a mandatory execution sequence

#### Scenario: Execute mode lists validation expectations
- **WHEN** the execute mode prompt is loaded
- **THEN** it states "validate changes with the appropriate linter/test runner" as an expectation, not as a rigid step in a workflow

### Requirement: Parallel tool execution is allowed by default
The base prompt SHALL NOT contain instructions that prevent parallel tool calls. The agent SHALL be free to make independent tool calls in parallel when it determines the calls have no dependencies.

#### Scenario: Base prompt does not say "one tool at a time"
- **WHEN** `base.md` is loaded
- **THEN** it SHALL NOT contain phrases like "one clear tool action at a time" or "prefer sequential over parallel"

#### Scenario: Agent can batch independent spawns
- **WHEN** the agent determines that security scan and QA scan are independent
- **THEN** nothing in the prompt prevents it from issuing both spawn_agent calls in the same turn

### Requirement: Output guidelines replace rigid contracts
Mode prompts SHALL provide output guidelines (elements to include when relevant) instead of mandatory multi-section output contracts.

#### Scenario: Analyze output includes findings when they exist
- **WHEN** the agent completes an analysis that found issues
- **THEN** the output guidelines suggest including diagnosis, evidence, and prioritized recommendations — but the agent chooses the format

#### Scenario: Simple query does not require full report format
- **WHEN** the agent answers a direct question in analyze mode
- **THEN** the output guidelines do not force a 6-section report structure
