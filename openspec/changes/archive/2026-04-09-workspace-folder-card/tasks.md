## 1. Extracción de TreeNode a módulo compartido

- [x] 1.1 Crear `components/activity/tree-node.tsx` con `TreeNode` y `formatBytes` extraídos de `session-workspace.tsx`
- [x] 1.2 Actualizar `session-workspace.tsx` para importar `TreeNode` desde el nuevo módulo compartido
- [x] 1.3 Verificar que `SessionWorkspace` renderiza igual que antes (tests existentes pasan)

## 2. Implementar FolderCard

- [x] 2.1 Crear `components/activity/folder-card.tsx` con el hook `useFolderTree(path, isLive)` que implementa fetch inicial + polling 5s + cleanup
- [x] 2.2 Implementar las dos secciones colapsables (`/app/workspace` y `/tmp/analysis`) usando `TreeNode`
- [x] 2.3 Agregar manejo de estados: loading, error/404 ("no disponible"), y datos
- [x] 2.4 Agregar botón de refresh manual que dispara re-fetch inmediato de ambas rutas
- [x] 2.5 Aplicar lógica de collapse-by-default cuando total de nodos > 10

## 3. Modificar layout en ChatSessionLayout

- [x] 3.1 Envolver `ActivityPanel` en un `flex flex-col gap-2 h-full min-h-0` junto con `FolderCard`
- [x] 3.2 Dar a `ActivityPanel` clase `flex-1 min-h-0` y a `FolderCard` `max-h-[280px] shrink-0`
- [x] 3.3 Pasar `isLive` como prop a `FolderCard`
- [x] 3.4 Excluir `FolderCard` del overlay mobile (solo desktop)

## 4. Tests

- [x] 4.1 Escribir test para `FolderCard`: renderiza "no disponible" cuando la API devuelve 404
- [x] 4.2 Escribir test para `FolderCard`: muestra árbol cuando la API devuelve datos válidos
- [x] 4.3 Escribir test para `FolderCard`: botón de refresh dispara re-fetch
- [x] 4.4 Verificar que tests existentes de `session-workspace` y `chat-session-layout` siguen pasando
