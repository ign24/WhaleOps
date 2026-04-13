## timeout-hardening

### Purpose
Prevent premature workflow termination from HTTP client timeouts and NAT Runner lifecycle errors.

### Problem 1: aiohttp Default Timeout

`langchain_nvidia_ai_endpoints` uses aiohttp with default `ClientTimeout` (~300s total). Long NIM responses (e.g., DeepSeek generating 3000+ token outputs with heavy tool calling) exceed this and raise `asyncio.TimeoutError`.

### Solution 1: Monkey-patch in register.py

```python
def _apply_nim_timeout_patch(total_seconds: int = 900) -> None:
    from langchain_nvidia_ai_endpoints._common import _NVIDIAClient
    import aiohttp

    if getattr(_NVIDIAClient, "_cognitive_timeout_patch_applied", False):
        return

    original = _NVIDIAClient._create_async_session

    def _patched(self):
        session = original(self)
        session._timeout = aiohttp.ClientTimeout(total=total_seconds)
        return session

    _NVIDIAClient._create_async_session = _patched
    _NVIDIAClient._cognitive_timeout_patch_applied = True
```

Applied at module import time in `register.py`, alongside the existing MCP enum patch.

### Problem 2: NAT Runner Lifecycle Error

When streaming fails mid-response, the `Runner.__aexit__` raises:
```
ValueError: Cannot exit the context without completing the workflow
```

This propagates through Starlette's response stream and crashes the HTTP connection, even though the `ainvoke` fallback already produced a valid response.

### Solution 2: Defensive Streaming Wrapper

The streaming fallback in `_response_fn` works correctly today. The issue is that the error from Runner propagates *after* the response has been yielded. Two options:

**Option A (preferred)**: Wrap the async generator in a try/except at the outermost level that catches `ValueError` from Runner cleanup and logs it instead of propagating.

**Option B**: Restructure the streaming to use `ainvoke` exclusively when streaming fails, avoiding the Runner context entirely for the fallback path.

### Problem 3: Unnecessary Timeout Strictness

The `tool_call_timeout_seconds=900` is appropriate for analyze and refactor modes but overly generous for execute mode (simple git ops).

### Solution 3: Per-mode Timeout Configuration

| Mode | tool_call_timeout | HTTP client timeout |
|------|-------------------|---------------------|
| analyze | 900s | 900s |
| refactor | 900s | 900s |
| execute | 120s | 300s |

### Constraints
- Patches must be idempotent (check `_patch_applied` flag).
- Timeout values should be configurable via config.yml, not hardcoded.
- Logging must clearly indicate when a timeout occurs and which layer triggered it.
