## ADDED Requirements

### Requirement: Optimized barrel imports for high-usage packages

El build de `ui-cognitive` SHALL habilitar `experimental.optimizePackageImports` en `next.config.ts` para los paquetes barrel de alto uso: `lucide-react`, `motion`, `recharts`, `@floating-ui/react`.

#### Scenario: Config declares the optimized packages
- **WHEN** se lee `ui-cognitive/next.config.ts`
- **THEN** el export default MUST incluir `experimental.optimizePackageImports` como arreglo que contiene exactamente (como superconjunto): `"lucide-react"`, `"motion"`, `"recharts"`, `"@floating-ui/react"`

#### Scenario: Build emits smaller First Load JS for /chat
- **WHEN** se corre `next build` sobre el proyecto con la optimización activa
- **THEN** el First Load JS de la ruta `/chat/[sessionKey]` MUST ser menor o igual al baseline × 0.80 medido antes del cambio

### Requirement: Dynamic import for heavy client-only libs

Los componentes que cargan librerías pesadas y solo tienen sentido en cliente SHALL importarse con `next/dynamic` y la política `ssr: false` cuando la librería usa APIs del DOM, o `ssr: true` con `loading` placeholder cuando el SSR aporta valor.

Mapeo obligatorio:
- `MermaidDiagram` → `dynamic(..., { ssr: false, loading: ... })` porque mermaid usa APIs DOM.
- `CodeBlock` (shiki) → `dynamic(..., { ssr: true, loading: ... })`.
- Charts de `recharts` en `components/observability/dashboard-view.tsx` y `components/observability/charts/*` → `dynamic(..., { ssr: false, loading: ... })`.

#### Scenario: MermaidDiagram is not in the initial chat chunk
- **WHEN** se inspecciona el `app-build-manifest.json` del build de producción
- **THEN** el módulo de `mermaid` MUST NOT aparecer en los chunks referenciados por la entry de `/chat/[sessionKey]` (debe estar en un chunk lazy)

#### Scenario: Recharts is not in the initial observability chunk
- **WHEN** se inspecciona el manifest tras el build
- **THEN** el módulo de `recharts` MUST NOT aparecer en los chunks del first-load de `/observability`

#### Scenario: Dynamic imports provide a loading placeholder
- **WHEN** se define un `dynamic(...)` para `MermaidDiagram`, `CodeBlock` o cualquier chart de recharts
- **THEN** la llamada MUST incluir la opción `loading` con un componente que preserve dimensiones razonables del slot (evita layout shift)

### Requirement: Conditional loading of katex

`MessageMarkdown` SHALL cargar `rehype-katex` y su hoja de estilos solo cuando el contenido contiene notación matemática detectable; en caso contrario, el plugin MUST NOT aparecer en `rehypePlugins`.

#### Scenario: Message without math does not include katex plugin
- **WHEN** `MessageMarkdown` renderiza un `content` que no contiene `$` ni `$$`
- **THEN** el arreglo `rehypePlugins` usado por `ReactMarkdown` MUST NOT incluir una referencia a `rehype-katex`

#### Scenario: Message with math enables katex plugin
- **WHEN** `MessageMarkdown` renderiza un `content` que contiene `$$x^2$$` o `$a+b$`
- **THEN** el arreglo `rehypePlugins` usado por `ReactMarkdown` MUST incluir `rehype-katex` con la opción `{ throwOnError: false }`
