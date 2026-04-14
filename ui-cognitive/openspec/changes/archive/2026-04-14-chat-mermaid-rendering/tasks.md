## 1. Preparación de capacidad Mermaid

- [x] 1.1 Agregar dependencia `mermaid` en `ui-cognitive/package.json`
- [x] 1.2 Definir estilos base del contenedor Mermaid en `app/globals.css` (scroll/responsive)

## 2. TDD de integración en MessageMarkdown (RED)

- [x] 2.1 Escribir test RED: bloque ` ```mermaid ` válido renderiza contenedor de diagrama
- [x] 2.2 Escribir test RED: bloque no-mermaid continúa usando `CodeBlock`
- [x] 2.3 Escribir test RED: si Mermaid falla, se usa fallback a `CodeBlock` con fuente original

## 3. Implementación Mermaid (GREEN)

- [x] 3.1 Crear `components/chat/mermaid-diagram.tsx` con render cliente e import dinámico de `mermaid`
- [x] 3.2 Integrar branch `language-mermaid` en `components/chat/message-markdown.tsx`
- [x] 3.3 Implementar manejo de error/fallback determinístico sin romper el resto del mensaje
- [x] 3.4 Ajustar output para tema oscuro/claro de forma consistente

## 4. Refactor y verificación (REFACTOR)

- [x] 4.1 Refactorizar componente para mantener separación de responsabilidades (`CodeBlock` vs Mermaid)
- [x] 4.2 Ejecutar `bun run test` y corregir regresiones
- [ ] 4.3 Verificar manualmente en chat que un diagrama Mermaid se ve y que uno inválido degrada a código
