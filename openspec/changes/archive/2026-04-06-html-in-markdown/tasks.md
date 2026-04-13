## 1. Dependencias

- [x] 1.1 Instalar `rehype-raw` y `rehype-sanitize` con bun en `ui-cognitive/`

## 2. Implementación

- [x] 2.1 Agregar `rehypePlugins={[rehypeRaw, rehypeSanitize]}` a `ReactMarkdown` en `components/chat/message-markdown.tsx`
- [x] 2.2 Verificar que el orden de plugins es correcto: `rehype-raw` primero, `rehype-sanitize` segundo

## 3. Verificación

- [x] 3.1 Confirmar que un mensaje con `<strong>texto</strong>` renderiza bold y no texto literal
- [x] 3.2 Confirmar que markdown existente (headers, listas, code blocks) sigue funcionando
- [x] 3.3 Confirmar que `<script>alert(1)</script>` en un mensaje no ejecuta nada
- [x] 3.4 Ejecutar `bun run lint && bun run build` sin errores
