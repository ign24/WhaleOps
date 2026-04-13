from __future__ import annotations

from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from cognitive_code_agent.workspace_api import is_allowed_path, register_workspace_routes


pytestmark = pytest.mark.unit


def test_is_allowed_path_respects_root_boundaries(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    analysis = tmp_path / "analysis"
    workspace = tmp_path / "workspace"
    analysis.mkdir(parents=True)
    workspace.mkdir(parents=True)

    monkeypatch.setenv("ANALYSIS_ROOT", str(analysis))
    monkeypatch.setenv("WORKSPACE_ROOT", str(workspace))

    assert is_allowed_path(str(analysis)) is True
    assert is_allowed_path(str(analysis / "repo")) is True
    assert is_allowed_path(str(workspace)) is True
    assert is_allowed_path(str(workspace / "project" / "src")) is True

    assert is_allowed_path(str(tmp_path / "analysis_evil")) is False
    assert is_allowed_path("/etc") is False


def test_workspace_routes_return_roots_and_tree(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    analysis = tmp_path / "analysis"
    workspace = tmp_path / "workspace"
    repo = analysis / "repo"
    (repo / "src").mkdir(parents=True)
    (repo / "src" / "main.py").write_text("print('ok')\n", encoding="utf-8")
    (workspace / "reports").mkdir(parents=True)

    monkeypatch.setenv("ANALYSIS_ROOT", str(analysis))
    monkeypatch.setenv("WORKSPACE_ROOT", str(workspace))

    app = FastAPI()
    register_workspace_routes(app)
    client = TestClient(app)

    roots_response = client.get("/workspace/roots")
    assert roots_response.status_code == 200
    roots = roots_response.json()["roots"]
    assert roots[0]["label"] == "sandbox"
    assert roots[1]["label"] == "workspace"

    tree_response = client.get("/workspace/tree", params={"path": str(repo)})
    assert tree_response.status_code == 200
    payload = tree_response.json()
    assert payload["path"] == str(repo.resolve())
    assert payload["totalFiles"] == 1
    assert payload["totalDirs"] == 1
    assert isinstance(payload["tree"], list)


def test_workspace_tree_rejects_invalid_paths(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    analysis = tmp_path / "analysis"
    workspace = tmp_path / "workspace"
    analysis.mkdir(parents=True)
    workspace.mkdir(parents=True)

    monkeypatch.setenv("ANALYSIS_ROOT", str(analysis))
    monkeypatch.setenv("WORKSPACE_ROOT", str(workspace))

    app = FastAPI()
    register_workspace_routes(app)
    client = TestClient(app)

    forbidden = client.get("/workspace/tree", params={"path": "/etc"})
    assert forbidden.status_code == 403

    missing = client.get("/workspace/tree", params={"path": str(analysis / "does-not-exist")})
    assert missing.status_code == 404


def test_execute_delete_handles_file(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    workspace = tmp_path / "workspace"
    workspace.mkdir(parents=True)
    target_file = workspace / "notes.txt"
    target_file.write_text("some notes")
    analysis = tmp_path / "analysis"
    analysis.mkdir(parents=True)

    monkeypatch.setenv("ANALYSIS_ROOT", str(analysis))
    monkeypatch.setenv("WORKSPACE_ROOT", str(workspace))

    app = FastAPI()
    register_workspace_routes(app)
    client = TestClient(app)

    res = client.post(
        "/workspace/execute-delete",
        json={"path": str(target_file), "location": "workspace"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "deleted"
    assert "size_freed_mb" in data
    assert not target_file.exists()


def test_execute_delete_handles_directory(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    workspace = tmp_path / "workspace"
    repo = workspace / "myrepo"
    repo.mkdir(parents=True)
    (repo / "file.py").write_text("pass")
    analysis = tmp_path / "analysis"
    analysis.mkdir(parents=True)

    monkeypatch.setenv("ANALYSIS_ROOT", str(analysis))
    monkeypatch.setenv("WORKSPACE_ROOT", str(workspace))

    app = FastAPI()
    register_workspace_routes(app)
    client = TestClient(app)

    res = client.post(
        "/workspace/execute-delete",
        json={"path": str(repo), "location": "workspace"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "deleted"
    assert not repo.exists()


def test_register_workspace_routes_is_idempotent() -> None:
    app = FastAPI()
    register_workspace_routes(app)
    register_workspace_routes(app)

    paths = [route.path for route in app.routes]
    assert paths.count("/workspace/roots") == 1
    assert paths.count("/workspace/tree") == 1
