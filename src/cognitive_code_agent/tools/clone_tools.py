import logging
import os
import re
import shutil
import subprocess
import time
import uuid
from pathlib import Path
from urllib.parse import urlparse

from pydantic import Field

from nat.builder.builder import Builder
from nat.builder.function_info import FunctionInfo
from nat.cli.register_workflow import register_function
from nat.data_models.function import FunctionBaseConfig

from cognitive_code_agent.tools.common import json_response
from cognitive_code_agent.tools.common import ANALYSIS_ROOT as DEFAULT_ANALYSIS_ROOT
from cognitive_code_agent.tools.common import WORKSPACE_ROOT as DEFAULT_WORKSPACE_ROOT
from cognitive_code_agent.tools.common import ensure_within_allowed_roots
from cognitive_code_agent.tools.common import redact_secrets
from cognitive_code_agent.tools.common import run_command
from cognitive_code_agent.tools.common import truncate_output

logger = logging.getLogger(__name__)

SANDBOX_ROOT = DEFAULT_ANALYSIS_ROOT
WORKSPACE_ROOT = DEFAULT_WORKSPACE_ROOT

# In-memory token store for pending workspace deletes.
# Structure: {token: {path, size_mb, expires_at}}
_PENDING_DELETE_TOKENS: dict[str, dict] = {}
_TOKEN_TTL_SECONDS = 300
DESTINATION_ROOTS = {
    "analysis": SANDBOX_ROOT,
    "workspace": WORKSPACE_ROOT,
}
MAX_TIMEOUT_SECONDS = 120
MAX_TIMEOUT_CAP = 600
MAX_STDOUT_CHARS = 10_000
MAX_STDERR_CHARS = 2_000
SAFE_DEST_NAME_RE = re.compile(r"^[A-Za-z0-9._-]+$")
GITHUB_HOSTS = {"github.com", "www.github.com"}


class CloneRepositoryConfig(FunctionBaseConfig, name="clone_repository"):
    description: str = Field(
        default=(
            "Clone a GitHub repository into /tmp/analysis (ephemeral) or /app/workspace "
            "(persistent). "
            "For private repos, it uses GITHUB_PERSONAL_ACCESS_TOKEN or GITHUB_TOKEN if available. "
            "Optional: shallow=True performs a blobless shallow clone (--depth 1 --filter=blob:none), "
            "which is faster for large repos when git history is not needed. "
            "Optional: timeout_seconds (default 120, max 600) sets the subprocess timeout."
        )
    )


def _parse_github_repo_url(repo_url: str) -> tuple[str, str, str]:
    normalized = repo_url.strip()
    if not normalized:
        raise ValueError("repo_url must not be empty")

    parsed = urlparse(normalized)
    if parsed.scheme != "https" or parsed.netloc.lower() not in GITHUB_HOSTS:
        raise ValueError("Only https://github.com/<owner>/<repo> URLs are supported")

    parts = [part for part in parsed.path.split("/") if part]
    if len(parts) != 2:
        raise ValueError("repo_url must follow https://github.com/<owner>/<repo>")

    owner, repo_part = parts
    repo_name = repo_part[:-4] if repo_part.endswith(".git") else repo_part
    if not owner or not repo_name:
        raise ValueError("repo_url must include owner and repository name")

    canonical_url = f"https://github.com/{owner}/{repo_name}.git"
    return owner, repo_name, canonical_url


def _build_authenticated_url(owner: str, repo_name: str) -> tuple[str, bool]:
    token = os.getenv("GITHUB_PERSONAL_ACCESS_TOKEN") or os.getenv("GITHUB_TOKEN")
    if not token:
        return f"https://github.com/{owner}/{repo_name}.git", False
    return f"https://x-access-token:{token}@github.com/{owner}/{repo_name}.git", True


def _destination_roots() -> dict[str, str]:
    """Resolve destination roots from current module-level roots.

    This keeps runtime behavior and tests consistent when SANDBOX_ROOT/WORKSPACE_ROOT
    are monkeypatched.
    """
    return {
        "analysis": SANDBOX_ROOT,
        "workspace": WORKSPACE_ROOT,
    }


