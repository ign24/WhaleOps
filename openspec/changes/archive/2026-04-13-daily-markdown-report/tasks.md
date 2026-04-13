## 1. Cron Callback Dispatch

- [x] 1.1 Write failing test: cron callback invokes stream_fn with prompt and session_id="cron:scheduled"
- [x] 1.2 Write failing test: cron callback logs error and does not crash scheduler when stream_fn raises
- [x] 1.3 Write failing test: cron callback warns and returns when stream_fn is not captured
- [x] 1.4 Implement real cron callback in register.py — capture stream_fn from builder after configure, replace log-only stub
- [x] 1.5 Write integration test: scheduler fires job and full callback chain executes (mock stream_fn)

## 2. Report Tool — Core

- [x] 2.1 Write failing test: generate_report produces a markdown file at REPORT_OUTPUT_DIR/YYYY-MM-DD.md
- [x] 2.2 Write failing test: generate_report creates output directory if it does not exist
- [x] 2.3 Write failing test: report includes YAML frontmatter with date, type, and repos fields
- [x] 2.4 Write failing test: second call on same day overwrites the file (idempotent)
- [x] 2.5 Create report_tools.py with generate_report NAT function registration and core file-writing logic

## 3. Report Tool — Content Sections

- [x] 3.1 Write failing test: findings summary section groups by severity with counts when Milvus has data
- [x] 3.2 Write failing test: findings summary shows "no findings recorded" when Milvus is empty
- [x] 3.3 Write failing test: findings summary shows "Milvus unreachable" when circuit breaker is open
- [x] 3.4 Write failing test: dependency observations section renders placeholder text
- [x] 3.5 Write failing test: summary block includes total count, severity breakdown, and date range
- [x] 3.6 Implement report content builder — query Milvus directly, format sections, assemble markdown

## 4. Config Wiring

- [x] 4.1 Add generate_report tool definition to config.yml
- [x] 4.2 Add generate_report to execute mode tool_names list
- [x] 4.3 Add REPORT_OUTPUT_DIR to .env.example with default value
- [x] 4.4 Verify generate_report is NOT available in analyze or chat modes (assertion test)

## 5. Validation

- [x] 5.1 Run full test suite — all existing + new tests pass
- [ ] 5.2 Manual smoke test: schedule a daily report via schedule_task, verify cron fires and markdown is written
