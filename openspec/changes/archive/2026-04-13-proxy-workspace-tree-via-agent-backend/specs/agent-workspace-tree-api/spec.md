## Capability: agent-workspace-tree-api

El backend NAT SHALL exponer endpoints read-only para inspección de filesystem del runtime del agente en roots permitidos.

---

### Requirement: workspace-roots-endpoint

El backend SHALL exponer `GET /workspace/roots` retornando el set de roots configurados para inspección (`sandbox`, `workspace`).

#### Scenario: lista de roots configurados

WHEN se invoca `GET /workspace/roots`
THEN el backend responde `200` con `{ roots: [{ path, label }] }`
AND los `path` corresponden a roots permitidos de runtime

---

### Requirement: workspace-tree-endpoint-path-guard

El backend SHALL validar que `path` pertenezca al conjunto permitido y bloquear traversal o rutas externas.

#### Scenario: path permitido

WHEN se invoca `GET /workspace/tree?path=/tmp/analysis/repo`
AND el path resuelve dentro de un root permitido
THEN el backend responde `200` con `WorkspaceTreeResponse`

#### Scenario: path fuera de roots permitidos

WHEN se invoca `GET /workspace/tree?path=/etc`
THEN el backend responde `403` con error de path no permitido

#### Scenario: path inexistente

WHEN se invoca `GET /workspace/tree?path=/app/workspace/no-existe`
THEN el backend responde `404` con error de path no encontrado
