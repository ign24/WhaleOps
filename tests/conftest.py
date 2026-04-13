from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from cognitive_code_agent.tools.common import CommandResult


@pytest.fixture
def tmp_sandbox(tmp_path: Path) -> Path:
    sandbox_root = tmp_path / "analysis"
    (sandbox_root / "repo").mkdir(parents=True)
    return sandbox_root


@pytest.fixture
def sample_repo_with_python(tmp_sandbox: Path) -> Path:
    repo = tmp_sandbox / "repo"
    (repo / "pkg").mkdir(parents=True, exist_ok=True)
    (repo / "pkg" / "module.py").write_text(
        """def undocumented(a, b):\n    return a + b\n\n\nclass Service:\n    \"\"\"Service docs.\"\"\"\n\n    def run(self):\n        \"\"\"Run docs.\"\"\"\n        return True\n""",
        encoding="utf-8",
    )
    return repo


@pytest.fixture
def sample_repo_with_readme(tmp_sandbox: Path) -> Path:
    repo = tmp_sandbox / "repo"
    (repo / "README.md").write_text(
        "# Demo\n\n## Install\n\nRun setup.\n\n## Usage\n\nRun app.\n",
        encoding="utf-8",
    )
    return repo


@pytest.fixture
def mock_run_command(monkeypatch: pytest.MonkeyPatch):
    def _factory(
        module: Any,
        *,
        stdout: str = "",
        stderr: str = "",
        returncode: int = 0,
        duration_ms: int = 12,
        side_effect: Exception | None = None,
    ) -> list[dict[str, Any]]:
        calls: list[dict[str, Any]] = []

        def _fake(command, timeout: int = 60, cwd: Path | None = None):
            calls.append({"command": list(command), "timeout": timeout, "cwd": cwd})
            if side_effect is not None:
                raise side_effect
            return CommandResult(
                command=list(command),
                returncode=returncode,
                stdout=stdout,
                stderr=stderr,
                duration_ms=duration_ms,
            )

        monkeypatch.setattr(module, "run_command", _fake)
        return calls

    return _factory
