"""Unit tests for the Tier 0 query classifier.

TDD: these tests were written before the regex patterns were implemented.
Each test maps to a spec scenario in specs/tier0-query-classifier/spec.md.
"""

from __future__ import annotations

import pytest

from cognitive_code_agent.routing.query_classifier import IntentClass
from cognitive_code_agent.routing.query_classifier import QueryClassifier


pytestmark = pytest.mark.unit


# ---------------------------------------------------------------------------
# CHAT: Greetings
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "text",
    [
        "hola",
        "Hola",
        "HOLA",
        "hola!",
        "  hola  ",
        "hi",
        "Hi there",
        "hey",
        "Hey!",
        "buenos días",
        "Buenos Días",
        "buenas",
        "buenas tardes",
        "good morning",
        "Good Morning",
    ],
)
def test_greetings_classified_as_chat(text: str) -> None:
    assert QueryClassifier.classify(text) == IntentClass.CHAT


# ---------------------------------------------------------------------------
# CHAT: Short affirmations / acknowledgements
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "text",
    [
        "ok",
        "OK",
        "Ok",
        "dale",
        "Dale",
        "entendido",
        "Entendido",
        "perfecto",
        "Perfecto",
        "gracias",
        "Gracias",
        "muchas gracias",
        "understood",
        "Understood",
        "got it",
        "Got it",
        "thanks",
        "Thank you",
    ],
)
def test_affirmations_classified_as_chat(text: str) -> None:
    assert QueryClassifier.classify(text) == IntentClass.CHAT


# ---------------------------------------------------------------------------
# CHAT: Capability questions
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "text",
    [
        "qué podés hacer",
        "Qué podés hacer?",
        "what can you do",
        "What can you do?",
        "cómo me ayudás",
        "Cómo me ayudás?",
        "help",
        "ayuda",
        "ayudame",
        "ayudá",
    ],
)
def test_capability_questions_classified_as_chat(text: str) -> None:
    assert QueryClassifier.classify(text) == IntentClass.CHAT


# ---------------------------------------------------------------------------
# UNKNOWN: Analysis intent must NOT be classified as CHAT
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "text",
    [
        "analizá el repo",
        "analiza este repositorio",
        "full analysis",
        "analisis completo",
        "security review",
        "vulnerabilidad en el codigo",
        "refactor this module",
        "refactorizá el archivo",
        "review completo",
        "run the tests",
        "ejecuta los tests",
        "/analyze https://github.com/org/repo",
        "/refactor apply the plan",
        "/execute git push",
        "hacé un code review",
        "auditoria de seguridad",
    ],
)
def test_analysis_intent_classified_as_unknown(text: str) -> None:
    assert QueryClassifier.classify(text) == IntentClass.UNKNOWN


# ---------------------------------------------------------------------------
# Determinism — same input always returns same output
# ---------------------------------------------------------------------------


def test_classifier_is_deterministic() -> None:
    text = "hola"
    result_1 = QueryClassifier.classify(text)
    result_2 = QueryClassifier.classify(text)
    assert result_1 == result_2 == IntentClass.CHAT


def test_classifier_is_deterministic_for_unknown() -> None:
    text = "analizá el repo"
    result_1 = QueryClassifier.classify(text)
    result_2 = QueryClassifier.classify(text)
    assert result_1 == result_2 == IntentClass.UNKNOWN


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------


def test_empty_string_is_unknown() -> None:
    assert QueryClassifier.classify("") == IntentClass.UNKNOWN


def test_whitespace_only_is_unknown() -> None:
    assert QueryClassifier.classify("   ") == IntentClass.UNKNOWN


def test_long_greeting_with_context_is_unknown() -> None:
    # "hola" embedded in an analysis request should NOT be CHAT
    assert QueryClassifier.classify("hola, analizá el repo de autenticación") == IntentClass.UNKNOWN


def test_single_word_ok_is_chat() -> None:
    assert QueryClassifier.classify("ok") == IntentClass.CHAT
