## 1. Implement token extraction helper

- [x] 1.1 Add `_extract_token_from_update(event, content_so_far)` function in `safe_tool_calling_agent.py` that reads the last message from the `"agent"` key of an updates event and returns the new delta string (or `None`)
- [x] 1.2 Add debug-level log warning when update event dict has no recognized node key
- [x] 1.3 Verify function handles empty content, non-string content (list of blocks), and missing `"agent"` key without raising

## 2. Fix the astream call

- [x] 2.1 In `safe_tool_calling_agent.py` lines 846-862, change `stream_mode="messages"` to `stream_mode="updates"`
- [x] 2.2 Remove the `version="v2"` kwarg from the `astream()` call
- [x] 2.3 Replace the `_extract_message_token(event)` call with `_extract_token_from_update(event, content)` using the accumulated `content` variable as the `content_so_far` argument
- [x] 2.4 Confirm the `ainvoke` fallback path (lines 885-916) requires no changes

## 3. Unit tests — token extraction helper

- [x] 3.1 Test: helper returns `None` for a non-dict event
- [x] 3.2 Test: helper returns `None` for an event with no `"agent"` key (e.g., tool node update)
- [x] 3.3 Test: helper returns `None` when last message content is empty or a list
- [x] 3.4 Test: helper returns full content when `content_so_far` is empty
- [x] 3.5 Test: helper returns only the new suffix when `content_so_far` is a prefix of the current content (incremental delta)
- [x] 3.6 Test: helper returns `None` when content equals `content_so_far` (no new tokens)

## 4. Unit tests — duplicate tool call regression

- [x] 4.1 Create a mock graph whose `astream` yields 3 identical update events each containing an `AIMessage` with one `tool_call`
- [x] 4.2 Assert that the tool mock was called exactly once after consuming the full stream
- [x] 4.3 Test: mock graph emits 3 incremental updates ("He", "Hello", "Hello world") — assert SSE chunks are ["He", "llo", " world"]

## 5. Integration smoke test

- [x] 5.1 Run existing agent integration tests to confirm no regression in the fallback path
- [x] 5.2 Manually verify (or via test) that the SSE `ChatResponseChunk` fields (id_, created, model, role) are identical to pre-fix behavior

## 6. Cleanup

- [x] 6.1 Remove (or mark deprecated) the old `_extract_message_token()` function — or add a comment that it is preserved for reference only
- [x] 6.2 Run `uv run ruff check . && uv run ruff format --check .` and fix any lint errors
- [x] 6.3 Run full test suite with `uv run pytest -x` and confirm all tests pass
