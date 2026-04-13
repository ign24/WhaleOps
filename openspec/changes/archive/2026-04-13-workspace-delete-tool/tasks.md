## 1. Python Tool — workspace_delete (TDD)

- [x] 1.1 Write RED tests for sandbox delete: success, not_found, execution_error, path_traversal blocked
- [x] 1.2 Write RED tests for workspace delete: returns awaiting_ui_confirmation with token, not_found before token, path_traversal blocked
- [x] 1.3 Write RED tests for all structured error responses: assert status, retryable, error_type fields present in every path
- [x] 1.4 Implement `workspace_delete` in `clone_tools.py`: path confinement via `_resolve_destination` pattern, sandbox auto-delete with `shutil.rmtree`, workspace token generation (UUID v4, module-level store with TTL)
- [x] 1.5 Run tests — achieve GREEN for all workspace_delete unit tests
- [x] 1.6 Register `workspace_delete` in `config.yml` for all relevant agent modes (same modes that have `clone_repository`)

## 2. Python Tool — ownership metadata (TDD)

- [x] 2.1 Write RED test: after successful clone, `.clone_meta.json` exists with correct fields
- [x] 2.2 Write RED test: `.clone_meta.json` write failure does not fail the clone (IOError swallowed, warning logged)
- [x] 2.3 Write RED test: `workspace_delete` response includes `cloned_by`/`cloned_at` when `.clone_meta.json` present
- [x] 2.4 Write RED test: `workspace_delete` response proceeds normally when `.clone_meta.json` missing
- [x] 2.5 Implement: write `.clone_meta.json` in `clone_repository_tool` after successful clone (new + reuse paths)
- [x] 2.6 Implement: read `.clone_meta.json` in `workspace_delete` and include fields in response when present
- [x] 2.7 Run tests — achieve GREEN for all ownership metadata tests

## 3. Confirm API endpoint (TDD)

- [x] 3.1 Write RED tests for `POST /api/workspace/delete/confirm`: valid PIN + valid token → 200, wrong PIN → 403 (token not consumed), expired token → 410, unknown token → 404, missing env var → 503
- [x] 3.2 Write RED test: token is single-use (second call with same token → 404 after successful delete)
- [x] 3.3 Write RED test: token expires after 300 seconds
- [x] 3.4 Implement in-memory token store (module-level Map with `{path, size_mb, expires_at}`) in Next.js API layer
- [x] 3.5 Implement `POST /api/workspace/delete/confirm/route.ts`: bcrypt PIN validation, token lookup, Python backend proxy call, token removal on success
- [x] 3.6 Add `WORKSPACE_DELETE_PIN_HASH` to `.env.example` with generation instructions
- [x] 3.7 Run tests — achieve GREEN for all confirm endpoint tests

## 4. UI — DeleteConfirmModal (TDD)

- [x] 4.1 Write RED tests for `DeleteConfirmModal`: renders target_path and size_mb, PIN input is masked (type=password, autoComplete=off), Cancel fires no request, Confirm POSTs to confirm endpoint
- [x] 4.2 Write RED tests for modal state transitions: wrong PIN keeps modal open with error, token_expired closes modal with chat message, success closes modal with success message
- [x] 4.3 Implement `DeleteConfirmModal` component in `ui-cognitive/components/workspace/delete-confirm-modal.tsx`
- [x] 4.4 Run tests — achieve GREEN for modal unit tests

## 5. UI — chat-panel integration (TDD)

- [x] 5.1 Write RED test: chat-panel detects `status="awaiting_ui_confirmation"` in tool result and renders `DeleteConfirmModal`
- [x] 5.2 Write RED test: PIN value is not present in any rendered chat message
- [x] 5.3 Write RED test: success path appends "Workspace deleted: <path> (<size> MB freed)" to chat
- [x] 5.4 Write RED test: cancel path appends "Eliminación cancelada" to chat
- [x] 5.5 Implement detection logic in `chat-panel.tsx`: check tool result stream for `awaiting_ui_confirmation`, pass token + metadata to modal
- [x] 5.6 Implement post-confirm chat message injection (success and cancel)
- [x] 5.7 Run tests — achieve GREEN for all chat-panel integration tests

## 6. Full test suite validation

- [x] 6.1 Run full Python test suite (`uv run pytest -x`) — zero regressions (654 passed)
- [x] 6.2 Run full frontend test suite (`bun run test`) — zero regressions (424 passed, 63 files)
- [ ] 6.3 Manual smoke test: clone a repo to sandbox → delete it (auto) → verify gone
- [ ] 6.4 Manual smoke test: clone a repo to workspace → agent returns awaiting_ui_confirmation → enter PIN in modal → verify deleted
- [ ] 6.5 Manual smoke test: enter wrong PIN → modal stays open with error → enter correct PIN → deleted
- [ ] 6.6 Manual smoke test: wait 5 minutes after token issued → enter PIN → token_expired message in chat
