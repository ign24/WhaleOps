## ADDED Requirements

### Requirement: Client-only state SHALL be initialized after hydration

Components that read client-only APIs (localStorage, window dimensions, document theme) MUST initialize `useState` with a deterministic SSR-safe default. The client-specific value MUST be read in a `useEffect` that runs after hydration.

Affected components: `chat-panel.tsx` (agentMode), `sidebar-shell.tsx` (sidebar collapsed state), `code-block.tsx` (theme detection), `chat-session-layout.tsx` (panel state).

#### Scenario: Server and client render identical initial HTML
- **WHEN** a page with client-only state is server-rendered and hydrated
- **THEN** the server-rendered HTML and initial client render MUST produce identical output
- **AND** no hydration mismatch warning SHALL appear in the browser console

#### Scenario: Client-only values are applied after hydration
- **WHEN** a component reads localStorage for persisted preferences
- **THEN** the component SHALL first render with the SSR default value
- **AND** the persisted value SHALL be applied in a `useEffect` after mount

#### Scenario: useSyncExternalStore provides correct server snapshot
- **WHEN** `chat-session-layout.tsx` uses `useSyncExternalStore` with localStorage
- **THEN** the `getServerSnapshot` function MUST return the same value used during SSR
- **AND** the value MUST NOT depend on `window`, `localStorage`, or `document`