def _resolve_destination(
    dest_name: str | None,
    repo_name: str,
    destination_root: str = "analysis",
) -> Path:
    """Resolve and validate destination path.

    Returns the resolved ``Path``.  Does **not** reject existing directories —
    callers must handle that via ``_check_existing_clone``.
    """
    destination_roots = _destination_roots()
    selected_root = destination_roots.get(destination_root)
    if selected_root is None:
        allowed = ", ".join(sorted(destination_roots.keys()))
        raise ValueError(f"destination_root must be one of: {allowed}")

    sandbox = Path(selected_root).resolve()
    sandbox.mkdir(parents=True, exist_ok=True)

    target_name = (dest_name or repo_name).strip()
    if not target_name:
        raise ValueError("dest_name must not be empty")
    if not SAFE_DEST_NAME_RE.fullmatch(target_name):
        raise ValueError(
            "dest_name can contain only letters, numbers, dots, underscores, and dashes"
        )

    destination = (sandbox / target_name).resolve()
    try:
        ensure_within_allowed_roots(destination, allowed_roots=[str(sandbox)])
    except ValueError as exc:
        raise ValueError(f"Destination {destination} is outside sandbox root {sandbox}") from exc
    return destination


_URL_AUTH_RE = re.compile(r"https://[^@/]+@")
_GIT_REMOTE_TIMEOUT = 5


def _normalize_repo_url(url: str) -> str:
    """Normalize a GitHub URL for comparison: strip auth, .git suffix, trailing slash."""
    normalized = _URL_AUTH_RE.sub("https://", url)
    normalized = normalized.rstrip("/")
    if normalized.endswith(".git"):
        normalized = normalized[:-4]
    return normalized


def _check_existing_clone(destination: Path, expected_url: str) -> dict | None:
    """Check if *destination* is a valid clone of *expected_url*.

    Returns ``None`` if *destination* does not exist.  Otherwise returns a dict
    with key ``outcome`` being one of ``"match"``, ``"conflict"``, or ``"error"``.
    """
    if not destination.exists():
        return None
    try:
        proc = subprocess.run(
            ["git", "-C", str(destination), "remote", "get-url", "origin"],
            capture_output=True,
            text=True,
            timeout=_GIT_REMOTE_TIMEOUT,
        )
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return {"outcome": "error", "reason": "git remote check failed or timed out"}

    if proc.returncode != 0:
        return {"outcome": "error", "reason": "directory exists but is not a valid git repository"}

    origin_url = proc.stdout.strip()
    if _normalize_repo_url(origin_url) == _normalize_repo_url(expected_url):
        return {"outcome": "match", "origin_url": origin_url}
    return {
        "outcome": "conflict",
        "origin_url": origin_url,
        "reason": (
            f"directory already contains a clone of {origin_url}, "
            f"not {expected_url}. Use a different dest_name."
        ),
    }


def _redact_url_credentials(text: str) -> str:
    return re.sub(r"https://[^@\s]+@github\.com", "https://***REDACTED***@github.com", text)


def _sanitize_output(text: str, max_chars: int, label: str) -> tuple[str, bool]:
    safe = redact_secrets(_redact_url_credentials(text))
    trimmed = truncate_output(safe, max_chars=max_chars, label=label)
    return trimmed, trimmed != safe


