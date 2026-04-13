## ADDED Requirements

### Requirement: Derivar WorkspaceSnapshot desde ActivityEntry[]
El sistema SHALL proveer una función pura `deriveWorkspaceSnapshot(entries: ActivityEntry[]): WorkspaceSnapshot` en `workspace-snapshot.ts` que extrae información de archivos y repos del array de entries sin efectos secundarios.

El tipo `WorkspaceSnapshot` SHALL contener:
- `repos`: array de repos clonados con `url`, `localPath`, `cloneType`, `durationMs?`
- `filesRead`: array de `{ path: string; timestamp: number }` deduplicado por path
- `filesWritten`: array de `{ path: string; operation: "write" | "edit" | "create"; timestamp: number }` deduplicado por path
- `directoriesExplored`: array de `{ path: string; treeText?: string }` deduplicado por path
- `commandsRun`: array de strings (comandos shell únicos)
- `isEmpty`: boolean — true si todos los arrays están vacíos

#### Scenario: Repo clonado detectado
- **WHEN** hay un entry con `toolNameNormalized === "clone_repository"` y status `"completed"`
- **THEN** el snapshot incluye un repo con `url` de `toolArgs.url`, `localPath` de `toolResult.repo_path`, `cloneType` de `toolResult.clone_type`, y `durationMs` de `toolResult.duration_ms`

#### Scenario: Fallback a sandboxPath para repo clonado
- **WHEN** `toolResult` no parsea como JSON válido o no contiene `repo_path`
- **THEN** se usa `entry.sandboxPath` como `localPath` si está disponible

#### Scenario: Archivo leído registrado
- **WHEN** hay un entry con `toolNameNormalized` en `{read_text_file, read_file}` y `toolArgs.path` presente
- **THEN** el path se agrega a `filesRead` deduplicado, preservando el `startedAt` como timestamp

#### Scenario: Archivo escrito registrado
- **WHEN** hay un entry con `toolNameNormalized` en `{write_file, edit_file, apply_patch, create_file}` y `toolArgs.path` presente
- **THEN** el path se agrega a `filesWritten` con la operación correspondiente (`write`, `edit`, `create`)

#### Scenario: Directorio explorado con árbol
- **WHEN** hay un entry completado con `toolNameNormalized` en `{directory_tree, list_directory}` y `toolArgs.path` presente
- **THEN** se agrega a `directoriesExplored` con `path` y `treeText` del `toolResult` (si existe). Si el mismo path aparece múltiples veces, se usa el último resultado.

#### Scenario: Comando shell registrado
- **WHEN** hay un entry con `toolNameNormalized` en `{shell_execute, bash, shell}` y `entry.commandSummary` presente
- **THEN** el comando se agrega a `commandsRun` deduplicado

#### Scenario: Snapshot vacío
- **WHEN** el array de entries no contiene ningún entry de tipo file/repo/shell
- **THEN** `isEmpty === true` y todos los arrays son vacíos

#### Scenario: Solo entries no-completados ignorados
- **WHEN** un entry file-aware tiene status `"running"` o `"pending"`
- **THEN** NO se incluye en el snapshot (solo se procesa status `"completed"`)

### Requirement: Relativizar paths al repo root
La función SHALL proveer una utilidad `relativizeToRepo(filePath: string, repos: WorkspaceSnapshot["repos"]): string` que retorna el path relativo al repo si coincide, o el path absoluto si no.

#### Scenario: Path dentro de repo clonado
- **WHEN** `filePath` comienza con el `localPath` de algún repo en el snapshot
- **THEN** retorna el path relativo a ese `localPath` (ej: `/tmp/analysis/django/src/models.py` → `src/models.py`)

#### Scenario: Path fuera de cualquier repo
- **WHEN** `filePath` no coincide con ningún `localPath` conocido
- **THEN** retorna `filePath` sin modificar
