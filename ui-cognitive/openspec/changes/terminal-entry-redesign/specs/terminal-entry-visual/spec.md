## ADDED Requirements

### Requirement: Terminal entry renders as a single unified card
A timeline entry of category `terminal` SHALL render its command and output within a single card boundary — no nested card with its own border inside the outer entry border.

#### Scenario: No double border on terminal entry
- **WHEN** a terminal entry is rendered expanded
- **THEN** the output area SHALL NOT have its own outer border wrapping the content

#### Scenario: Non-terminal entries keep existing ToolCallCard rendering
- **WHEN** an entry is of any category other than `terminal`
- **THEN** the existing `ToolCallCard` rendering SHALL be used unchanged

### Requirement: Terminal command is always visible in primary color
The command string for a terminal entry SHALL be visible at all times (collapsed and expanded) using the primary accent color.

#### Scenario: Command visible when collapsed
- **WHEN** a terminal entry is collapsed
- **THEN** the command string SHALL be rendered with `text-[var(--primary)]` and a `$` prefix

#### Scenario: Command visible when expanded
- **WHEN** a terminal entry is expanded
- **THEN** the command string SHALL remain visible in the header

### Requirement: Exit code badge is inline in the terminal entry header
The return code status SHALL be shown as a compact badge in the entry header row — not inside an expandable section.

#### Scenario: Exit 0 shows success badge
- **WHEN** `returnCodeSummary` contains `rc=0`
- **THEN** a badge with success color (green) SHALL appear in the header

#### Scenario: Non-zero exit shows error badge
- **WHEN** `returnCodeSummary` indicates a non-zero exit code
- **THEN** a badge with error color (red) SHALL appear in the header

#### Scenario: No badge when no return code
- **WHEN** `returnCodeSummary` is absent
- **THEN** no exit badge SHALL be rendered in the header

### Requirement: Terminal output is expandable inline without a nested card
When a terminal entry has output, clicking the entry SHALL reveal the output directly within the same card — no additional bordered wrapper around the output block.

#### Scenario: Output revealed on expand
- **WHEN** user clicks a terminal entry that has `toolResult`
- **THEN** the output SHALL appear below the command line within the same card

#### Scenario: Output uses pre-formatted block with scroll
- **WHEN** terminal output is displayed
- **THEN** the output SHALL render in a `<pre>` element with `overflow-y-auto` and a max height, preserving whitespace

#### Scenario: JSON result content is unwrapped
- **WHEN** `toolResult` is a JSON string with a `content` field
- **THEN** the `content` value SHALL be displayed, not the raw JSON string

#### Scenario: No output means no expandable state
- **WHEN** a terminal entry has no `toolResult`
- **THEN** the entry SHALL NOT be expandable (no chevron, no click handler)
