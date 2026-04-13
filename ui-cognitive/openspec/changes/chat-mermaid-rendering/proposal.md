## Why

El chat del agente ya renderiza Markdown, KaTeX y bloques de código, pero los bloques ` ```mermaid ` se muestran como texto plano. Esto limita la legibilidad de flujos, arquitecturas y secuencias que el agente devuelve en formato diagrama.

## What Changes

- Agregar soporte de renderizado Mermaid en mensajes del chat para bloques fenced con lenguaje `mermaid`.
- Mantener fallback seguro: si el diagrama no compila, mostrar bloque de código sin romper el mensaje.
- Preservar el pipeline actual de Markdown para contenidos no-Mermaid (texto, listas, tablas, math, code).
- Incorporar pruebas unitarias de `MessageMarkdown` para casos Mermaid válidos e inválidos.

## Capabilities

### New Capabilities
- `chat-mermaid-diagrams`: Renderizado de diagramas Mermaid embebidos en mensajes del chat del agente.

### Modified Capabilities
<!-- ninguna: se introduce capacidad nueva sin modificar una spec base existente -->

## Impact

- **Componentes UI**: `components/chat/message-markdown.tsx`, nuevo `components/chat/mermaid-diagram.tsx`.
- **Dependencias frontend**: agregar `mermaid` en `package.json`.
- **Testing**: ampliar `tests/message-markdown.test.tsx` y/o agregar tests para el renderer Mermaid.
- **Sin cambios** en rutas API, auth, ni contrato SSE con NAT.
