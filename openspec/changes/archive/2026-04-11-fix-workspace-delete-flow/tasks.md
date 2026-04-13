## 1. Token Bridge — Next.js store

- [x] 1.1 Add `registerDeleteTokenWithId(token, data)` to `ui-cognitive/lib/workspace-delete-tokens.ts`
- [x] 1.2 Write unit test for `registerDeleteTokenWithId` (register + checkTokenStatus returns "valid")
- [x] 1.3 Create API route `ui-cognitive/app/api/workspace/delete/register-token/route.ts` (POST, auth-gated, stores token)
- [x] 1.4 Write test for register-token route (200 on valid, 400 on missing fields, 401 on no session)

## 2. Token Bridge — Chat Panel integration

- [x] 2.1 Update `chat-panel.tsx` SSE handler: POST to `/api/workspace/delete/register-token` before `setPendingDeleteConfirm`
- [x] 2.2 Add error handling: if registration POST fails, inject error message into chat instead of showing modal
- [x] 2.3 Update `chat-panel-delete-confirm.test.tsx` to verify token registration call happens before modal render

## 3. File Deletion — Python backend

- [x] 3.1 Rename `_get_dir_size_mb` to `_get_size_mb` in `clone_tools.py` — handle both files and dirs
- [x] 3.2 Update `workspace_delete_tool` in `clone_tools.py` — use `os.remove()` for files, `shutil.rmtree()` for dirs
- [x] 3.3 Update `WorkspaceDeleteConfig.description` to mention files and directories
- [x] 3.4 Write unit tests for file deletion in sandbox (immediate) and workspace (token flow)

## 4. File Deletion — workspace API

- [x] 4.1 Remove `is_dir()` gate in `workspace_api.py` `/workspace/execute-delete` — dispatch `os.remove` for files, `shutil.rmtree` for dirs
- [x] 4.2 Update size calculation in `workspace_execute_delete` to handle files
- [x] 4.3 Write unit test for execute-delete with file target

## 5. Verification

- [x] 5.1 Run full Python test suite (`uv run pytest -x`)
- [x] 5.2 Run full frontend test suite (`bun test`)
- [x] 5.3 Run lint checks (Python + frontend)
