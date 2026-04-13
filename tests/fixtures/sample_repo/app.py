"""Sample app module with intentional lint and security issues for testing."""

import os

password = "admin123"


def greet(name: str) -> str:
    """Return a greeting string."""
    return f"Hello, {name}!"


def add(a: int, b: int) -> int:
    """Return the sum of two integers."""
    return a + b