@register_function(config_type=CloneRepositoryConfig)
async def clone_repository_tool(config: CloneRepositoryConfig, builder: Builder):
    async def _run(
        repo_url: str,
        dest_name: str | None = None,
        destination_root: str = "analysis",
        shallow: bool = False,
        timeout_seconds: int = MAX_TIMEOUT_SECONDS,
    ) -> str:
        try:
            owner, repo_name, canonical_url = _parse_github_repo_url(repo_url)
            destination = _resolve_destination(
                dest_name=dest_name,
                repo_name=repo_name,
                destination_root=destination_root,
            )
            clone_url, used_token = _build_authenticated_url(owner=owner, repo_name=repo_name)
        except ValueError as exc:
            return json_response(
                {
                    "status": "error",
                    "message": str(exc),
                    "error_type": "validation_error",
                    "retryable": False,
                }
            )

        # -- Idempotent clone: check if destination already has the right repo --
        existing = _check_existing_clone(destination, canonical_url)
        if existing is not None:
            if existing["outcome"] == "match":
                return json_response(
                    {
                        "status": "ok",
                        "message": "Repository already cloned",
                        "repo_path": str(destination),
                        "source_url": canonical_url,
                        "clone_type": "existing",
                        "auth_used": "token" if used_token else "none",
                    }
                )
            # conflict or error — non-retryable
            return json_response(
                {
                    "status": "error",
                    "message": existing.get("reason", "Destination directory conflict"),
                    "error_type": "validation_error",
                    "retryable": False,
                }
            )

        import datetime as _dt

        effective_timeout = min(timeout_seconds, MAX_TIMEOUT_CAP)
        git_cmd = ["git", "clone"]
        if shallow:
            git_cmd += ["--depth", "1", "--filter=blob:none"]
        git_cmd += [clone_url, str(destination)]

        try:
            result = run_command(git_cmd, timeout=effective_timeout)
        except (TimeoutError, subprocess.TimeoutExpired):
            return json_response(
                {
                    "status": "timeout",
                    "message": f"Clone timed out after {effective_timeout} seconds",
                    "repo_path": str(destination),
                    "source_url": canonical_url,
                    "retryable": True,
                    "hint": "consider shallow=true for large repos or increase timeout_seconds",
                }
            )
        except FileNotFoundError as exc:
            return json_response(
                {
                    "status": "error",
                    "message": f"Executable not found: {exc}",
                    "error_type": "missing_executable",
                    "retryable": False,
                }
            )

        stdout, stdout_truncated = _sanitize_output(result.stdout, MAX_STDOUT_CHARS, "stdout")
        stderr, stderr_truncated = _sanitize_output(result.stderr, MAX_STDERR_CHARS, "stderr")

        if result.returncode == 0:
            try:
                _write_clone_meta(
                    destination,
                    {
                        "cloned_by": os.getenv("AGENT_USER_ID", "unknown"),
                        "cloned_at": _dt.datetime.now(_dt.timezone.utc).isoformat(),
                        "repo_url": canonical_url,
                        "location": destination_root,
                    },
                )
            except Exception:
                logger.warning("Unexpected error writing clone metadata for %s", destination)

        payload = {
            "status": "ok" if result.returncode == 0 else "error",
            "message": "Repository cloned" if result.returncode == 0 else "Clone failed",
            "repo_path": str(destination),
            "source_url": canonical_url,
            "clone_type": "shallow" if shallow else "full",
            "auth_used": "token" if used_token else "none",
            "returncode": result.returncode,
            "duration_ms": result.duration_ms,
            "stdout": stdout,
            "stderr": stderr,
            "truncated": stdout_truncated or stderr_truncated,
            "retryable": result.returncode != 0,
        }
        return json_response(payload)

    yield FunctionInfo.from_fn(_run, description=config.description)


def _write_clone_meta(repo_dir: Path, meta: dict) -> None:
    """Write .clone_meta.json to repo_dir. Failures are logged and swallowed."""
    import json as _json
    try:
        repo_dir.mkdir(parents=True, exist_ok=True)
        (repo_dir / ".clone_meta.json").write_text(
            _json.dumps(meta, indent=2), encoding="utf-8"
        )
    except OSError as exc:
        logger.warning("Failed to write .clone_meta.json to %s: %s", repo_dir, exc)


def _get_size_mb(path: Path) -> float:
    """Return approximate size of a file or directory in MB."""
    total = 0
    try:
        if path.is_file():
            total = path.stat().st_size
        else:
            for entry in path.rglob("*"):
                try:
                    if entry.is_file():
                        total += entry.stat().st_size
                except OSError:
                    pass
    except OSError:
        pass
    return round(total / (1024 * 1024), 2)


def _resolve_delete_target(location: str, target: str) -> Path | None:
    """Resolve and confine the delete target path. Returns None if blocked."""
    if location == "sandbox":
        root = Path(SANDBOX_ROOT).resolve()
    elif location == "workspace":
        root = Path(WORKSPACE_ROOT).resolve()
    else:
        return None

    root.mkdir(parents=True, exist_ok=True)

    # Reject names that are not safe or absolute paths
    if not target or Path(target).is_absolute() or not SAFE_DEST_NAME_RE.fullmatch(target):
        return None

    candidate = (root / target).resolve()
    try:
        ensure_within_allowed_roots(candidate, allowed_roots=[str(root)])
    except ValueError:
        return None
    return candidate


