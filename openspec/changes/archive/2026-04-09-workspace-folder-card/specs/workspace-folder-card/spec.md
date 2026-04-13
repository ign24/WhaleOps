## ADDED Requirements

### Requirement: FolderCard displays filesystem trees for workspace and sandbox roots
The system SHALL render a `FolderCard` component that fetches and displays the directory tree of `/app/workspace` and `/tmp/analysis` independently of `ActivityEntry` events. Each root SHALL be rendered as a collapsible section with its own tree view.

#### Scenario: Both paths available
- **WHEN** the FolderCard mounts and both `/app/workspace` and `/tmp/analysis` return valid tree data
- **THEN** both sections render with their directory trees and file/folder counts

#### Scenario: Path not found (dev or empty container)
- **WHEN** `/api/workspace/tree` returns 404 for a given path
- **THEN** that section displays a "no disponible" message without crashing the component

#### Scenario: Section collapsed by default when many files
- **WHEN** a root directory contains more than 10 total nodes
- **THEN** that section renders collapsed by default
- **AND** the user can expand it by clicking the section header

### Requirement: FolderCard auto-polls during live sessions
The `FolderCard` SHALL poll both paths every 5 seconds when `isLive=true`. Polling SHALL stop immediately when `isLive` changes to `false`.

#### Scenario: Active agent run
- **WHEN** `isLive` is `true` and the FolderCard is mounted
- **THEN** the component re-fetches both paths every 5 seconds

#### Scenario: Session ends
- **WHEN** `isLive` changes from `true` to `false`
- **THEN** the polling interval is cleared and no further fetches occur

#### Scenario: Component unmounts during live session
- **WHEN** the user closes the activity panel while `isLive=true`
- **THEN** the polling interval is cleared on unmount with no memory leaks

### Requirement: FolderCard provides manual refresh
The `FolderCard` SHALL include a refresh button that triggers an immediate re-fetch of both paths regardless of `isLive` state.

#### Scenario: Manual refresh
- **WHEN** the user clicks the refresh button
- **THEN** both paths are re-fetched immediately and the trees update

### Requirement: FolderCard reuses shared TreeNode renderer
The `FolderCard` SHALL use the shared `TreeNode` component from `components/activity/tree-node.tsx` to render directory trees. The `TreeNode` component SHALL be extracted from `session-workspace.tsx` into the shared module.

#### Scenario: TreeNode renders directory with children
- **WHEN** a node has `type: "dir"` and `children`
- **THEN** it renders with a chevron toggle and indented children at `depth + 1`

#### Scenario: TreeNode renders file with size
- **WHEN** a node has `type: "file"` and a `size` field
- **THEN** it renders the filename and formatted size (B / KB / MB)
