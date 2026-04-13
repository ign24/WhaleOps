## Why

El bundle inicial de `ui-cognitive` carga libs pesadas eagerly (mermaid, shiki, recharts, katex), y el componente de markdown recrea su prop `components={}` en cada token streameado — rompiendo la memoización de `react-markdown` y causando re-render del árbol completo por token. Además `next.config.ts` no activa `optimizePackageImports` para los barrels más usados (lucide, motion, recharts, floating-ui), y extensiones de navegador tipo DarkReader producen hydration mismatches que descartan el árbol SSR y fuerzan re-render en cliente. Los cuatro fixes son < 1h c/u y atacan FCP, bundle size y FPS de streaming.

## What Changes

- Activar `experimental.optimizePackageImports` en `next.config.ts` para `lucide-react`, `motion`, `recharts`, `@floating-ui/react`.
- Convertir a `next/dynamic` (con `ssr: false` donde corresponda) los siguientes imports pesados:
  - `MermaidDiagram` en `components/chat/message-markdown.tsx`
  - `CodeBlock` (shiki) en `components/chat/message-markdown.tsx`
  - `recharts` charts en `components/observability/dashboard-view.tsx` y `components/observability/charts/*`
  - `rehype-katex` + CSS de katex: cargar solo cuando el contenido contiene `$` o `$$`
- Hoist del objeto `components={{...}}` de `ReactMarkdown` en `message-markdown.tsx` a constante módulo-level para evitar recreación por render.
- Agregar `suppressHydrationWarning` en `<body>` de `app/layout.tsx` para neutralizar mutaciones de DarkReader.

TDD estricto: RED tests primero (bundle-size assertions sobre output de `next build`, render-count de `MessageMarkdown` en streaming simulado, ausencia de hydration warnings cuando se inyectan atributos tipo darkreader). Baseline de `next build` capturado antes de cualquier cambio.

## Capabilities

### New Capabilities
- `frontend-bundle-optimization`: estrategia de bundle splitting y barrel-import optimization del frontend Next.js — qué paquetes se optimizan, qué módulos se cargan dinámicamente y bajo qué condiciones.
- `markdown-render-stability`: garantías de estabilidad de renderizado de `MessageMarkdown` durante streaming (prop identity, render count por token).
- `hydration-resilience`: tolerancia del árbol hidratado ante mutaciones DOM de extensiones de navegador (DarkReader y similares).

### Modified Capabilities
<!-- Ninguna — los specs afectados (message-markdown) reciben comportamiento adicional pero no cambian requirements existentes. La estabilidad de render se modela como capability nueva para no invadir message-markdown. -->

## Impact

- **Código**: `ui-cognitive/next.config.ts`, `ui-cognitive/app/layout.tsx`, `ui-cognitive/components/chat/message-markdown.tsx`, `ui-cognitive/components/observability/dashboard-view.tsx`, `ui-cognitive/components/observability/charts/*.tsx`.
- **Dependencias**: sin paquetes nuevos. Uso de `next/dynamic` (ya disponible).
- **Tests**: nuevos tests en `ui-cognitive/tests/` (Vitest + Testing Library) para render-count y hydration; script de baseline `ui-cognitive/scripts/measure-bundle.mjs` que parsea el output de `next build`.
- **CI**: el test de bundle-size corre contra un build de producción — se ejecuta bajo `bun run test:bundle` separado para no ralentizar el watch loop.
- **Runtime**: se espera reducción de First Load JS en `/chat/[sessionKey]` y `/observability` ≥ 20%, y reducción de re-renders por token en `MessageMarkdown` ≥ 80%.