class WorkspaceDeleteConfig(FunctionBaseConfig, name="workspace_delete"):
    description: str = Field(
        default=(
            "Delete a file or directory from the agent workspace. "
            "For sandbox (location='sandbox'): deletes immediately, no confirmation needed. "
            "For workspace (location='workspace'): returns a confirmation token — "
            "the user must confirm via the UI PIN modal before the delete executes. "
            "Supports both individual files and directories. "
            "The agent loop always continues regardless of outcome."
        )
    )


@register_function(config_type=WorkspaceDeleteConfig)
async def workspace_delete_tool(config: WorkspaceDeleteConfig, builder: Builder):
    async def _run(location: str, target: str) -> str:
        # Validate location
        if location not in ("sandbox", "workspace"):
            return json_response(
                {
                    "status": "blocked",
                    "message": f"Invalid location '{location}'. Must be 'sandbox' or 'workspace'.",
                    "retryable": False,
                    "error_type": "validation_error",
                }
            )

        # Resolve and confine path
        resolved = _resolve_delete_target(location, target)
        if resolved is None:
            return json_response(
                {
                    "status": "blocked",
                    "message": (
                        f"Target '{target}' is outside the allowed root or contains invalid characters. "
                        "Only simple directory names are allowed (letters, numbers, dots, dashes, underscores)."
                    ),
                    "retryable": False,
                    "error_type": "path_blocked",
                }
            )

        # Target must exist
        if not resolved.exists():
            return json_response(
                {
                    "status": "not_found",
                    "message": (
                        f"Target '{target}' not found in {location}. "
                        "Use workspace_delete with location='sandbox' or 'workspace' to list available repos."
                    ),
                    "retryable": False,
                    "error_type": "not_found",
                }
            )

        size_mb = _get_size_mb(resolved)

        # Read ownership metadata if present
        meta: dict = {}
        meta_file = resolved / ".clone_meta.json"
        if meta_file.exists():
            import json as _json
            try:
                meta = _json.loads(meta_file.read_text(encoding="utf-8"))
            except Exception:
                pass

        if location == "sandbox":
            # Auto-delete: no confirmation needed
            try:
                if resolved.is_file():
                    import os
                    os.remove(str(resolved))
                else:
                    shutil.rmtree(str(resolved))
            except OSError as exc:
                return json_response(
                    {
                        "status": "execution_error",
                        "message": f"Failed to delete '{target}': {exc}",
                        "retryable": True,
                        "error_type": "execution_error",
                    }
                )
            payload: dict = {
                "status": "deleted",
                "message": f"Deleted '{target}' from sandbox ({size_mb} MB freed).",
                "location": location,
                "target": target,
                "target_path": str(resolved),
                "size_freed_mb": size_mb,
                "retryable": False,
            }
            if meta.get("cloned_by"):
                payload["cloned_by"] = meta["cloned_by"]
            if meta.get("cloned_at"):
                payload["cloned_at"] = meta["cloned_at"]
            return json_response(payload)

        # Workspace: issue confirmation token, do NOT delete
        token = str(uuid.uuid4())
        expires_at = time.time() + _TOKEN_TTL_SECONDS
        _PENDING_DELETE_TOKENS[token] = {
            "path": str(resolved),
            "size_mb": size_mb,
            "expires_at": expires_at,
            "location": location,
            "target": target,
        }

        response: dict = {
            "status": "awaiting_ui_confirmation",
            "message": (
                f"Workspace delete requires PIN confirmation. "
                f"A confirmation modal will appear in the UI. "
                f"The token expires in {_TOKEN_TTL_SECONDS // 60} minutes."
            ),
            "confirmation_token": token,
            "target_path": str(resolved),
            "size_mb": size_mb,
            "location": location,
            "target": target,
            "retryable": False,
        }
        if meta.get("cloned_by"):
            response["cloned_by"] = meta["cloned_by"]
        if meta.get("cloned_at"):
            response["cloned_at"] = meta["cloned_at"]
        return json_response(response)

    yield FunctionInfo.from_fn(_run, description=config.description)
