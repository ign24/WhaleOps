"""Tier 0 query classifier — deterministic, zero-LLM intent detection.

Returns an IntentClass before any LLM is invoked. Used to route conversational
queries to the fast ``chat`` mode, bypassing the full analyze pipeline.
"""

from __future__ import annotations

import enum
import re


class IntentClass(enum.Enum):
    """Possible intent classifications for a user message."""

    CHAT = "chat"
    UNKNOWN = "unknown"


# ---------------------------------------------------------------------------
# Pattern sets — conservative: match only when the ENTIRE message (after
# stripping whitespace and punctuation) clearly signals conversational intent.
# Analysis keywords take precedence — if any are present, return UNKNOWN.
# ---------------------------------------------------------------------------

_ANALYSIS_KEYWORDS: re.Pattern[str] = re.compile(
    r"""
    \b(
        analiz[aá]   |   # analiza / analizá / análisis
        analis[i]s   |   # analisis
        review       |
        refactor     |   # refactor / refactorizá
        refactoriz   |
        securit[y]   |   # security
        vulnerabilid |   # vulnerabilidad
        auditor      |   # auditoría
        test[s]?     |   # test / tests
        ejecut[a]    |   # ejecuta
        repositori   |   # repositorio
        repo\b       |
        github\.com  |
        \.git\b      |
        docstring    |
        coverage     |
        lint         |
        deploy       |
        docker       |
        commit       |
        push\b       |
        pull\s+request|
        hacé\s+un\s+code  # hacé un code review
    )\b
    """,
    re.IGNORECASE | re.VERBOSE,
)

_GREETINGS: re.Pattern[str] = re.compile(
    r"""
    ^(
        hola            |
        hi(\s+there)?\b |
        hey\b           |
        buenas(\s+(tardes|noches|d[ií]as))?\b|   # buenas / buenas tardes / buenas noches
        buenos\s+d[ií]as|
        good\s+morning  |
        good\s+afternoon|
        good\s+evening  |
        buen\s+d[ií]a
    )[!?.,\s]*$
    """,
    re.IGNORECASE | re.VERBOSE,
)

_AFFIRMATIONS: re.Pattern[str] = re.compile(
    r"""
    ^(
        ok\b            |
        dale\b          |
        entendido\b     |
        perfecto\b      |
        gracias\b       |   # gracias / muchas gracias
        muchas\s+gracias|
        de\s+nada\b     |
        understood\b    |
        got\s+it\b      |
        thanks\b        |
        thank\s+you\b   |
        genial\b        |
        excelente\b     |
        listo\b         |
        claro\b         |
        sure\b
    )[!?.,\s]*$
    """,
    re.IGNORECASE | re.VERBOSE,
)

_CAPABILITY_QUESTIONS: re.Pattern[str] = re.compile(
    r"""
    ^(
        help\b                  |
        ayuda\b                 |
        ayudame\b               |
        ayud[aá]\b              |
        qu[eé]\s+pod[eé]s\s+hacer|   # qué podés hacer
        what\s+can\s+you\s+do   |
        c[oó]mo\s+me\s+ayud[aá]s|   # cómo me ayudás
        qu[eé]\s+sab[eé]s       |   # qué sabés
        qu[eé]\s+hac[eé]s       |   # qué hacés
        para\s+qu[eé]\s+sirv[eé]s    # para qué servís
    )[!?.,\s]*$
    """,
    re.IGNORECASE | re.VERBOSE,
)


class QueryClassifier:
    """Stateless, deterministic classifier for pre-dispatch intent detection.

    Uses regex pattern matching only — no LLM, no network calls, no state.
    Conservative by design: only classifies as CHAT when the signal is
    unambiguous. Everything else returns UNKNOWN, preserving existing routing.
    """

    @staticmethod
    def classify(text: str) -> IntentClass:
        """Classify user message intent.

        Args:
            text: Raw user message text.

        Returns:
            IntentClass.CHAT if the message is clearly conversational.
            IntentClass.UNKNOWN for everything else (defaults to existing routing).

        Example:
            >>> QueryClassifier.classify("hola")
            <IntentClass.CHAT: 'chat'>
            >>> QueryClassifier.classify("analizá el repo")
            <IntentClass.UNKNOWN: 'unknown'>
        """
        stripped = text.strip()
        if not stripped:
            return IntentClass.UNKNOWN

        # Analysis keywords take absolute precedence — never classify as CHAT
        # if the message contains any analysis signal.
        if _ANALYSIS_KEYWORDS.search(stripped):
            return IntentClass.UNKNOWN

        if (
            _GREETINGS.match(stripped)
            or _AFFIRMATIONS.match(stripped)
            or _CAPABILITY_QUESTIONS.match(stripped)
        ):
            return IntentClass.CHAT

        return IntentClass.UNKNOWN
