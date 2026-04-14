"""Unit tests for ops_api — Docker status and notes REST endpoints."""

from __future__ import annotations

import os
import sqlite3
import tempfile
from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from cognitive_code_agent.ops_api import register_ops_routes

pytestmark = pytest.mark.unit


def _make_app() -> tuple[FastAPI, TestClient]:
    app = FastAPI()
    register_ops_routes(app)
    return app, TestClient(app)


def _mock_container(
    name: str = "my-container",
    short_id: str = "abc123def456",
    image_tags: list[str] | None = None,
    status: str = "running",
    state_status: str = "running",
    ports: dict | None = None,
    created_at: str = "2026-04-13T10:00:00Z",
    started_at: str = "2026-04-13T10:00:05Z",
) -> MagicMock:
    c = MagicMock()
    c.name = name
    c.short_id = short_id
    c.image.tags = image_tags if image_tags is not None else ["nginx:latest"]
    c.status = status
    c.ports = ports or {"80/tcp": [{"HostIp": "0.0.0.0", "HostPort": "8080"}]}
    c.attrs = {
        "State": {"Status": state_status, "StartedAt": started_at},
        "Created": created_at,
    }
    return c


# ---------------------------------------------------------------------------
# GET /api/ops/status
# ---------------------------------------------------------------------------


class TestOpsStatus:
    def test_returns_200_with_containers(self):
        _, client = _make_app()
        containers = [_mock_container()]
        mock_docker = MagicMock()
        mock_docker.containers.list.return_value = containers

        with patch("cognitive_code_agent.ops_api.docker.from_env", return_value=mock_docker):
            response = client.get("/api/ops/status")

        assert response.status_code == 200
        data = response.json()
        assert "containers" in data
        assert len(data["containers"]) == 1
        item = data["containers"][0]
        assert item["name"] == "my-container"
        assert item["id"] == "abc123def456"
        assert item["image"] == "nginx:latest"
        assert item["status"] == "running"
        assert item["state"] == "running"

    def test_returns_503_when_docker_unavailable(self):
        import docker.errors

        _, client = _make_app()

        with patch(
            "cognitive_code_agent.ops_api.docker.from_env",
            side_effect=docker.errors.DockerException("socket not found"),
        ):
            response = client.get("/api/ops/status")

        assert response.status_code == 503
        data = response.json()
        assert "error" in data
        assert "Docker daemon unavailable" in data["error"]

    def test_returns_all_containers_including_stopped(self):
        _, client = _make_app()
        containers = [
            _mock_container("running-c", status="running", state_status="running"),
            _mock_container("stopped-c", status="exited", state_status="exited"),
        ]
        mock_docker = MagicMock()
        mock_docker.containers.list.return_value = containers

        with patch("cognitive_code_agent.ops_api.docker.from_env", return_value=mock_docker):
            response = client.get("/api/ops/status")

        assert response.status_code == 200
        # Must pass all=True to list()
        mock_docker.containers.list.assert_called_once_with(all=True)
        data = response.json()
        assert len(data["containers"]) == 2

    def test_ports_formatted_as_list_of_strings(self):
        _, client = _make_app()
        c = _mock_container(ports={"80/tcp": [{"HostIp": "0.0.0.0", "HostPort": "8080"}]})
        mock_docker = MagicMock()
        mock_docker.containers.list.return_value = [c]

        with patch("cognitive_code_agent.ops_api.docker.from_env", return_value=mock_docker):
            response = client.get("/api/ops/status")

        ports = response.json()["containers"][0]["ports"]
        assert isinstance(ports, list)
        assert all(isinstance(p, str) for p in ports)
        assert "8080:80/tcp" in ports

    def test_untagged_image_returns_untagged(self):
        _, client = _make_app()
        c = _mock_container(image_tags=[])
        mock_docker = MagicMock()
        mock_docker.containers.list.return_value = [c]

        with patch("cognitive_code_agent.ops_api.docker.from_env", return_value=mock_docker):
            response = client.get("/api/ops/status")

        assert response.json()["containers"][0]["image"] == "untagged"

    def test_empty_container_list_returns_empty_array(self):
        _, client = _make_app()
        mock_docker = MagicMock()
        mock_docker.containers.list.return_value = []

        with patch("cognitive_code_agent.ops_api.docker.from_env", return_value=mock_docker):
            response = client.get("/api/ops/status")

        assert response.status_code == 200
        assert response.json() == {"containers": []}

    def test_port_without_host_binding_shows_container_port(self):
        _, client = _make_app()
        c = _mock_container(ports={"5432/tcp": None})
        mock_docker = MagicMock()
        mock_docker.containers.list.return_value = [c]

        with patch("cognitive_code_agent.ops_api.docker.from_env", return_value=mock_docker):
            response = client.get("/api/ops/status")

        ports = response.json()["containers"][0]["ports"]
        assert "5432/tcp" in ports


