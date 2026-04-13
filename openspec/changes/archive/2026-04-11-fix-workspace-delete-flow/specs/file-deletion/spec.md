## ADDED Requirements

### Requirement: workspace_delete tool supports file deletion
The `workspace_delete` tool SHALL accept individual files as targets in addition to directories. For files, it SHALL use `os.remove()` instead of `shutil.rmtree()`.

#### Scenario: Delete a file in sandbox
- **WHEN** `workspace_delete(location="sandbox", target="test.txt")` is called and `/tmp/analysis/test.txt` is a file
- **THEN** the file SHALL be deleted and the response SHALL include `size_freed_mb` with the file size

#### Scenario: Delete a file in workspace
- **WHEN** `workspace_delete(location="workspace", target="report.md")` is called and `/app/workspace/report.md` is a file
- **THEN** the tool SHALL return `status: "awaiting_ui_confirmation"` with a confirmation token (same PIN flow as directories)

#### Scenario: Delete a directory still works
- **WHEN** `workspace_delete(location="sandbox", target="my-repo")` is called and the target is a directory
- **THEN** the directory SHALL be deleted using `shutil.rmtree()` as before

### Requirement: execute-delete API supports file deletion
The `/workspace/execute-delete` endpoint SHALL accept both files and directories. For files, it SHALL use `os.remove()`. For directories, it SHALL use `shutil.rmtree()`.

#### Scenario: Execute delete on a file
- **WHEN** POST `/workspace/execute-delete` with `{ path: "/app/workspace/notes.txt" }` and the path is a file
- **THEN** the file SHALL be deleted and response SHALL include `size_freed_mb`

#### Scenario: Execute delete on a directory
- **WHEN** POST `/workspace/execute-delete` with `{ path: "/app/workspace/django" }` and the path is a directory
- **THEN** the directory SHALL be deleted via `shutil.rmtree()`

#### Scenario: Target does not exist
- **WHEN** the target path does not exist
- **THEN** the endpoint SHALL return 404

### Requirement: Size helper handles both files and directories
The size calculation function SHALL return file size for individual files and recursive directory size for directories.

#### Scenario: Size of a single file
- **WHEN** calculating size of a 2048-byte file
- **THEN** the result SHALL be `0.0` (rounded to 2 decimals from 0.00195 MB)

#### Scenario: Size of a directory
- **WHEN** calculating size of a directory tree
- **THEN** the result SHALL be the sum of all file sizes within, in MB rounded to 2 decimals

### Requirement: Tool description mentions files
The `workspace_delete` tool description SHALL mention both files and directories so the agent knows file deletion is supported.

#### Scenario: Tool description content
- **WHEN** the agent reads the tool description
- **THEN** it SHALL contain both "file" and "directory" as deletable targets
