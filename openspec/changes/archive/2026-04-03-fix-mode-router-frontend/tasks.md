## 1. Frontend: Route /refactor and /execute to backend

- [x] 1.1 In `ui-cognitive/components/chat/chat-panel.tsx`, add a handler block for `command === "refactor" || command === "execute"` that calls `sendMessageToAgent(trimmed)` (with prefix intact) before the existing analyze/quick-review block
- [x] 1.2 In `ui-cognitive/lib/command-registry.ts`, add entries for `/refactor` (description: refactoriza codigo con Devstral) and `/execute` (description: ejecuta operaciones git con Kimi)
- [x] 1.3 In `ui-cognitive/components/chat/chat-panel.tsx`, update the `/help` output text to include `/refactor` and `/execute` descriptions

## 2. Analyze prompt: Richer findings for cross-mode context

- [x] 2.1 In `src/cognitive_code_agent/prompts/system/analyze.md`, add a `<findings_quality>` section after `<memory_policy>` requiring: file_path on every finding, stack versions in repo-overview, model/table names with paths, endpoint paths with file locations, specific and actionable summaries

## 3. Stop retrying broken tools

- [x] 3.1 In `src/cognitive_code_agent/prompts/system/analyze.md`, replace execution rules (lines 152-157) to add: "If a tool fails with FileNotFoundError or Connection refused, do NOT retry. Record the gap and continue."
- [x] 3.2 In `src/cognitive_code_agent/prompts/system/refactor.md`, add after `<code_writing_policy>`: "If a validation tool fails with FileNotFoundError or Connection refused, do NOT retry. Record failure and continue with next file."

## 4. Frontend tests

- [x] 4.1 In `ui-cognitive/tests/chat-panel.test.tsx`, add test: `/refactor <msg>` calls `sendMessageToAgent` with prefix intact and does NOT show "Comando desconocido"
- [x] 4.2 In `ui-cognitive/tests/chat-panel.test.tsx`, add test: `/execute <msg>` calls `sendMessageToAgent` with prefix intact and does NOT show "Comando desconocido"

## 5. Verification

- [x] 5.1 Run backend tests: `uv run pytest -x` (220 passed, e2e y clone_tools excluidos — pre-existentes)
- [x] 5.2 Run frontend lint/build: lint clean, build success
- [x] 5.3 Smoke test: send `/refactor test` and verify logs show `Mode: refactor` with Devstral model name
