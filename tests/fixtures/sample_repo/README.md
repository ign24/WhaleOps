# sample_repo

A minimal Python project used as a shared fixture in tool smoke tests.

## Install

```bash
pip install -r requirements.txt
```

No external dependencies are required.

## Usage

```python
from app import greet, add

print(greet("world"))   # Hello, world!
print(add(1, 2))        # 3
```

## Intentional Issues

This repository contains known, intentional issues that are **never to be fixed**.
They exist so that real-tool smoke tests can assert that scanners detect them.

| Issue | Tool | Rule |
|-------|------|------|
| `import os` is imported but never used | ruff | F401 |
| `password = "admin123"` is a hardcoded secret string | bandit | B105 (hardcoded_password_string) |
