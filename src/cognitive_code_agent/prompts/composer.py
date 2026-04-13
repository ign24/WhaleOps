import logging
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import yaml

logger = logging.getLogger(__name__)


REPO_ROOT = Path(__file__).resolve().parents[3]


@dataclass(frozen=True)
class SkillConfig:
    id: str
    file: str
    category: str
    priority: int
    enabled: bool
    required_tools: tuple[str, ...]
    triggers: tuple[str, ...]
    max_chars: int | None = None


@dataclass(frozen=True)
class SkillRegistry:
    default_max_active_skills: int
    default_max_skill_chars: int
    total_skill_budget_chars: int
    skills: tuple[SkillConfig, ...]


def resolve_repo_path(path_text: str) -> Path:
    path = Path(path_text)
    if path.is_absolute():
        return path
    return REPO_ROOT / path


@lru_cache(maxsize=32)
def read_text_file(path_text: str) -> str:
    return resolve_repo_path(path_text).read_text(encoding="utf-8")


@lru_cache(maxsize=8)
def load_registry(registry_path: str) -> SkillRegistry:
    raw = yaml.safe_load(read_text_file(registry_path))
    items = []
    for item in raw.get("skills", []):
        max_chars_val = item.get("max_chars")
        items.append(
            SkillConfig(
                id=str(item["id"]),
                file=str(item["file"]),
                category=str(item.get("category", "misc")),
                priority=int(item.get("priority", 999)),
                enabled=bool(item.get("enabled", True)),
                required_tools=tuple(str(x) for x in item.get("required_tools", [])),
                triggers=tuple(str(x).lower() for x in item.get("triggers", [])),
                max_chars=int(max_chars_val) if max_chars_val is not None else None,
            )
        )
    return SkillRegistry(
        default_max_active_skills=int(raw.get("default_max_active_skills", 2)),
        default_max_skill_chars=int(raw.get("default_max_skill_chars", 8000)),
        total_skill_budget_chars=int(raw.get("total_skill_budget_chars", 16000)),
        skills=tuple(items),
    )


def _trigger_score(message_text: str, triggers: tuple[str, ...]) -> int:
    score = 0
    for trigger in triggers:
        if not trigger:
            continue
        pattern = rf"\b{re.escape(trigger)}\b"
        score += len(re.findall(pattern, message_text))
    return score


def _tool_available(tool_name: str, available: set[str]) -> bool:
    """Check if a required tool is in the available set.

    Handles MCP tools whose runtime names include a function-group prefix
    (e.g., ``fs_tools_write__write_file`` matches required tool ``write_file``).
    """
    if tool_name in available:
        return True
    suffix = f"__{tool_name}"
    return any(t.endswith(suffix) for t in available)


def select_skills(
    *,
    user_message: str,
    available_tools: list[str],
    registry_path: str,
    max_active_skills: int | None = None,
) -> list[SkillConfig]:
    registry = load_registry(registry_path)
    max_skills = max_active_skills or registry.default_max_active_skills
    normalized = user_message.lower()
    available = set(available_tools)

    ranked: list[tuple[int, int, SkillConfig]] = []
    for skill in registry.skills:
        if not skill.enabled:
            continue
        if any(not _tool_available(tool, available) for tool in skill.required_tools):
            continue
        score = _trigger_score(normalized, skill.triggers)
        if score <= 0:
            continue
        ranked.append((score, skill.priority, skill))

    ranked.sort(key=lambda item: (-item[0], item[1], item[2].id))
    return [item[2] for item in ranked[:max_skills]]


def detect_analysis_mode(user_message: str) -> str | None:
    normalized = user_message.lower()

    quick_patterns = (
        "quick review",
        "quick analysis",
        "analisis rapido",
        "/quick-review",
    )
    full_patterns = (
        "full analysis",
        "analisis completo",
        "analizar repositorio",
        "review completo",
        "analiza el repo",
        "/analyze",
    )

    if any(pattern in normalized for pattern in quick_patterns):
        return "QUICK"

    if any(pattern in normalized for pattern in full_patterns):
        return "FULL"

    dimension_keywords = (
        "code review",
        "security",
        "qa",
        "test",
        "documentation",
        "docs",
    )
    matched_dimensions = sum(1 for keyword in dimension_keywords if keyword in normalized)
    if matched_dimensions >= 3:
        return "FULL"

    return None


