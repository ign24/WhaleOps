## MODIFIED Requirements

### Requirement: clone_repository accepts shallow parameter
The `clone_repository` tool SHALL accept an optional `shallow` boolean parameter (default `False`). When `shallow=True`, the clone SHALL use `--depth 1 --filter=blob:none` to perform a blobless shallow clone, fetching only the latest commit tree without full object history. When reusing an existing valid clone, the `clone_type` field SHALL report `"existing"` regardless of the original clone depth.

#### Scenario: Shallow clone on large repo
- **WHEN** the agent calls `clone_repository` with `shallow=True`
- **THEN** git runs with `--depth 1 --filter=blob:none`
- **THEN** the response includes `"clone_type": "shallow"` in the payload

#### Scenario: Full clone when shallow not specified
- **WHEN** the agent calls `clone_repository` without the `shallow` parameter
- **THEN** git runs a standard full clone (existing behavior unchanged)
- **THEN** the response includes `"clone_type": "full"` in the payload

#### Scenario: Existing clone reuse reports existing type
- **WHEN** the agent calls `clone_repository` with `shallow=True`
- **AND** the destination already contains a valid clone of the requested repo
- **THEN** the response includes `"clone_type": "existing"` in the payload
- **AND** the clone is NOT re-cloned with different depth settings
