## MODIFIED Requirements

### Requirement: MessageMarkdown processes HTML alongside markdown
The `MessageMarkdown` component SHALL accept content strings containing a mix of markdown and raw HTML, rendering both formats correctly in the same output.

For user messages that were sent with image content arrays, the message display SHALL render the image visually (as an inline thumbnail or expanded image) alongside the text content, not as raw JSON or content block markup.

#### Scenario: Mixed content renders without conflict
- **WHEN** message content contains both markdown syntax (`##`, `**`, `` ` ``) and HTML tags (`<span>`, `<div>`, `<table>`)
- **THEN** markdown elements SHALL be rendered as styled markdown and HTML elements SHALL be rendered as DOM nodes, with no format collision

#### Scenario: rehype-raw is added to pipeline
- **WHEN** `MessageMarkdown` renders content
- **THEN** the `rehypePlugins` array SHALL include `rehype-raw` before `rehype-sanitize`

#### Scenario: rehype-sanitize is applied after rehype-raw
- **WHEN** `MessageMarkdown` renders content containing HTML
- **THEN** `rehype-sanitize` SHALL run after `rehype-raw` in the plugin pipeline, applying the default sanitization schema

#### Scenario: User message with content array containing image
- **WHEN** a user message has `content` stored as `ContentBlock[]` with an `image_url` block
- **THEN** the message bubble SHALL render the image as an `<img>` element with the data URI as `src`
- **AND** any `text` blocks SHALL render as markdown above or below the image
