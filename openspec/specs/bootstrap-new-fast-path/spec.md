## ADDED Requirements

### Requirement: Bootstrap new sessions without blocking first paint on history load
When route params indicate `bootstrap=new`, the chat panel bootstrap SHALL use a fast path that avoids blocking initial interactive render on the standard history loading flow.

#### Scenario: Fast path for new conversation route
- **WHEN** chat panel mounts with `bootstrap=new`
- **THEN** the composer and base chat scaffold render as ready without waiting for the standard history request to finish
- **AND** no blocking spinner or skeleton gate is shown solely for history bootstrap

#### Scenario: Existing sessions keep default history bootstrap
- **WHEN** chat panel mounts without `bootstrap=new`
- **THEN** the existing history loading flow runs unchanged
- **AND** previously expected history hydration behavior is preserved

### Requirement: Fast path failure handling
The `bootstrap=new` path MUST degrade gracefully if route state is inconsistent or missing.

#### Scenario: Invalid bootstrap marker
- **WHEN** bootstrap marker is absent, invalid, or stripped during navigation
- **THEN** chat initialization falls back to the default bootstrap behavior without runtime errors
