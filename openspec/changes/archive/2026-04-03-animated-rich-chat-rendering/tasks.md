## 1. Rendering Semantics Foundation

- [x] 1.1 Audit current `ui-cognitive` chat render path (`chat-panel`, `message-markdown`, `code-block`) and identify insertion points for progressive enhancement hooks.
- [x] 1.2 Add stable block-type semantic hooks (class names or data attributes) for text, lists, code, activity, and callouts in markdown/code rendering components.

## 2. Progressive Animation Styling

- [x] 2.1 Create shared motion tokens for chat block enhancement (duration, easing, stagger, transform/opacity bounds) in chat style modules.
- [x] 2.2 Implement per-block enhancement styles so each block type has a distinct but subtle motion profile.
- [x] 2.3 Add `prefers-reduced-motion` overrides that disable or minimize non-essential motion while preserving static hierarchy cues.

## 3. Chat Panel Progressive Trigger

- [x] 3.1 Implement progressive enhancement timing in `chat-panel` so content appears immediately and animation classes are applied after initial paint.
- [x] 3.2 Ensure streaming updates remain non-blocking while progressive enhancements run for previously rendered blocks.

## 4. Test Coverage and Regression Safety

- [x] 4.1 Add or update frontend tests to verify immediate readability before enhancement for markdown and code block message flows.
- [x] 4.2 Add tests validating block-type enhancement mapping for text, lists, code, activity, and callouts.
- [x] 4.3 Add reduced-motion tests to verify minimal motion behavior and preserved structural readability.

## 5. Validation and Documentation

- [x] 5.1 Run `ui-cognitive` frontend lint/test/build checks and resolve regressions caused by rendering changes.
- [x] 5.2 Document implementation notes in the change artifacts if design or requirement assumptions were adjusted during execution.

## Implementation Notes

- Activity and callout blocks were kept as distinct motion profiles to preserve semantic clarity.
- Reduced-motion validation is implemented as style-contract tests plus component behavior tests (no pixel-assertion snapshots).
