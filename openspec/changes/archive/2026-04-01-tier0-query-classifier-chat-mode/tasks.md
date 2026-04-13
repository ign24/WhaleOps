## 1. Tier 0 Query Classifier Module

- [x] 1.1 Create `src/cognitive_code_agent/routing/__init__.py` (empty, marks package)
- [x] 1.2 Create `src/cognitive_code_agent/routing/query_classifier.py` with `IntentClass` enum (`CHAT`, `UNKNOWN`) and `QueryClassifier` class with `classify(text: str) -> IntentClass` static method
- [x] 1.3 Implement regex patterns for CHAT intent: greetings (hola, hi, hey, buenos días, buenas, good morning), short affirmations (ok, dale, entendido, perfecto, gracias, understood, got it), capability questions (qué podés hacer, what can you do, help, cómo me ayudás)
- [x] 1.4 Ensure `classify()` returns `IntentClass.UNKNOWN` for anything not matching a CHAT pattern

## 2. Unit Tests for Classifier

- [x] 2.1 Create `tests/unit/test_query_classifier.py`
- [x] 2.2 Test all CHAT patterns (greetings, affirmations, capability questions in Spanish and English)
- [x] 2.3 Test that analysis-intent keywords return `UNKNOWN` (e.g., "analizá el repo", "security review", "refactor this")
- [x] 2.4 Test case-insensitivity and whitespace handling
- [x] 2.5 Run `uv run pytest tests/unit/test_query_classifier.py -v` and confirm all pass

## 3. Chat Mode System Prompt

- [x] 3.1 Create `src/cognitive_code_agent/prompts/system/chat.md` with: identity block, language policy (respond in user's language), conversational behavior (direct, concise, no analysis preamble), and a note that `query_findings` is available for questions about past analyses

## 4. Config: Add Chat Mode

- [x] 4.1 Add `chat` mode block to `workflow.modes` in `src/cognitive_code_agent/configs/config.yml`:
  - `llm_name: kimi_reader`
  - `prompt_path: src/cognitive_code_agent/prompts/system/chat.md`
  - `max_iterations: 3`
  - `max_history: 4`
  - `tool_call_timeout_seconds: 30`
  - `tool_names: [query_findings, fs_tools]`

## 5. Agent Integration

- [x] 5.1 Import `QueryClassifier` and `IntentClass` in `safe_tool_calling_agent.py`
- [x] 5.2 In `_response_fn`, after extracting `last_user_message` and before `resolve_mode()`, run Tier 0 classification: if no explicit prefix detected and classifier returns `CHAT` and `chat` is in `mode_runtimes`, set mode to `chat`
- [x] 5.3 Add `if mode != "chat":` guard around the auto-retrieval block (`_retrieve_memory_context()` call) so memory retrieval is skipped for chat queries
- [x] 5.4 In the skill injection block, add `if mode != "chat":` guard around `build_active_skills_block()` call so no skills are injected for chat mode
- [x] 5.5 Log classifier decision at DEBUG level: `"Tier0 classifier: intent=%s, mode=%s"`

## 6. Integration Verification

- [x] 6.1 Run full test suite: `uv run pytest -x` — confirm no regressions (297 unit tests pass, 3 pre-existing failures in e2e/clone unrelated to this change)
- [x] 6.2 Run `uv run ruff check src/` and `uv run ruff format --check src/` — confirm clean
- [ ] 6.3 Manual smoke test: start the server locally and send "hola" — verify response comes from `chat` mode (check logs for `Mode: chat`)
- [ ] 6.4 Manual smoke test: send "/analyze hola" — verify it routes to `analyze` mode, not `chat`
- [ ] 6.5 Manual smoke test: send "analizá el repo" — verify it routes to `analyze` mode, not `chat`
