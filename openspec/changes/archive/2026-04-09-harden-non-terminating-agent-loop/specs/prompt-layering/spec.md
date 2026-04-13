## ADDED Requirements

### Requirement: Complex-task decomposition guidance SHALL exist in analyze orchestration prompting
Analyze-mode orchestration guidance SHALL instruct the model to decompose broad multi-domain requests into smaller focused subtasks before execution.

The guidance SHALL clarify that decomposition is flexible but execution remains bounded by deterministic runtime budgets.

#### Scenario: Broad request triggers decomposition plan
- **WHEN** the user requests a repository-wide multi-domain analysis in a single prompt
- **THEN** the orchestration guidance SHALL instruct the model to produce a phased subtask plan before deep execution

#### Scenario: Decomposition guidance acknowledges runtime limits
- **WHEN** decomposition guidance is applied
- **THEN** it SHALL state that deterministic budgets (including spawn and tool limits) remain authoritative
- **AND** it SHALL direct consolidation when budgets are exhausted
