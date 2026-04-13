## mode-router

### Purpose
Deterministic prefix-based router that selects the execution mode before any LLM call.

### Behavior

1. Extract the last user message from the request.
2. Check for known prefixes (case-insensitive, with optional whitespace):
   - `/analyze` -> `analyze`
   - `/refactor` -> `refactor`
   - `/execute` -> `execute`
3. If prefix found: strip it from the message, return the mode and cleaned message.
4. If no prefix: return `analyze` as default mode, message unchanged.

### Interface

```python
def resolve_mode(user_message: str, default: str = "analyze") -> tuple[str, str]:
    """Return (mode_name, cleaned_message)."""
```

### Edge Cases

- Empty message after prefix stripping: keep the mode, pass empty string to LLM (it will ask for clarification).
- Unknown prefix like `/debug`: treat as no prefix, default to analyze.
- Multiple prefixes: only first is checked.

### Constraints
- No LLM call. Purely string matching.
- Must execute in <1ms.
