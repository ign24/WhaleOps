## Context

`MessageMarkdown` centraliza el render del contenido del asistente con `react-markdown`, plugins de GFM/math y un renderer custom de `code` que hoy deriva en `CodeBlock`. Actualmente no existe una rama específica para `language-mermaid`, por lo que los diagramas se ven como código literal.

El frontend ya está en modo client para este componente, así que puede inicializar Mermaid en navegador sin tocar APIs del backend.

## Goals / Non-Goals

**Goals:**
- Renderizar bloques `mermaid` como SVG visible dentro del chat.
- Mantener seguridad y resiliencia: ante error de parseo, fallback a bloque de código.
- No degradar el render existente de Markdown/KaTeX/código.
- Cubrir comportamiento con pruebas unitarias.

**Non-Goals:**
- No soportar Mermaid inline (solo fenced code blocks).
- No agregar editor interactivo de Mermaid ni controles avanzados.
- No modificar streaming, rutas API, auth o modelo de datos.

## Decisions

### D1: Renderer dedicado `MermaidDiagram` (elegida)

**Opciones:**
- A) Resolver Mermaid dentro de `CodeBlock`.
- B) Crear componente dedicado `MermaidDiagram` e invocarlo desde `MessageMarkdown` para `language-mermaid`.

**Rationale:** B separa responsabilidades (highlight de código vs render de diagramas), facilita tests y fallback.

### D2: Render en cliente con import dinámico de `mermaid`

**Opciones:**
- A) Bundle directo en carga inicial.
- B) `import("mermaid")` dentro de efecto del componente.

**Rationale:** B reduce impacto en payload inicial y evita trabajo innecesario cuando no hay diagramas.

### D3: Fallback determinístico

Si Mermaid falla al procesar definición inválida, se muestra `CodeBlock` con lenguaje `mermaid` y contenido original.

## Risks / Trade-offs

- **[Risk] SVG con estilos que desentonen en dark/light** → Mitigation: envolver en contenedor con estilos locales y ajustar colores base vía CSS.
- **[Risk] Errores de parseo Mermaid en contenido del agente** → Mitigation: catch + fallback a `CodeBlock`.
- **[Risk] Costo de render en mensajes largos con múltiples diagramas** → Mitigation: import dinámico y memoización del componente.

## Migration Plan

1. Agregar dependencia `mermaid`.
2. Escribir tests RED para branch `language-mermaid` y fallback en error.
3. Implementar `MermaidDiagram` y branch en `MessageMarkdown`.
4. Ajustar estilos mínimos en `globals.css` para contenedor Mermaid.
5. Ejecutar `bun run test` y validar que no rompe casos existentes.

## Open Questions

- ¿Aplicamos límite de tamaño de definición Mermaid (ej. chars máximos) en esta iteración o lo dejamos para hardening posterior?
