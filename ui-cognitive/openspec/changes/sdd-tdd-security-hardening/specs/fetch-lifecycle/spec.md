## ADDED Requirements

### Requirement: useEffect fetch calls SHALL use AbortController for cleanup

All `fetch()` calls inside `useEffect` hooks MUST create an `AbortController`, pass its `signal` to fetch, and call `controller.abort()` in the effect's cleanup function. After abort, the component MUST NOT call setState.

Affected components: `chat-panel.tsx` (history fetch, tools fetch), `chat-help-card.tsx` (multiple API fetches), `folder-card.tsx` (workspace fetch chain).

#### Scenario: Fetch is cancelled when dependencies change
- **WHEN** a useEffect dependency changes while a fetch is in-flight
- **THEN** the previous fetch MUST be aborted via AbortController
- **AND** the aborted fetch MUST NOT call setState with stale data

#### Scenario: Fetch is cancelled on component unmount
- **WHEN** a component unmounts while a fetch is in-flight
- **THEN** the fetch MUST be aborted via AbortController
- **AND** no React warning about setState on unmounted component SHALL appear

#### Scenario: AbortError is silently ignored
- **WHEN** a fetch is aborted and throws an AbortError
- **THEN** the error MUST NOT be logged as an error or shown to the user
- **AND** the component MUST remain in a consistent state
