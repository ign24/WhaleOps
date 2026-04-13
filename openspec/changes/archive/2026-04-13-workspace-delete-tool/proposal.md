## Why

The agent clones repositories into `/tmp/analysis` (sandbox) and `/app/workspace` (persistent workspace) but has no tool to delete them. Shell `rm -r` is classified TIER_3_BLOCKED by the safety classifier, and `@modelcontextprotocol/server-filesystem` has no `delete_file` tool. In shared team deployments, repos accumulate with no cleanup path — the agent is stuck.

## What Changes

- **New tool** `workspace_delete` in Python backend: deletes a repo/directory from sandbox (auto) or workspace (PIN-gated via UI modal)
- **Ownership tracking**: `clone_repository` writes `.clone_meta.json` per repo so the system knows who cloned what
- **UI confirmation modal**: chat panel detects `status="awaiting_ui_confirmation"` in tool result and renders a PIN entry modal — PIN never enters the LLM context
- **Confirm API endpoint**: `POST /api/workspace/delete/confirm` validates PIN against bcrypt hash env var, calls Python backend to execute the delete
- **Agent loop continuity**: every error path (`confirmation_denied`, `not_found`, `blocked`, `token_expired`, `execution_error`) returns structured JSON so the agent can inform the user and continue without hanging

## Capabilities

### New Capabilities

- `workspace-delete`: Delete a repo or directory from sandbox or persistent workspace, with PIN confirmation gate for workspace targets
- `workspace-ownership`: Track clone ownership via `.clone_meta.json` written at clone time, exposing cloned_by and cloned_at metadata
- `delete-confirm-api`: API endpoint that validates team PIN and proxies the actual filesystem delete to the Python backend
- `delete-confirm-ui`: Chat panel modal for PIN entry, triggered by `awaiting_ui_confirmation` tool result; PIN is masked and never sent through chat

### Modified Capabilities

- `idempotent-clone`: Clone tool must now write `.clone_meta.json` after a successful clone (new side effect on existing capability)

## Impact

- `src/cognitive_code_agent/tools/clone_tools.py` — add `workspace_delete` tool + ownership write in `clone_repository`
- `src/cognitive_code_agent/configs/config.yml` — register `workspace_delete` in relevant agent modes
- `ui-cognitive/app/api/workspace/delete/confirm/route.ts` — new API route
- `ui-cognitive/components/chat/chat-panel.tsx` — detect `awaiting_ui_confirmation`, render modal
- `ui-cognitive/components/workspace/` — new `DeleteConfirmModal` component
- `.env.example` — add `WORKSPACE_DELETE_PIN_HASH`
- No breaking changes to existing tools or APIs