# ---------------------------------------------------------------------------
# GET /api/ops/notes
# ---------------------------------------------------------------------------


def _make_temp_db_with_notes(notes: list[dict]) -> str:
    """Create a temp SQLite DB with ops_notes table populated."""
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    conn = sqlite3.connect(path)
    conn.execute("""
        CREATE TABLE ops_notes (
            id TEXT PRIMARY KEY,
            container_name TEXT NOT NULL DEFAULT '',
            note_type TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )
    """)
    for n in notes:
        conn.execute(
            "INSERT INTO ops_notes (id, container_name, note_type, content, created_at) VALUES (?,?,?,?,?)",
            (n["id"], n.get("container_name", ""), n["note_type"], n["content"], n["created_at"]),
        )
    conn.commit()
    conn.close()
    return path


class TestOpsNotes:
    def test_returns_200_with_notes(self):
        notes = [
            {
                "id": "n1",
                "container_name": "nginx",
                "note_type": "anomaly",
                "content": "OOM kill",
                "created_at": 1000,
            },
            {
                "id": "n2",
                "container_name": "",
                "note_type": "pattern",
                "content": "restarts at 3am",
                "created_at": 900,
            },
        ]
        db_path = _make_temp_db_with_notes(notes)
        _, client = _make_app()

        with patch.dict(os.environ, {"NOTES_DB_PATH": db_path}):
            response = client.get("/api/ops/notes")

        assert response.status_code == 200
        data = response.json()
        assert "notes" in data
        assert len(data["notes"]) == 2
        # Ordered by created_at DESC
        assert data["notes"][0]["id"] == "n1"

    def test_returns_empty_list_when_db_empty(self):
        db_path = _make_temp_db_with_notes([])
        _, client = _make_app()

        with patch.dict(os.environ, {"NOTES_DB_PATH": db_path}):
            response = client.get("/api/ops/notes")

        assert response.status_code == 200
        assert response.json() == {"notes": []}

    def test_returns_empty_list_when_no_db_path(self):
        _, client = _make_app()
        env = {k: v for k, v in os.environ.items() if k != "NOTES_DB_PATH"}

        with patch.dict(os.environ, env, clear=True):
            response = client.get("/api/ops/notes")

        assert response.status_code == 200
        assert response.json() == {"notes": []}

    def test_filter_by_note_type(self):
        notes = [
            {
                "id": "n1",
                "container_name": "",
                "note_type": "anomaly",
                "content": "crash",
                "created_at": 1000,
            },
            {
                "id": "n2",
                "container_name": "",
                "note_type": "pattern",
                "content": "slow",
                "created_at": 900,
            },
        ]
        db_path = _make_temp_db_with_notes(notes)
        _, client = _make_app()

        with patch.dict(os.environ, {"NOTES_DB_PATH": db_path}):
            response = client.get("/api/ops/notes?note_type=anomaly")

        data = response.json()
        assert len(data["notes"]) == 1
        assert data["notes"][0]["note_type"] == "anomaly"

    def test_filter_by_container_name(self):
        notes = [
            {
                "id": "n1",
                "container_name": "nginx",
                "note_type": "pattern",
                "content": "A",
                "created_at": 1000,
            },
            {
                "id": "n2",
                "container_name": "redis",
                "note_type": "pattern",
                "content": "B",
                "created_at": 900,
            },
        ]
        db_path = _make_temp_db_with_notes(notes)
        _, client = _make_app()

        with patch.dict(os.environ, {"NOTES_DB_PATH": db_path}):
            response = client.get("/api/ops/notes?container_name=nginx")

        data = response.json()
        assert len(data["notes"]) == 1
        assert data["notes"][0]["container_name"] == "nginx"

    def test_limit_respected(self):
        notes = [
            {
                "id": f"n{i}",
                "container_name": "",
                "note_type": "pattern",
                "content": f"note {i}",
                "created_at": i,
            }
            for i in range(20)
        ]
        db_path = _make_temp_db_with_notes(notes)
        _, client = _make_app()

        with patch.dict(os.environ, {"NOTES_DB_PATH": db_path}):
            response = client.get("/api/ops/notes?limit=5")

        assert len(response.json()["notes"]) == 5

    def test_limit_clamped_to_50(self):
        notes = [
            {
                "id": f"n{i}",
                "container_name": "",
                "note_type": "pattern",
                "content": f"note {i}",
                "created_at": i,
            }
            for i in range(60)
        ]
        db_path = _make_temp_db_with_notes(notes)
        _, client = _make_app()

        with patch.dict(os.environ, {"NOTES_DB_PATH": db_path}):
            response = client.get("/api/ops/notes?limit=100")

        assert len(response.json()["notes"]) <= 50

    def test_note_fields_present(self):
        notes = [
            {
                "id": "n1",
                "container_name": "nginx",
                "note_type": "anomaly",
                "content": "OOM",
                "created_at": 1714000000,
            },
        ]
        db_path = _make_temp_db_with_notes(notes)
        _, client = _make_app()

        with patch.dict(os.environ, {"NOTES_DB_PATH": db_path}):
            response = client.get("/api/ops/notes")

        note = response.json()["notes"][0]
        assert "id" in note
        assert "container_name" in note
        assert "note_type" in note
        assert "content" in note
        assert "created_at" in note
        # created_at must be ISO string
        assert isinstance(note["created_at"], str)


