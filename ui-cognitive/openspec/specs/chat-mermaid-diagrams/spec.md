# chat-mermaid-diagrams Specification

## Purpose
TBD - created by archiving change chat-mermaid-rendering. Update Purpose after archive.
## Requirements
### Requirement: Mermaid fenced blocks render as diagrams in chat messages
The chat markdown renderer SHALL detect fenced code blocks with language `mermaid` and render them as Mermaid diagrams instead of plain code.

#### Scenario: Valid mermaid block renders diagram
- **WHEN** a message contains a fenced block with language `mermaid` and valid diagram syntax
- **THEN** the UI SHALL render an SVG diagram in the message body

#### Scenario: Non-mermaid code blocks keep current behavior
- **WHEN** a message contains fenced blocks with any language different from `mermaid`
- **THEN** the UI SHALL keep rendering those blocks with the existing `CodeBlock` renderer

### Requirement: Mermaid rendering failures degrade gracefully
The UI MUST NOT break message rendering when Mermaid parsing or initialization fails.

#### Scenario: Invalid mermaid definition falls back to code
- **WHEN** a fenced `mermaid` block contains invalid syntax
- **THEN** the UI SHALL render the original content as a code block fallback

#### Scenario: Mermaid runtime load failure falls back safely
- **WHEN** Mermaid library cannot be loaded at runtime
- **THEN** the UI SHALL render the original `mermaid` source as plain code without throwing to the user

### Requirement: Mermaid rendering remains isolated from markdown safety behavior
Adding Mermaid support SHALL preserve current markdown rendering behavior for HTML sanitization, links, math, and rich text blocks.

#### Scenario: Existing markdown features remain unchanged
- **WHEN** messages contain links, task lists, KaTeX, HTML snippets, and regular code blocks
- **THEN** the rendered output SHALL match current behavior outside Mermaid blocks

