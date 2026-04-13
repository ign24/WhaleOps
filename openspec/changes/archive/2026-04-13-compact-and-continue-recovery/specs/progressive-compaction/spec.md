## ADDED Requirements

### Requirement: Recovery compaction SHALL use progressively aggressive retain_recent
Each recovery round SHALL reduce the `compaction_retain_recent` parameter to compress more aggressively. Round 1 SHALL use retain_recent=4, round 2 SHALL use retain_recent=2, round 3+ SHALL use retain_recent=1.

#### Scenario: First recovery round uses moderate compaction
- **WHEN** recovery round 1 triggers compaction
- **THEN** `compress_state` SHALL be called with `compaction_retain_recent=4`

#### Scenario: Second recovery round uses aggressive compaction
- **WHEN** recovery round 2 triggers compaction
- **THEN** `compress_state` SHALL be called with `compaction_retain_recent=2`

#### Scenario: Third and subsequent rounds use maximum compaction
- **WHEN** recovery round 3 or higher triggers compaction
- **THEN** `compress_state` SHALL be called with `compaction_retain_recent=1`
- **AND** the resulting state SHALL contain at most the anchor message, one summary message, error messages, and 1 recent message

### Requirement: Recovery compaction SHALL reuse compress_state infrastructure
The recovery loop SHALL call the existing `compress_state()` function from `memory/working.py` with a temporary config override. It SHALL NOT implement separate compaction logic.

#### Scenario: Compaction uses existing compress_state
- **WHEN** the recovery loop needs to compact state
- **THEN** it SHALL call `compress_state(state.messages, llm, config_override)` where `config_override` has the round-appropriate `compaction_retain_recent`

#### Scenario: Compaction failure does not block recovery
- **WHEN** `compress_state` fails (LLM timeout, summarization error)
- **THEN** `compress_state` SHALL return the original messages (existing behavior)
- **AND** the recovery round SHALL proceed with uncompacted state
- **AND** if the next execution also fails, it SHALL count as a no-progress round

### Requirement: Recovery compaction SHALL bypass cooldown and thresholds
The recovery-loop compaction SHALL NOT be subject to the mid-loop compaction cooldown or message/char thresholds. When the recovery loop calls compaction, it SHALL always execute regardless of how recently compaction last ran.

#### Scenario: Compaction runs even if cooldown is not met
- **WHEN** the recovery loop triggers compaction
- **AND** fewer than `compaction_cooldown_messages` have passed since the last mid-loop compaction
- **THEN** compaction SHALL execute anyway