# ---------------------------------------------------------------------------
# GET /api/ops/containers/{container}/inspect + /logs
# ---------------------------------------------------------------------------


class TestOpsContainerDrilldown:
    def test_inspect_returns_summary(self):
        _, client = _make_app()
        container = _mock_container(name="redis-cache", status="running", state_status="running")
        container.attrs.update(
            {
                "RestartCount": 2,
                "HostConfig": {"RestartPolicy": {"Name": "always"}},
                "State": {"Status": "running", "Running": True, "ExitCode": 0},
            }
        )

        mock_docker = MagicMock()
        mock_docker.containers.get.return_value = container

        with patch("cognitive_code_agent.ops_api.docker.from_env", return_value=mock_docker):
            response = client.get("/api/ops/containers/redis-cache/inspect")

        assert response.status_code == 200
        payload = response.json()["container"]
        assert payload["name"] == "redis-cache"
        assert payload["restart_count"] == 2
        assert payload["restart_policy"] == "always"

    def test_inspect_returns_404_for_missing_container(self):
        import docker.errors

        _, client = _make_app()
        mock_docker = MagicMock()
        mock_docker.containers.get.side_effect = docker.errors.NotFound("missing")

        with patch("cognitive_code_agent.ops_api.docker.from_env", return_value=mock_docker):
            response = client.get("/api/ops/containers/ghost/inspect")

        assert response.status_code == 404

    def test_logs_returns_payload(self):
        _, client = _make_app()
        container = _mock_container(name="nginx")
        container.logs.return_value = b"2026-04-14T01:00:00Z line1\n2026-04-14T01:00:01Z line2\n"
        mock_docker = MagicMock()
        mock_docker.containers.get.return_value = container

        with patch("cognitive_code_agent.ops_api.docker.from_env", return_value=mock_docker):
            response = client.get("/api/ops/containers/nginx/logs?lines=20")

        assert response.status_code == 200
        payload = response.json()
        assert payload["container"] == "nginx"
        assert "line1" in payload["logs"]
