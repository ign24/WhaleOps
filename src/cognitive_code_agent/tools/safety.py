import os
import re
from enum import Enum


class SafetyTier(str, Enum):
    TIER_1_AUTO = "TIER_1_AUTO"
    TIER_2_CONFIRM = "TIER_2_CONFIRM"
    TIER_3_BLOCKED = "TIER_3_BLOCKED"


class SafetyMode(str, Enum):
    STRICT = "strict"
    STANDARD = "standard"
    PERMISSIVE = "permissive"


TIER_3_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in [
        r"\bsudo\b",
        r"\bsu\s+-",
        r"\bdoas\b",
        r"rm\s+-[rf]*r[rf]*\s",
        r"\bmkfs\b",
        r"\bdd\s+if=/dev/(zero|urandom)",
        r"\b(reboot|shutdown|poweroff|halt)\b",
        r"curl[^|]*\|[^|]*\b(bash|sh|zsh|fish|python|perl|ruby)\b",
        r"wget[^|]*\|[^|]*\b(bash|sh|zsh|fish|python|perl|ruby)\b",
        r"\|[^|]*\b(bash|sh|zsh|fish)\b\s*$",
        r"base64\s+-d[^|]*\|[^|]*\b(bash|sh)\b",
        r"\$\([^)]*\brm\b",
        r"`[^`]*\brm\b",
        r"[;&|]\s*rm\s+",
        r"[;&|]\s*sudo\b",
        r">\s*/etc/",
        r">>\s*/etc/(passwd|shadow|sudoers)",
        r"\b(chmod\s+777\s+/|chmod\s+[0-7]*[02467][0-7]*\s+/)",
        r":\s*\(\s*\)\s*\{",
        r"\b(find\b.*\s-delete\b|find\b.*-exec\s+rm\b)",
        r"\bxargs\s+(rm|shred)\b",
        r"\b(ssh|scp)\b",
        r"\brsync\b.*:",
        r"\b(history\s+-c|unset\s+HISTFILE)\b",
    ]
]


TIER_1_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in [
        r"^ls(\s|$)",
        r"^cat\s+",
        r"^head\s+",
        r"^tail\s+",
        r"^grep\s+",
        r"^find\s+",
        r"^wc\s+",
        r"^sort\s+",
        r"^uniq\s+",
        r"^cut\s+",
        r"^awk\s+",
        r"^sed\s+-n\s+",
        r"^diff\s+",
        r"^pwd$",
        r"^whoami$",
        r"^id$",
        r"^date$",
        r"^env$",
        r"^printenv\s+",
        r"^which\s+",
        r"^tree(\s|$)",
        r"^git\s+(status|log|diff|show|branch|remote|fetch|stash\s+list)",
        r"^pytest(\s|$)",
        r"^ruff\s+check(\s|$)",
        r"^(npx\s+)?eslint\s+",
        r"^semgrep\s+",
        r"^bandit\s+",
        r"^trivy\s+",
        r"^gitleaks\s+",
        r"^npm\s+(test|run\s+test|run\s+lint|list|info|outdated)",
        r"^(python3?|pip3?|node|npm|git|pytest|ruff|semgrep|bandit|trivy|gitleaks)\s+--version",
    ]
]


TIER_2_SIGNALS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in [
        r"\b(rm|mv|cp|mkdir|touch|chmod|chown)\b",
        r"\b(pip3?\s+install|uv\s+add|npm\s+install)\b",
        r"\bgit\s+(commit|push|pull|checkout|reset|merge|rebase|tag|add)\b",
        r"\b(systemctl\s+(start|stop|restart|enable|disable|reload))\b",
        r"\bdocker\s+(start|stop|restart|rm|rmi|pull|run|exec)\b",
        r">|>>",
    ]
]


def classify_command(command: str) -> SafetyTier:
    cmd = command.strip()
    if not cmd:
        return SafetyTier.TIER_2_CONFIRM

    for pattern in TIER_3_PATTERNS:
        if pattern.search(cmd):
            return SafetyTier.TIER_3_BLOCKED

    for pattern in TIER_1_PATTERNS:
        if pattern.match(cmd):
            has_tier2_signal = any(signal.search(cmd) for signal in TIER_2_SIGNALS)
            if not has_tier2_signal:
                return SafetyTier.TIER_1_AUTO
            break

    for pattern in TIER_2_SIGNALS:
        if pattern.search(cmd):
            return SafetyTier.TIER_2_CONFIRM

    return SafetyTier.TIER_2_CONFIRM


def get_safety_mode() -> SafetyMode:
    value = os.getenv("SAFETY_MODE", "strict").strip().lower()
    if value in {SafetyMode.STRICT.value, SafetyMode.STANDARD.value, SafetyMode.PERMISSIVE.value}:
        return SafetyMode(value)
    return SafetyMode.STRICT
