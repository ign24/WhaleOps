## ADDED Requirements

### Requirement: Jobs management page is accessible from the sidebar
The system SHALL add a Clock icon link to the sidebar navigation pointing to `/jobs`. On desktop (expanded sidebar) it SHALL show icon + label "Jobs". On collapsed desktop sidebar it SHALL show icon only with a tooltip. On mobile (drawer) it SHALL show icon + label. The link SHALL be available to all authenticated users.

#### Scenario: Sidebar expanded desktop
- **WHEN** a desktop user views the expanded sidebar
- **THEN** a Clock icon link labeled "Jobs" SHALL be visible alongside Observability and Admin links

#### Scenario: Sidebar collapsed desktop
- **WHEN** a desktop user collapses the sidebar
- **THEN** the Jobs link SHALL render as Clock icon only with a tooltip showing "Jobs"

#### Scenario: Mobile drawer
- **WHEN** a mobile user opens the sidebar drawer
- **THEN** the Jobs link with Clock icon and "Jobs" label SHALL be visible

#### Scenario: Active state
- **WHEN** the current pathname starts with `/jobs`
- **THEN** the Jobs link SHALL render with the active color (`--primary`)

---

### Requirement: Jobs page displays a table of scheduled jobs
The `/jobs` page SHALL render a full-width table on desktop with columns: Description, Cron expression, Next run, Status, and Actions. On mobile (viewport below `md` breakpoint) each job SHALL render as a card instead of a table row. The page SHALL fetch from `GET /api/jobs/cron` on mount and provide a manual refresh button.

#### Scenario: Jobs table on desktop
- **WHEN** a desktop user navigates to `/jobs` and jobs exist
- **THEN** the page SHALL display a table with columns Description, Cron, Next Run, Status, and Actions

#### Scenario: Card layout on mobile
- **WHEN** a mobile user navigates to `/jobs` and jobs exist
- **THEN** each job SHALL render as a card showing description, cron expression, next run time, status badge, and cancel button

#### Scenario: Empty state
- **WHEN** no jobs are scheduled
- **THEN** the page SHALL display an empty state with a message and a "Create your first job" prompt

#### Scenario: Loading state
- **WHEN** the page is fetching jobs
- **THEN** the page SHALL display a skeleton loader matching the table/card layout

#### Scenario: Error state
- **WHEN** the `GET /api/jobs/cron` request fails
- **THEN** the page SHALL display an error message with a retry button

---

### Requirement: User can create a new cron job from the management page
The `/jobs` page SHALL have a "New Job" button that opens a creation form (inline drawer or modal). The form SHALL have fields for Description, Cron expression, and Prompt. It SHALL validate the cron expression client-side and show a human-readable preview of the schedule. On submit it SHALL call `POST /api/jobs/cron`. On success it SHALL close the form and refresh the job list.

#### Scenario: Open creation form
- **WHEN** user clicks "New Job"
- **THEN** a creation form SHALL open with fields for Description, Cron expression, and Prompt

#### Scenario: Cron preview
- **WHEN** user types a valid cron expression in the form
- **THEN** the form SHALL display a human-readable interpretation (e.g. "Every day at 9:00 AM")

#### Scenario: Invalid cron expression
- **WHEN** user submits the form with an invalid cron expression
- **THEN** the form SHALL show an inline validation error and SHALL NOT submit

#### Scenario: Successful creation
- **WHEN** user submits a valid form
- **THEN** the system SHALL call `POST /api/jobs/cron`, close the form, and refresh the job list showing the new entry

#### Scenario: Server-side rejection
- **WHEN** the `POST /api/jobs/cron` call returns HTTP 422
- **THEN** the form SHALL display the server error message inline without closing

---

### Requirement: User can cancel a job from the management page
Each job row/card on `/jobs` SHALL have a cancel action. Clicking it SHALL prompt for confirmation, then call `DELETE /api/jobs/cron/{id}`. On success the job SHALL be removed from the list.

#### Scenario: Cancel confirmation
- **WHEN** user clicks the cancel action on a job
- **THEN** a confirmation dialog or inline confirm state SHALL appear before the DELETE is sent

#### Scenario: Confirmed cancel
- **WHEN** user confirms the cancel action
- **THEN** the system SHALL call `DELETE /api/jobs/cron/{id}` and remove the job from the list

#### Scenario: Cancel dismissed
- **WHEN** user dismisses the confirmation
- **THEN** no API call SHALL be made and the job SHALL remain in the list
