## ADDED Requirements

### Requirement: workspace_delete SHALL include ownership metadata in responses when available
When deleting a target that has a `.clone_meta.json` file, the response SHALL include `cloned_by` and `cloned_at` fields from that file.

#### Scenario: Ownership info included in delete response
- **WHEN** `workspace_delete(location="workspace", target="django")` is called
- **AND** `/app/workspace/django/.clone_meta.json` exists with `cloned_by` and `cloned_at`
- **THEN** the `awaiting_ui_confirmation` response SHALL include `"cloned_by"` and `"cloned_at"`

#### Scenario: Missing metadata file is not an error
- **WHEN** `workspace_delete` is called on a target with no `.clone_meta.json`
- **THEN** the response SHALL proceed normally without `cloned_by` or `cloned_at` fields
- **AND** the response SHALL NOT include `"status": "error"` due to missing metadata
