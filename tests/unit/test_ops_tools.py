"""Unit tests for ops_tools — all Docker SDK calls mocked."""
from __future__ import annotations

from unittest.mock import MagicMock

import docker.errors
import pytest

pytestmark = pytest.mark.unit


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_container(
    name: str = "nginx",
    status: str = "running",
    image_tags: list[str] | None = None,
    short_id: str = "abc123",
) -> MagicMock:
    c = MagicMock()
    c.name = name
    c.status = status
    c.short_id = short_id
    c.image.tags = image_tags or [f"{name}:latest"]
    c.logs = MagicMock(return_value=b"line1\nline2\nline3")
    c.attrs = {
        "State": {"Status": status, "Running": status == "running", "ExitCode": 0},
        "Config": {"Image": name},
        "NetworkSettings": {"Ports": {}},
        "HostConfig": {"RestartPolicy": {"Name": "always"}},
        "RestartCount": 0,
    }
    return c


def _make_docker_client(containers: list | None = None) -> MagicMock:
    client = MagicMock()
    client.containers.list = MagicMock(return_value=containers or [])
    client.containers.get = MagicMock(return_value=_make_container())
    return client


# ---------------------------------------------------------------------------
# _do_list_containers
# ---------------------------------------------------------------------------

class TestDoListContainers:
    async def test_formats_running_containers(self) -> None:
        from cognitive_code_agent.tools import ops_tools

        containers = [
            _make_container("nginx", "running"),
            _make_container("redis", "running"),
        ]
        mock_client = _make_docker_client(containers)

        result = await ops_tools._do_list_containers(mock_client, all_containers=False)

        assert "nginx" in result
        assert "redis" in result
        assert "running" in result

    async def test_marks_exited_containers(self) -> None:
        from cognitive_code_agent.tools import ops_tools

        containers = [
            _make_container("nginx", "running"),
            _make_container("broken", "exited"),
        ]
        mock_client = _make_docker_client(containers)

        result = await ops_tools._do_list_containers(mock_client, all_containers=True)

        assert "broken" in result
        assert "exited" in result

    async def test_all_flag_passed_to_client(self) -> None:
        from cognitive_code_agent.tools import ops_tools

        mock_client = _make_docker_client()

        await ops_tools._do_list_containers(mock_client, all_containers=True)

        mock_client.containers.list.assert_called_once_with(all=True)

    async def test_empty_returns_descriptive_message(self) -> None:
        from cognitive_code_agent.tools import ops_tools

        mock_client = _make_docker_client([])

        result = await ops_tools._do_list_containers(mock_client, all_containers=False)

        assert result.strip() != ""
        assert "no" in result.lower() or "empty" in result.lower() or "container" in result.lower()

    async def test_returns_error_on_docker_exception(self) -> None:
        from cognitive_code_agent.tools import ops_tools

        mock_client = _make_docker_client()
        mock_client.containers.list.side_effect = docker.errors.DockerException("socket gone")

        result = await ops_tools._do_list_containers(mock_client, all_containers=False)

        assert "error" in result.lower()


# ---------------------------------------------------------------------------
# _do_get_container_logs
# ---------------------------------------------------------------------------

class TestDoGetContainerLogs:
    async def test_returns_log_string(self) -> None:
        from cognitive_code_agent.tools import ops_tools

        container = _make_container("nginx")
        container.logs.return_value = b"Apr 13 log line 1\nApr 13 log line 2"
        mock_client = _make_docker_client()
        mock_client.containers.get.return_value = container

        result = await ops_tools._do_get_container_logs(mock_client, "nginx", lines=50)

        assert "Apr 13 log line 1" in result
        assert "Apr 13 log line 2" in result

    async def test_calls_logs_with_tail(self) -> None:
        from cognitive_code_agent.tools import ops_tools

        container = _make_container("nginx")
        container.logs.return_value = b"log"
        mock_client = _make_docker_client()
        mock_client.containers.get.return_value = container

        await ops_tools._do_get_container_logs(mock_client, "nginx", lines=100)

        container.logs.assert_called_once_with(tail=100, timestamps=True)

    async def test_clamps_lines_to_500(self) -> None:
        from cognitive_code_agent.tools import ops_tools

        container = _make_container("nginx")
        container.logs.return_value = b"log"
        mock_client = _make_docker_client()
        mock_client.containers.get.return_value = container

        await ops_tools._do_get_container_logs(mock_client, "nginx", lines=9999)

        container.logs.assert_called_once_with(tail=500, timestamps=True)

    async def test_returns_error_on_not_found(self) -> None:
        from cognitive_code_agent.tools import ops_tools

        mock_client = _make_docker_client()
        mock_client.containers.get.side_effect = docker.errors.NotFound("no such container")

        result = await ops_tools._do_get_container_logs(mock_client, "ghost", lines=50)

        assert "not found" in result.lower() or "ghost" in result

    async def test_returns_error_on_docker_exception(self) -> None:
        from cognitive_code_agent.tools import ops_tools

        mock_client = _make_docker_client()
        mock_client.containers.get.side_effect = docker.errors.DockerException("daemon down")

        result = await ops_tools._do_get_container_logs(mock_client, "nginx", lines=50)

        assert "error" in result.lower()

    async def test_empty_log_returns_descriptive_message(self) -> None:
        from cognitive_code_agent.tools import ops_tools

        container = _make_container("nginx")
        container.logs.return_value = b""
        mock_client = _make_docker_client()
        mock_client.containers.get.return_value = container

        result = await ops_tools._do_get_container_logs(mock_client, "nginx", lines=50)

        assert result.strip() != ""


# ---------------------------------------------------------------------------
# _do_inspect_container
# ---------------------------------------------------------------------------

class TestDoInspectContainer:
    async def test_returns_status_and_image(self) -> None:
        from cognitive_code_agent.tools import ops_tools

        container = _make_container("nginx", "running")
        mock_client = _make_docker_client()
        mock_client.containers.get.return_value = container

        result = await ops_tools._do_inspect_container(mock_client, "nginx")

        assert "nginx" in result
        assert "running" in result

    async def test_returns_restart_count(self) -> None:
        from cognitive_code_agent.tools import ops_tools

        container = _make_container("nginx")
        container.attrs["RestartCount"] = 3
        mock_client = _make_docker_client()
        mock_client.containers.get.return_value = container

        result = await ops_tools._do_inspect_container(mock_client, "nginx")

        assert "3" in result

    async def test_returns_error_on_not_found(self) -> None:
        from cognitive_code_agent.tools import ops_tools

        mock_client = _make_docker_client()
        mock_client.containers.get.side_effect = docker.errors.NotFound("no such container")

        result = await ops_tools._do_inspect_container(mock_client, "ghost")

        assert "not found" in result.lower() or "ghost" in result

    async def test_returns_error_on_docker_exception(self) -> None:
        from cognitive_code_agent.tools import ops_tools

        mock_client = _make_docker_client()
        mock_client.containers.get.side_effect = docker.errors.DockerException("daemon down")

        result = await ops_tools._do_inspect_container(mock_client, "nginx")

        assert "error" in result.lower()
