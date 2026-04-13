## 1. Clone tool destination-root support

- [x] 1.1 Extend `clone_repository` input contract to accept destination root selector (`analysis` | `workspace`) with `analysis` as default.
- [x] 1.2 Update destination resolution in `clone_tools.py` to map selector to `/tmp/analysis` or `/app/workspace` and keep strict destination-name validation.
- [x] 1.3 Add/adjust unit tests for clone destination selection, default behavior, and invalid selector handling.

## 2. Root boundary and safety alignment

- [x] 2.1 Reuse/align allowed-root validation so clone and shell operations enforce the same approved roots deterministically.
- [x] 2.2 Add regression tests for traversal/out-of-root rejection in clone destination handling.

## 3. Mode guidance and docs updates

- [x] 3.1 Update refactor/execute prompt guidance to explicitly document when to use `/tmp/analysis` vs `/app/workspace`.
- [x] 3.2 Update architecture/operational docs to clarify memory semantics: filesystem working memory vs episodic findings memory.

## 4. Validation

- [x] 4.1 Run lint and targeted tests for touched modules.
- [ ] 4.2 Perform manual verification of end-to-end flow: clone to workspace, modify files, and confirm persistence.
