# CGN-Agent vs OpenClaw — Demo Race

Manual head-to-head demonstration: specialized code agent vs generic agent with equivalent resources.

---

## What is being tested

> Subagent orchestration + domain-specific prompting vs flat generalist + same skills loaded.

Same model, same skills, same input. The only variable is agent architecture.

---

## Equal Conditions Checklist

Run this before every task. Both agents must satisfy all conditions.

```
[ ] Same model: Devstral 2-123B, temperature 0.3
[ ] Same repo: same URL, same commit cloned fresh
[ ] Same prompt: copy-paste verbatim, no rewording
[ ] Clean memory: no prior findings or session context for this repo
[ ] Same scope: same files/directories specified
```

---

## OpenClaw Setup

Load these 5 skills before starting. Place them in `~/.openclaw/skills/` or install from ClawHub.

```
code-reviewer
security-review
senior-qa
technical-writer
debugger
```

CGN-Agent has these natively. No other configuration changes.

---

## What differs (the variable)

| | CGN-Agent | OpenClaw |
|---|---|---|
| Architecture | Orchestrator + 4 subagents (security, qa, review, docs) | Single flat agent |
| Prompt layering | Mode-specific system prompt + max 2 active skills | All 5 skills in context always |
| Tool selection | Per-subagent filtered toolset | All tools available at all times |
| Intent routing | Classifier → mode → subagent | None |

---

## Benchmark Repos

One repo per task category. Pinned to a specific commit for reproducibility.

| Task | Repo | Commit | Why |
|---|---|---|---|
| Code Review | [juice-shop/juice-shop](https://github.com/juice-shop/juice-shop) | `fc3697bc` | TypeScript, real tech debt |
| Security Audit | [appsecco/dvna](https://github.com/appsecco/dvna) | `9ba473ad` | Node.js, hardcoded secrets included |
| QA Coverage | [WebGoat/WebGoat](https://github.com/WebGoat/WebGoat) | `7d3343d0` | Java, real test suite included |
| Docs Audit | [Trusted-AI/adversarial-robustness-toolbox](https://github.com/Trusted-AI/adversarial-robustness-toolbox) | `23539e2c` | Python, mixed doc quality |

---

## Task Prompts

Verbatim identical for both agents. No changes.

### Task 1 — Code Review (juice-shop)

Scope: `frontend/src/app/`, `lib/`, `routes/`

```
Review the code in frontend/src/app/, lib/, and routes/.

Produce a structured report with exactly these sections:

1. TOP 3 COMPLEXITY HOTSPOTS
   For each: file path, function/class name, why it is complex, concrete suggestion.

2. TECHNICAL DEBT PATTERNS
   Repeated anti-patterns found across the codebase (min 3).

3. LINTING / STYLE VIOLATIONS
   Top issues by category (unused vars, implicit any, missing types, etc.).

4. PRIORITY ACTION LIST
   Exactly 5 items, ordered by impact. Each item: file:line, issue, fix.
```

---

### Task 2 — Security Audit (dvna)

Scope: `app/`, `config/`, `package.json`

```
Perform a security audit of this Node.js application.

Find and report:

1. HARDCODED SECRETS / CREDENTIALS
   File path, line number, type of secret (key, password, token, etc.).

2. INJECTION VULNERABILITIES
   SQL injection, command injection, XSS — file path, line, attack vector.

3. VULNERABLE DEPENDENCIES
   Package name, current version, known CVE or vulnerability class.

4. SEVERITY SUMMARY
   Count by severity: CRITICAL / HIGH / MEDIUM / LOW.
   Total finding count.
```

---

### Task 3 — QA Coverage (WebGoat)

Scope: `src/main/java/org/owasp/webgoat/`, `src/test/java/org/owasp/webgoat/`

```
Analyze the test coverage of this Java application.

Produce:

1. COVERAGE GAPS
   Classes or methods in src/main/ with NO corresponding test in src/test/.
   Format: ClassName — why this is a gap — risk level (HIGH/MEDIUM/LOW).

2. WEAK TESTS
   Tests that exist but are shallow (no assertions, single happy path, no edge cases).
   Format: TestClass.testMethod — what is missing.

3. TOP 5 MISSING TEST CASES
   Specific test cases that should exist but don't.
   Format: TestClass — testMethodName() — what it should verify.

4. REGRESSION RISK
   Which areas are most likely to regress silently if changed?
```

---

### Task 4 — Docs Audit (adversarial-robustness-toolbox)

Scope: `art/attacks/`, `art/defences/`, `art/estimators/`, `README.md`

```
Audit the engineering documentation of this Python ML security library.

Produce:

1. DOCSTRING QUALITY
   Sample 10 public functions/classes from art/attacks/ and art/defences/.
   For each: name, has docstring (Y/N), has param types (Y/N), has return type (Y/N), has example (Y/N).
   Summary: percentage coverage across the 10 sampled.

2. README GAPS
   What is missing or outdated for a new user trying to get started.
   Specific: which section, what is wrong, what should replace it.

3. API DOCS CONSISTENCY
   Are type hints consistent with docstrings? Find at least 2 mismatches.

4. PRIORITY IMPROVEMENTS
   Top 3 improvements ordered by user impact.
   Each: file or module, specific fix, estimated effort (S/M/L).
```

---

## How to judge output (manual)

For each task, compare both outputs against the same 4 criteria. Score 0 or 1 per criterion.

| Criterion | What to check |
|---|---|
| File references | Does it cite real file paths and line numbers? |
| Section structure | Are all required sections present and populated? |
| Concrete fixes | Are suggestions actionable or just descriptions? |
| Accuracy | Do file names and findings match the actual repo? |

**Score: 0–4 per task. Max 16 total.**

Ties broken by response time.
