"""Tests for sample_repo app module."""

from app import add
from app import greet


def test_greet_returns_greeting() -> None:
    assert greet("world") == "Hello, world!"


def test_add_returns_sum() -> None:
    assert add(1, 2) == 3
