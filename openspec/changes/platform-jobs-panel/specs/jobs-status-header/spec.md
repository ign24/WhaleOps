## ADDED Requirements

### Requirement: Jobs status indicator is always visible in the header
The system SHALL render a `JobsStatusIndicator` component inside the `Header` component on all authenticated pages, visible on both mobile and desktop breakpoints. The indicator SHALL show the count of active cron jobs fetched from `GET /api/jobs/cron`. It SHALL poll every 30 seconds and revalidate immediately on window focus.

#### Scenario: Jobs are active
- **WHEN** `GET /api/jobs/cron` returns one or more jobs
- **THEN** the indicator SHALL display the job count and a pulsing dot using `--success` color

#### Scenario: No jobs active
- **WHEN** `GET /api/jobs/cron` returns an empty array
- **THEN** the indicator SHALL display a static dot using `--text-secondary` color with no count badge

#### Scenario: API error or loading
- **WHEN** the API call fails or is in-flight
- **THEN** the indicator SHALL render in a neutral state (no count, no pulsing) without throwing an error

---

### Requirement: Indicator opens a jobs quick-view panel
Clicking the `JobsStatusIndicator` SHALL open a quick-view panel containing a compact list of active cron jobs. On mobile (viewport width below `lg` breakpoint) the panel SHALL be a bottom sheet sliding up from the bottom edge. On desktop it SHALL be a popover anchored below the indicator. Both SHALL close on outside click or `Escape` key.

#### Scenario: Open on mobile
- **WHEN** a user on a mobile viewport taps the `JobsStatusIndicator`
- **THEN** a bottom sheet SHALL slide up displaying the compact job list

#### Scenario: Open on desktop
- **WHEN** a user on a desktop viewport clicks the `JobsStatusIndicator`
- **THEN** a popover SHALL appear anchored below the indicator displaying the compact job list

#### Scenario: Close on outside interaction
- **WHEN** the quick-view panel is open and the user clicks outside it or presses `Escape`
- **THEN** the panel SHALL close with an exit animation

---

### Requirement: Jobs quick-view shows compact job list
The quick-view panel SHALL render a `JobsQuickList` component displaying each job's description, cron expression (human-readable if possible), and next run time. Each item SHALL have a cancel button. A "Manage jobs" link SHALL navigate to `/jobs`. If no jobs exist, a placeholder message SHALL be shown.

#### Scenario: Jobs listed in quick-view
- **WHEN** the quick-view panel opens and jobs exist
- **THEN** each job row SHALL display: description, cron expression, next run time, and a cancel (×) button

#### Scenario: Cancel from quick-view
- **WHEN** user clicks the cancel button on a job row in the quick-view
- **THEN** the system SHALL call `DELETE /api/jobs/cron/{id}` and remove the row from the list optimistically

#### Scenario: Empty state in quick-view
- **WHEN** the quick-view panel opens and no jobs exist
- **THEN** the panel SHALL display "No scheduled jobs" placeholder

#### Scenario: Manage jobs link
- **WHEN** the quick-view panel is open
- **THEN** a "Manage jobs" link SHALL be visible and SHALL navigate to `/jobs` (closing the panel)
