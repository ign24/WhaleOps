## Why

El componente `MessageMarkdown` usa `react-markdown` v10 sin soporte para HTML raw, lo que hace que etiquetas HTML embebidas en las respuestas del agente se rendericen como texto literal en lugar de como HTML. Habilitar HTML en markdown permite respuestas más ricas (tablas personalizadas, badges, layouts inline) sin romper el formato markdown existente.

## What Changes

- Instalar `rehype-raw` y `rehype-sanitize` como dependencias del frontend.
- Agregar ambos plugins a la configuración de `ReactMarkdown` en `MessageMarkdown`.
- `rehype-raw` parsea nodos HTML raw dentro del AST de hast.
- `rehype-sanitize` filtra etiquetas y atributos peligrosos (XSS prevention).
- El markdown existente no se afecta — solo se agrega capacidad nueva.

## Capabilities

### New Capabilities

- `html-rendering`: Parseo y renderizado seguro de HTML raw embebido en mensajes markdown del chat.

### Modified Capabilities

- `message-markdown`: El componente acepta HTML raw y lo renderiza, además del markdown GFM existente.

## Impact

- **Archivo**: `components/chat/message-markdown.tsx`
- **Dependencias nuevas**: `rehype-raw`, `rehype-sanitize`
- **Sin breaking changes**: el markdown actual sigue funcionando igual
- **Seguridad**: `rehype-sanitize` aplica un schema allowlist por defecto (elimina `<script>`, event handlers, etc.)