def _truncate_skill_content(content: str, max_chars: int, skill_file: str) -> str:
    """Truncate skill content at the nearest ``##`` heading boundary.

    If *content* fits within *max_chars*, it is returned unchanged. Otherwise
    the content is cut at the last ``##`` heading boundary at or before
    *max_chars* and a truncation notice is appended.
    """
    if len(content) <= max_chars:
        return content

    truncated = content[:max_chars]
    # Find last ## heading boundary within the truncated slice
    last_heading = truncated.rfind("\n##")
    if last_heading > 0:
        truncated = truncated[:last_heading]
    return truncated.rstrip() + f"\n\n[SKILL TRUNCATED: full content at {skill_file}]"


def build_active_skills_block(
    *,
    user_message: str,
    available_tools: list[str],
    registry_path: str,
    max_active_skills: int | None = None,
) -> tuple[list[str], str]:
    registry = load_registry(registry_path)
    selected = select_skills(
        user_message=user_message,
        available_tools=available_tools,
        registry_path=registry_path,
        max_active_skills=max_active_skills,
    )
    if not selected:
        return ([], "")

    skill_ids = [skill.id for skill in selected]
    analysis_mode = detect_analysis_mode(user_message)
    sections = [
        "<active_skills>",
        "The following skill modules are active for this request.",
        "Apply them while preserving global safety and priority policies.",
        "",
    ]
    if analysis_mode is not None:
        sections.append(f"Detected analysis mode: {analysis_mode}")
        sections.append("Apply full_analysis_protocol with mode-appropriate scope and budget.")
        sections.append("")

    total_budget = registry.total_skill_budget_chars
    remaining_budget = total_budget
    for skill in selected:
        per_skill_cap = (
            skill.max_chars if skill.max_chars is not None else registry.default_max_skill_chars
        )
        # Apply total budget as a tighter cap on lower-priority skills
        effective_cap = min(per_skill_cap, remaining_budget)
        raw_content = read_text_file(skill.file).strip()
        content = _truncate_skill_content(raw_content, effective_cap, skill.file)
        remaining_budget -= len(content)
        sections.append(f"### Skill: {skill.id}")
        sections.append(content)
        sections.append("")
        if remaining_budget <= 0:
            break

    sections.append("</active_skills>")
    return (skill_ids, "\n".join(sections).strip())


_PLACEHOLDER_RE = re.compile(r"\{\{(\w+)\}\}")


def render_template(template: str, config: dict[str, str]) -> str:
    """Replace ``{{key}}`` placeholders with values from *config*.

    Unresolved placeholders are replaced with an empty string and a
    warning is logged.
    """

    def _replace(match: re.Match[str]) -> str:
        key = match.group(1)
        if key in config:
            return str(config[key])
        logger.warning("Unresolved prompt placeholder: {{%s}}", key)
        return ""

    return _PLACEHOLDER_RE.sub(_replace, template)


@lru_cache(maxsize=1)
def load_prompt_config() -> dict[str, str]:
    """Load prompt configuration from ``prompt_config.yml``.

    Returns an empty dict if the file is missing or unreadable.
    """
    config_path = REPO_ROOT / "src" / "cognitive_code_agent" / "configs" / "prompt_config.yml"
    try:
        raw = yaml.safe_load(config_path.read_text(encoding="utf-8"))
        if not isinstance(raw, dict):
            return {}
        return {str(k): str(v) for k, v in raw.items()}
    except Exception:
        logger.warning("Failed to load prompt_config from %s", config_path)
        return {}


def load_base_prompt(base_prompt_path: str, prompt_config: dict[str, str] | None = None) -> str:
    """Load a prompt file and render ``{{variable}}`` placeholders.

    If *prompt_config* is ``None``, the config is auto-loaded from
    ``config.yml`` (cached after first read).
    """
    text = read_text_file(base_prompt_path).strip()
    config = prompt_config if prompt_config is not None else load_prompt_config()
    if config:
        text = render_template(text, config)
    return text
