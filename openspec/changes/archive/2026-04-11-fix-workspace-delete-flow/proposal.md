## Why

The workspace deletion system has three structural bugs that prevent it from working end-to-end:

1. **Token store disconnect**: The Python agent generates a UUID token and stores it in its own `_PENDING_DELETE_TOKENS` dict. The Next.js confirm route checks a separate in-memory Map in the Node process. The token never exists in Node, so PIN confirmation always fails with 404.
2. **Files cannot be deleted**: `workspace_api.py` rejects anything that isn't a directory (`path must be a directory`), and `clone_tools.py` only uses `shutil.rmtree`. Individual file deletion is impossible.
3. **Misleading tool description**: The tool says "directory" everywhere, confusing the agent into never attempting file deletion.

## What Changes

- Bridge the token gap: when `chat-panel` detects `awaiting_ui_confirmation` from the SSE stream, register the token (with its exact UUID) into the Next.js token store before showing the modal.
- Add a `registerDeleteTokenWithId` function to the Next.js token store that accepts a pre-existing token ID instead of generating a new one.
- Support file deletion in both `clone_tools.py` (use `os.remove` for files) and `workspace_api.py` (remove the `is_dir` gate).
- Update tool description and error messages to say "file or directory" instead of just "directory".
- Add a size helper that handles both files and directories.

## Capabilities

### New Capabilities
- `token-bridge`: Bridge Python-issued delete tokens into the Next.js in-memory store via SSE event detection in chat-panel.
- `file-deletion`: Extend workspace_delete tool and execute-delete API to support individual file deletion alongside directory deletion.

### Modified Capabilities

## Impact

- `src/cognitive_code_agent/tools/clone_tools.py` — tool description, file deletion logic, size helper
- `src/cognitive_code_agent/workspace_api.py` — remove is_dir gate, handle file vs dir deletion
- `ui-cognitive/components/chat/chat-panel.tsx` — register token on detection
- `ui-cognitive/lib/workspace-delete-tokens.ts` — new `registerDeleteTokenWithId` export
- `ui-cognitive/app/api/workspace/delete/confirm/route.ts` — no changes needed (already works if token exists)
- Tests: unit tests for token bridge, file deletion in Python, API endpoint
