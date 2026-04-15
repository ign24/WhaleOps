"""Ops tools — read-only NAT-registered tools that query Docker on D09.

All three tools are Tier 0 (read-only). Write operations (restart, redeploy)
are reserved for a future change with explicit safety tier enforcement.

Do NOT add ``from __future__ import annotations`` — NAT's FunctionInfo
introspection reads inspect.signature annotations at runtime and fails on
Python 3.11 when annotations are deferred strings.
"""

import logging

import docker
import docker.errors
from pydantic import Field

from nat.builder.builder import Builder
from nat.builder.function_info import FunctionInfo
from nat.cli.register_workflow import register_function
from nat.data_models.function import FunctionBaseConfig

logger = logging.getLogger(__name__)

MAX_LOG_LINES = 500


# ---------------------------------------------------------------------------
# Docker client factory
# ---------------------------------------------------------------------------

def _get_docker_client() -> docker.DockerClient:
    """Return a Docker client connected via the local socket (DOCKER_HOST or default)."""
    try:
        return docker.from_env()
    except docker.errors.DockerException as exc:
        raise RuntimeError(
            f"Cannot connect to Docker daemon. "
            f"Ensure the Docker socket is accessible: {exc}"
        ) from exc


# ---------------------------------------------------------------------------
# Internal helpers — extracted for unit testability
# ---------------------------------------------------------------------------

async def _do_list_containers(client: docker.DockerClient, all_containers: bool) -> str:
    """List containers and return a formatted table string."""
    try:
        containers = client.containers.list(all=all_containers)
        if not containers:
            scope = "containers" if all_containers else "running containers"
            return f"No {scope} found on this host."
        lines = []
        for c in containers:
            # Use attrs["Config"]["Image"] to avoid a second HTTP call to
            # /images/{sha}/json — that call fails with 404 when the image has
            # been deleted but the container still exists (orphan container).
            image_name = c.attrs.get("Config", {}).get("Image", "unknown")
            status_label = " [STOPPED]" if c.status != "running" else ""
            lines.append(f"  {c.name:<35} {c.status:<12} {c.short_id}  {image_name}{status_label}")
        header = f"  {'NAME':<35} {'STATUS':<12} {'ID'}      IMAGE"
        return header + "\n" + "\n".join(lines)
    except docker.errors.DockerException as exc:
        logger.warning("list_containers: Docker error: %s", exc)
        return f"Error: Docker daemon returned an error — {exc}"


async def _do_get_container_logs(
    client: docker.DockerClient, container: str, lines: int
) -> str:
    """Fetch log tail for a container and return as a string."""
    safe_lines = min(lines, MAX_LOG_LINES)
    try:
        c = client.containers.get(container)
        raw = c.logs(tail=safe_lines, timestamps=True)
        text = raw.decode("utf-8", errors="replace").strip()
        if not text:
            return f"No log output found for container '{container}'."
        return text
    except docker.errors.NotFound:
        return f"Error: container '{container}' not found on this host."
    except docker.errors.DockerException as exc:
        logger.warning("get_container_logs: Docker error for container=%s: %s", container, exc)
        return f"Error: Docker daemon returned an error for container '{container}' — {exc}"


async def _do_inspect_container(client: docker.DockerClient, container: str) -> str:
    """Return a structured inspect summary for a container."""
    try:
        c = client.containers.get(container)
        attrs = c.attrs
        state = attrs.get("State", {})
        host_cfg = attrs.get("HostConfig", {})
        restart_count = attrs.get("RestartCount", 0)
        restart_policy = host_cfg.get("RestartPolicy", {}).get("Name", "none")
        image_name = c.attrs.get("Config", {}).get("Image", "unknown")
        exit_code = state.get("ExitCode", 0)
        return (
            f"Container:     {c.name}\n"
            f"ID:            {c.short_id}\n"
            f"Image:         {image_name}\n"
            f"Status:        {state.get('Status', 'unknown')}\n"
            f"Running:       {state.get('Running', False)}\n"
            f"Exit code:     {exit_code}\n"
            f"Restart count: {restart_count}\n"
            f"Restart policy:{restart_policy}"
        )
    except docker.errors.NotFound:
        return f"Error: container '{container}' not found on this host."
    except docker.errors.DockerException as exc:
        logger.warning("inspect_container: Docker error for container=%s: %s", container, exc)
        return f"Error: Docker daemon returned an error for container '{container}' — {exc}"


# ---------------------------------------------------------------------------
# NAT-registered tools
# ---------------------------------------------------------------------------

class ListContainersConfig(FunctionBaseConfig, name="list_containers"):
    description: str = Field(
        default=(
            "List Docker containers on this host. "
            "By default shows only running containers. "
            "Set all_containers=true to include stopped/exited containers."
        ),
    )


@register_function(config_type=ListContainersConfig)
async def list_containers_tool(config: ListContainersConfig, builder: Builder):
    async def _run(all_containers: bool = False) -> str:
        """List Docker containers on this host.

        Args:
            all_containers: If true, include stopped and exited containers.
                            Defaults to false (running only).
        """
        client = _get_docker_client()
        return await _do_list_containers(client, all_containers)

    yield FunctionInfo.from_fn(_run, description=config.description)


class GetContainerLogsConfig(FunctionBaseConfig, name="get_container_logs"):
    description: str = Field(
        default=(
            "Retrieve recent log output for a Docker container on this host. "
            "Specify the container name or ID and optionally the number of lines "
            "(default 50, max 500). Timestamps are included."
        ),
    )


@register_function(config_type=GetContainerLogsConfig)
async def get_container_logs_tool(config: GetContainerLogsConfig, builder: Builder):
    async def _run(container: str, lines: int = 50) -> str:
        """Fetch the last N log lines (with timestamps) for a Docker container.

        Args:
            container: Container name or short ID.
            lines:     Number of log lines to retrieve (default 50, max 500).
        """
        client = _get_docker_client()
        return await _do_get_container_logs(client, container, lines)

    yield FunctionInfo.from_fn(_run, description=config.description)


class InspectContainerConfig(FunctionBaseConfig, name="inspect_container"):
    description: str = Field(
        default=(
            "Inspect a Docker container on this host: status, image, exit code, "
            "restart count, and restart policy."
        ),
    )


@register_function(config_type=InspectContainerConfig)
async def inspect_container_tool(config: InspectContainerConfig, builder: Builder):
    async def _run(container: str) -> str:
        """Return a structured summary of a Docker container's current state.

        Args:
            container: Container name or short ID.
        """
        client = _get_docker_client()
        return await _do_inspect_container(client, container)

    yield FunctionInfo.from_fn(_run, description=config.description)
