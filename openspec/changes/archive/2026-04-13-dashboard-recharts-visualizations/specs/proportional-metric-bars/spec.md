## ADDED Requirements

### Requirement: Tool usage bars use correct proportional denominator
The tool usage horizontal bars SHALL calculate percentage as `item.count / maxCount * 100` where `maxCount` is the count of the most-used tool (first element in sorted array). The previous incorrect formula using `requests` as denominator SHALL be replaced.

#### Scenario: Multiple tools with varying counts
- **WHEN** tool A has 200 calls, tool B has 100 calls, tool C has 50 calls
- **THEN** tool A bar is 100%, tool B is 50%, tool C is 25%

#### Scenario: Single tool
- **WHEN** only one tool has usage data
- **THEN** that tool's bar is 100%

### Requirement: Tool failure bars with proportional scaling and color intensity
The tool failure list SHALL be replaced with horizontal bars using proportional scaling (denominator = max failure count). Bar color intensity SHALL increase with failure count (lighter for fewer failures, more saturated red for most failures).

#### Scenario: Proportional failure bars
- **WHEN** tool X has 15 failures (most), tool Y has 5, tool Z has 2
- **THEN** tool X bar is 100% width with full red intensity, tool Y is 33%, tool Z is 13%

#### Scenario: No failures
- **WHEN** `topToolFailures` is empty
- **THEN** the section shows "Sin fallos de tools detectados." text

### Requirement: Error category bars with proportional scaling
The error categories list SHALL be replaced with horizontal bars using the same proportional scaling pattern (denominator = max category count).

#### Scenario: Multiple error categories
- **WHEN** timeout has 10 occurrences, network has 4, auth has 1
- **THEN** timeout bar is 100%, network is 40%, auth is 10%
