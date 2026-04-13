### Requirement: Render raw HTML embedded in markdown
The system SHALL parse and render raw HTML elements present in markdown message content, producing visible DOM output instead of escaped text.

#### Scenario: Inline HTML tag renders as HTML
- **WHEN** a message contains `<strong>bold</strong>` within markdown text
- **THEN** the word "bold" SHALL be rendered in bold, not as the literal string `<strong>bold</strong>`

#### Scenario: Block HTML renders as HTML
- **WHEN** a message contains a `<div>` or `<table>` HTML block inside markdown
- **THEN** the HTML block SHALL be rendered as its corresponding DOM element

#### Scenario: Dangerous HTML is stripped
- **WHEN** a message contains `<script>alert(1)</script>` or an `onclick` attribute
- **THEN** the script tag and event handler SHALL be removed before rendering, producing no executable output

#### Scenario: Existing markdown is unaffected
- **WHEN** a message contains standard markdown (headers, lists, code blocks, GFM tables)
- **THEN** all existing markdown SHALL continue to render correctly alongside any HTML
