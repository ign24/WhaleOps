## Context

The workspace deletion flow spans two processes:
- **Python agent** (FastAPI): runs `workspace_delete` tool, generates UUID token, stores in `_PENDING_DELETE_TOKENS` dict
- **Next.js UI** (Node): SSE stream receives tool_end event with token, renders PIN modal, validates PIN against `WORKSPACE_DELETE_PIN_HASH`, proxies confirmed delete to Python backend

The token is created in Python but validated in Node. These are separate processes with separate memory — the token never crosses the boundary.

Additionally, `workspace_api.py` and `clone_tools.py` only support directory deletion. File deletion fails with "path must be a directory".

## Goals / Non-Goals

**Goals:**
- Token bridge: make the Python-issued token available to the Next.js confirm route
- File deletion: support deleting individual files in workspace and sandbox
- Keep existing PIN confirmation flow unchanged (bcryptjs hash in env var)
- Keep existing security constraints (path confinement, safe name regex, TTL)

**Non-Goals:**
- Changing the PIN mechanism (it works correctly once the token exists)
- Adding recursive path support (e.g., `subdir/file.txt`) — keep flat name constraint
- Adding UI for browsing/selecting files to delete

## Decisions

### D1: Register token in Next.js store from chat-panel SSE handler

When `chat-panel.tsx` detects `awaiting_ui_confirmation` in the tool_end event, it already has all the data (token, path, size_mb, location, target). Before calling `setPendingDeleteConfirm`, call a new API route `/api/workspace/delete/register-token` that stores the token in the Next.js in-memory Map.

**Why not proxy token validation to Python?** That would require changing the confirm route to call Python for token lookup instead of the local Map. More invasive, adds latency, and breaks the existing single-use consumption pattern.

**Why an API route instead of direct import?** `chat-panel.tsx` runs in the browser. `workspace-delete-tokens.ts` runs on the server. The browser cannot call server-only functions directly. A lightweight POST endpoint bridges this.

### D2: `registerDeleteTokenWithId` function

Add a new export to `workspace-delete-tokens.ts` that accepts a specific token string instead of generating a random one. The existing `registerDeleteToken` generates its own UUID — we need to preserve the Python-issued UUID so the flow is coherent.

### D3: File deletion via `os.remove` / `fs.unlink`

In `clone_tools.py`: if target `is_file()`, use `os.remove()` instead of `shutil.rmtree()`. Size is just `stat().st_size`.

In `workspace_api.py`: remove the `is_dir()` gate. Check `is_file()` vs `is_dir()` and dispatch to `os.remove` or `shutil.rmtree` accordingly.

### D4: Unified size helper

Rename `_get_dir_size_mb` to `_get_size_mb`. If path is a file, return file size. If dir, walk as before.

## Risks / Trade-offs

- **In-memory token store is volatile**: If the Next.js process restarts between token registration and PIN confirmation, the token is lost. This is the existing behavior — acceptable for a 5-minute TTL window. → No mitigation needed.
- **Race condition on SSE**: The token registration API call is async. If the user somehow submits PIN before registration completes, it would 404. → The modal renders after the registration call, and human reaction time is orders of magnitude slower than the API call.
- **File deletion is immediate for sandbox**: No confirmation for sandbox file deletion, same as directories. This matches existing sandbox behavior (ephemeral by design).
