## MODIFIED Requirements

### Requirement: WorkingMemoryConfig supports summary LLM and increased token budget
`WorkingMemoryConfig` SHALL include two new optional fields: `summary_llm_name: str | None` (default: `None`) and updated `summary_max_tokens` default of `400` (previously `200`). These fields SHALL be read from `memory.yml` under the `working:` key and applied to both between-request and mid-loop compaction operations.

#### Scenario: New fields are read from memory.yml
- **WHEN** `memory.yml` sets `working.summary_llm_name: kimi_reader` and `working.summary_max_tokens: 400`
- **THEN** `WorkingMemoryConfig.summary_llm_name` equals `"kimi_reader"` and `summary_max_tokens` equals `400`

#### Scenario: Default values are backward compatible
- **WHEN** `memory.yml` does not include `summary_llm_name`
- **THEN** `WorkingMemoryConfig.summary_llm_name` is `None` and existing summarization behavior is unchanged

#### Scenario: summary_max_tokens of 400 produces richer summaries
- **WHEN** between-request compaction runs with `summary_max_tokens: 400`
- **THEN** the summary prompt instructs the LLM to use at most 400 tokens, allowing more complete capture of findings than the previous 200-token limit

## ADDED Requirements

### Requirement: mid-loop compaction config fields in WorkingMemoryConfig
`WorkingMemoryConfig` SHALL include: `compaction_char_threshold: int` (default: 40000), `compaction_message_threshold: int` (default: 30), `compaction_retain_recent: int` (default: 8), and `compaction_cooldown_messages: int` (default: 10). All fields SHALL be readable from `memory.yml` under the `working:` key.

#### Scenario: Thresholds configurable without code changes
- **WHEN** `memory.yml` sets `working.compaction_char_threshold: 60000`
- **THEN** mid-loop compaction triggers at 60,000 chars, not 40,000

#### Scenario: Defaults apply when fields are absent
- **WHEN** `memory.yml` does not include compaction fields
- **THEN** `WorkingMemoryConfig` uses the default values and compaction operates normally
