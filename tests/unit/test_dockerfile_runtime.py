from __future__ import annotations

from pathlib import Path

import pytest


pytestmark = pytest.mark.unit


def test_dockerfile_uses_uv_sync_frozen_for_runtime_lockstep() -> None:
    dockerfile = Path("Dockerfile").read_text(encoding="utf-8")
    assert "uv sync --frozen --no-dev" in dockerfile


def test_dockerfile_starts_nat_through_uv_run() -> None:
    dockerfile = Path("Dockerfile").read_text(encoding="utf-8")
    assert 'CMD ["uv", "run", "nat", "serve"' in dockerfile
